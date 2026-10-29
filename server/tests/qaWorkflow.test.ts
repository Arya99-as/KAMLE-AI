import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";
import User from "../src/models/User.js";
import { hashPassword } from "../src/utils/password.js";

let app: Express;
let adminToken = "";
let customerToken = "";
let workerToken = "";
let workerUserId = "";
let workerProfileId = "";

const validProfile = {
  professionalDescription: "Experienced electrician with wiring and switchboard repair expertise.",
  serviceCategories: ["Electrical"],
  skills: ["Wiring & Rewiring"],
  experienceYears: 5,
  experienceSummary: "Wired 200+ homes.",
  serviceAreas: ["Kolhapur"],
  pricing: { type: "quote", currency: "INR", note: "Quote before work." },
  availability: { availableNow: true, days: ["Mon"] },
  consent: true,
};

async function registerAndApproveWorker(phone: string, email: string) {
  const reg = await request(app).post("/api/auth/register").send({
    name: `QA Worker ${email}`,
    phone,
    email,
    password: "Password123",
    role: "worker",
  });
  const token = reg.body.token;
  const userId = reg.body.user.id;
  const profile = await request(app)
    .post("/api/workers/profile")
    .set("Authorization", `Bearer ${token}`)
    .send(validProfile);
  const approval = await request(app)
    .patch(`/api/admin/workers/${profile.body.workerProfile._id}/approval`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ decision: "approved" });
  expect(approval.status).toBe(200);
  return { token, userId, profileId: String(profile.body.workerProfile._id) };
}

async function registerCustomer(phone: string, email: string) {
  const reg = await request(app).post("/api/auth/register").send({
    name: `QA Customer ${email}`,
    phone,
    email,
    password: "Password123",
    role: "customer",
  });
  return { token: reg.body.token, userId: reg.body.user.id };
}

beforeAll(async () => {
  await connectDB();
  app = createApp();

  const admin = await User.create({
    name: "QA Admin",
    phone: "9700000993",
    email: "qaadmin@example.com",
    passwordHash: await hashPassword("Password123"),
    role: "admin",
    accountStatus: "active",
  });
  const adminLogin = await request(app).post("/api/auth/login").send({ identifier: "9700000993", password: "Password123" });
  adminToken = adminLogin.body.token;

  const w1 = await registerAndApproveWorker("9700000991", "qaworker1@example.com");
  workerToken = w1.token;
  workerUserId = w1.userId;
  workerProfileId = w1.profileId;

  const c1 = await registerCustomer("9700000992", "qacustomer1@example.com");
  customerToken = c1.token;
});

afterAll(async () => {
  await disconnectDB();
});

describe("QA: worker rejection and acceptance job flow", () => {
  it("allows a worker to reject a customer job request", async () => {
    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Electrical",
        problemDescription: "Main distribution board keeps tripping repeatedly.",
        location: "Kolhapur",
      });
    expect(created.status).toBe(201);

    const rejected = await request(app)
      .patch(`/api/enquiries/${created.body.enquiry._id}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "REJECTED", note: "Currently unavailable" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.enquiry.status).toBe("REJECTED");
  });

  it("runs accept -> in progress -> complete -> confirm with amount validation", async () => {
    const w = await registerAndApproveWorker("9700001003", "qaworker5@example.com");
    const c = await registerCustomer("9700001004", "qacustomer7@example.com");

    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${c.token}`)
      .send({
        workerId: w.userId,
        serviceCategory: "Electrical",
        problemDescription: "Ceiling fan regulator switch is faulty.",
        location: "Kolhapur",
      });
    expect(created.status).toBe(201);
    const enquiryId = created.body.enquiry._id;

    const accept = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${w.token}`)
      .send({ status: "ACCEPTED" });
    expect(accept.status).toBe(200);
    expect(accept.body.enquiry.status).toBe("ACCEPTED");

    const start = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${w.token}`)
      .send({ status: "IN_PROGRESS" });
    expect(start.status).toBe(200);

    const complete = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${w.token}`)
      .send({ status: "COMPLETED", serviceAmount: 1000 });
    expect(complete.status).toBe(200);
    expect(complete.body.enquiry.serviceAmount).toBe(1000);

    const confirm = await request(app)
      .post(`/api/enquiries/${enquiryId}/confirm`)
      .set("Authorization", `Bearer ${c.token}`);
    expect(confirm.status).toBe(200);
    expect(confirm.body.enquiry.clientConfirmedAt).toBeTruthy();
  });

  it("rejects an admin dispute resolution for a non-disputed enquiry", async () => {
    const w2 = await registerAndApproveWorker("9700000995", "qaworker2@example.com");
    const c2 = await registerCustomer("9700000996", "qacustomer2@example.com");

    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${c2.token}`)
      .send({
        workerId: w2.userId,
        serviceCategory: "Electrical",
        problemDescription: "Fan switch is not working.",
        location: "Kolhapur",
      });
    expect(created.status).toBe(201);

    const dispute = await request(app)
      .post(`/api/admin/enquiries/${created.body.enquiry._id}/resolve-dispute`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ resolution: "COMPLETED" });
    expect(dispute.status).toBe(400);
  });
});

