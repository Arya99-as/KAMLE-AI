import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";
import User from "../src/models/User.js";
import { hashPassword } from "../src/utils/password.js";

let app: Express;
let workerToken = "";
let adminToken = "";
let customerToken = "";
let workerProfileId = "";
let workerUserId = "";

const validProfile = {
  professionalDescription: "Experienced refrigerator and washing machine repair technician serving the local area with quality spare parts.",
  serviceCategories: ["Appliance Repair"],
  skills: ["Refrigerator Repair", "Cooling System Troubleshooting"],
  experienceYears: 6,
  experienceSummary: "Repaired 500+ appliances.",
  serviceAreas: ["Kolhapur", "Sangli"],
  pricing: { type: "quote", currency: "INR", note: "Quote before repair." },
  availability: { availableNow: true, days: ["Mon", "Tue", "Wed"] },
  consent: true,
};

beforeAll(async () => {
  await connectDB();
  app = createApp();

  const workerReg = await request(app).post("/api/auth/register").send({
    name: "Workflow Worker",
    phone: "9700000201",
    email: "workflowworker@example.com",
    password: "Password123",
    role: "worker",
  });
  workerToken = workerReg.body.token;
  workerUserId = workerReg.body.user.id;

  const customerReg = await request(app).post("/api/auth/register").send({
    name: "Workflow Customer",
    phone: "9700000202",
    email: "workflowcustomer@example.com",
    password: "Password123",
    role: "customer",
  });
  customerToken = customerReg.body.token;

  const admin = await User.create({
    name: "Workflow Admin",
    phone: "9700000203",
    email: "workflowadmin@example.com",
    passwordHash: await hashPassword("Password123"),
    role: "admin",
    accountStatus: "active",
  });
  expect(admin.role).toBe("admin");

  const adminLogin = await request(app).post("/api/auth/login").send({ identifier: "9700000203", password: "Password123" });
  adminToken = adminLogin.body.token;
});

afterAll(async () => {
  await disconnectDB();
});

describe("worker approval workflow", () => {
  it("lets a worker submit a profile which starts as pending", async () => {
    const res = await request(app)
      .post("/api/workers/profile")
      .set("Authorization", `Bearer ${workerToken}`)
      .send(validProfile);
    expect(res.status).toBe(201);
    expect(res.body.workerProfile.approvalStatus).toBe("pending");
    workerProfileId = res.body.workerProfile._id;
  });

  it("does not expose a pending worker in public search", async () => {
    const res = await request(app).get("/api/workers").query({ category: "Appliance Repair" });
    expect(res.status).toBe(200);
    expect(res.body.items.find((w: { userId: string }) => w.userId === workerUserId)).toBeUndefined();
  });

  it("shows the pending application to an admin", async () => {
    const res = await request(app).get("/api/admin/workers/pending").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.some((p: { _id: string }) => p._id === workerProfileId)).toBe(true);
  });

  it("requires a reason when rejecting", async () => {
    const res = await request(app)
      .patch(`/api/admin/workers/${workerProfileId}/approval`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "rejected", reason: "" });
    expect(res.status).toBe(400);
  });

  it("approves the worker and changes real database state", async () => {
    const res = await request(app)
      .patch(`/api/admin/workers/${workerProfileId}/approval`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.workerProfile.approvalStatus).toBe("approved");
  });

  it("now exposes the approved worker in public search", async () => {
    const res = await request(app).get("/api/workers").query({ category: "Appliance Repair", location: "Kolhapur" });
    expect(res.status).toBe(200);
    const found = res.body.items.find((w: { userId: string }) => w.userId === workerUserId);
    expect(found).toBeTruthy();
    expect(found.reasons.length).toBeGreaterThan(0);
  });

  it("returns the worker public profile by id", async () => {
    const res = await request(app).get(`/api/workers/${workerProfileId}`);
    expect(res.status).toBe(200);
    expect(res.body.worker.name).toBe("Workflow Worker");
  });
});

describe("enquiries and reviews", () => {
  let enquiryId = "";

  it("prevents an enquiry to an unapproved worker", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: "000000000000000000000000", serviceCategory: "Appliance Repair", problemDescription: "Fridge not cooling at all." });
    expect(res.status).toBe(404);
  });

  it("creates an enquiry", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: workerUserId, serviceCategory: "Appliance Repair", problemDescription: "My refrigerator is not cooling properly.", location: "Kolhapur" });
    expect(res.status).toBe(201);
    enquiryId = res.body.enquiry._id;
  });

  it("blocks a duplicate open enquiry", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: workerUserId, serviceCategory: "Appliance Repair", problemDescription: "My refrigerator is not cooling properly.", location: "Kolhapur" });
    expect(res.status).toBe(409);
  });

  it("blocks reviewing before completion", async () => {
    const res = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: workerUserId, rating: 5, comment: "Great" });
    expect(res.status).toBe(403);
  });

  it("completes the enquiry then allows a review", async () => {
    const accept = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "accepted" });
    expect(accept.status).toBe(200);

    const complete = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "completed" });
    expect(complete.status).toBe(200);

    const review = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: workerUserId, rating: 5, comment: "Fast and honest." });
    expect(review.status).toBe(201);
    expect(review.body.review.moderationStatus).toBe("pending");
  });
});

describe("KAMLE AI chat", () => {
  it("asks for the location when it is missing", async () => {
    const res = await request(app).post("/api/chat/message").send({ message: "My refrigerator is not cooling" });
    expect(res.status).toBe(200);
    expect(res.body.requirements.service_category).toBe("Appliance Repair");
    expect(res.body.requirements.search_ready).toBe(false);
    expect(res.body.workers).toHaveLength(0);
  });

  it("returns grounded worker results once the location is known", async () => {
    const first = await request(app).post("/api/chat/message").send({ message: "My refrigerator is not cooling" });
    const sessionKey = first.body.sessionKey;
    const res = await request(app).post("/api/chat/message").send({ sessionKey, message: "Kolhapur" });
    expect(res.status).toBe(200);
    expect(res.body.requirements.search_ready).toBe(true);
    expect(res.body.requirements.location).toBe("Kolhapur");
    expect(res.body.workers.length).toBeGreaterThan(0);
    expect(res.body.workers[0].name).toBeTruthy();
    expect(res.body.workers[0].reasons.length).toBeGreaterThan(0);
  });
});