describe("QA: payments, commission and payout handling", () => {
  it("runs the completed-work payment flow with commission, idempotency and payout guards", async () => {
    const w = await registerAndApproveWorker("9700001005", "qaworker6@example.com");
    const c = await registerCustomer("9700001006", "qacustomer8@example.com");

    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${c.token}`)
      .send({
        workerId: w.userId,
        serviceCategory: "Electrical",
        problemDescription: "Wiring inside the junction box is damaged.",
        location: "Kolhapur",
        serviceAmount: 1000,
      });
    expect(created.status).toBe(201);
    const enquiryId = created.body.enquiry._id;

    const earlyOrder = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ enquiryId });
    expect(earlyOrder.status).toBe(400);

    const accept = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${w.token}`)
      .send({ status: "ACCEPTED" });
    expect(accept.status).toBe(200);

    const complete = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${w.token}`)
      .send({ status: "COMPLETED", serviceAmount: 1000 });
    expect(complete.status).toBe(200);

    const confirm = await request(app)
      .post(`/api/enquiries/${enquiryId}/confirm`)
      .set("Authorization", `Bearer ${c.token}`);
    expect(confirm.status).toBe(200);

    const config = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ commissionPercent: 10 });
    expect(config.status).toBe(200);

    const order = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ enquiryId });
    expect(order.status).toBe(201);
    expect(order.body.order.provider).toBe("mock");
    expect(order.body.order.amount).toBe(1000);
    expect(order.body.order.commissionPercent).toBe(10);
    expect(order.body.order.commissionAmount).toBe(100);
    expect(order.body.order.workerPayableAmount).toBe(900);

    const verify = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ providerOrderId: order.body.order.orderId });
    expect(verify.status).toBe(200);
    expect(verify.body.payment.status).toBe("COMPLETED");
    expect(verify.body.payout.status).toBe("PENDING");
    expect(verify.body.payout.workerPayableAmount).toBe(900);
    const payoutId = verify.body.payout._id;

    const replay = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ providerOrderId: order.body.order.orderId });
    expect(replay.status).toBe(200);

    const duplicateOrder = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ enquiryId });
    expect(duplicateOrder.status).toBe(400);

    const payoutMissingRef = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID" });
    expect(payoutMissingRef.status).toBe(400);

    const payoutPaid = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID", providerPayoutRef: "UTR_QA_123" });
    expect(payoutPaid.status).toBe(200);
    expect(payoutPaid.body.payout.status).toBe("PAID");
    expect(payoutPaid.body.payout.paidAt).toBeTruthy();

    const payoutReplay = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID", providerPayoutRef: "UTR_QA_123" });
    expect(payoutReplay.status).toBe(409);
  });
});

describe("QA: reviews and duplicate prevention", () => {
  it("allows a review after completion and prevents duplicates", async () => {
    const w = await registerAndApproveWorker("9700001007", "qaworker7@example.com");
    const c = await registerCustomer("9700001008", "qacustomer9@example.com");

    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${c.token}`)
      .send({
        workerId: w.userId,
        serviceCategory: "Electrical",
        problemDescription: "Tap light wiring is faulty.",
        location: "Kolhapur",
      });
    expect(created.status).toBe(201);
    const enquiryId = created.body.enquiry._id;

    const accept = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${w.token}`)
      .send({ status: "ACCEPTED" });
    expect(accept.status).toBe(200);

    const complete = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${w.token}`)
      .send({ status: "COMPLETED" });
    expect(complete.status).toBe(200);

    const firstReview = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ workerId: w.userId, enquiryId, rating: 5, comment: "Great work" });
    expect(firstReview.status).toBe(201);

    const secondReview = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${c.token}`)
      .send({ workerId: w.userId, enquiryId, rating: 4, comment: "Again" });
    expect(secondReview.status).toBe(409);
  });
});

describe("QA: API error handling", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/definitely-not-a-route");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid enquiry payloads", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Electrical",
        problemDescription: "Hi",
        location: "Kolhapur",
      });
    expect(res.status).toBe(400);
  });

  it("returns 401 when payment creation is unauthenticated", async () => {
    const res = await request(app).post("/api/payments/create-order").send({ enquiryId: "507f1f77bcf86cd799439011" });
    expect(res.status).toBe(401);
  });
});

describe("QA: security-critical authorization", () => {
  it("forbids a worker from creating a service request", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Electrical",
        problemDescription: "Worker trying to request work for someone else.",
        location: "Kolhapur",
      });
    expect(res.status).toBe(403);
  });

  it("forbids a customer from paying for another customer's enquiry", async () => {
    const owner = await registerCustomer("9700001010", "qacustomer10@example.com");
    const other = await registerCustomer("9700001011", "qacustomer11@example.com");
    const w = await registerAndApproveWorker("9700001012", "qaworker8@example.com");

    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        workerId: w.userId,
        serviceCategory: "Electrical",
        problemDescription: "Customer A requesting electrical repair.",
        location: "Kolhapur",
      });
    expect(created.status).toBe(201);

    const payAsOther = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ enquiryId: created.body.enquiry._id });
    expect(payAsOther.status).toBe(403);
  });

  it("forbids a non-admin from updating payout status", async () => {
    const res = await request(app)
      .patch("/api/admin/payouts/507f1f77bcf86cd799439011/status")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "PAID", providerPayoutRef: "X" });
    expect(res.status).toBe(403);
  });
});
