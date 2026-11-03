import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";
import env from "../src/config/env.js";
import User from "../src/models/User.js";
import WorkerProfile from "../src/models/WorkerProfile.js";
import Payment from "../src/models/Payment.js";
import Payout from "../src/models/Payout.js";
import WebhookEvent from "../src/models/WebhookEvent.js";
import ServiceCategory from "../src/models/ServiceCategory.js";
import { handlePaymentWebhook } from "../src/services/paymentService.js";
import { hashPassword } from "../src/utils/password.js";

let app: Express;
let customerToken = "";
let customerId = "";
let workerToken = "";
let workerUserId = "";
let workerProfileId = "";
let adminToken = "";

const validProfile = {
  professionalDescription:
    "Regression-test technician covering appliance and plumbing jobs with verified local experience.",
  serviceCategories: ["Appliance Repair"],
  skills: ["Refrigerator Repair"],
  experienceYears: 5,
  experienceSummary: "Handled hundreds of local repairs.",
  serviceAreas: ["Kolhapur"],
  pricing: { type: "quote", currency: "INR", note: "Quote before repair." },
  availability: { availableNow: true, days: ["Mon", "Tue"] },
  consent: true,
};

const paymentsEnv = env.payments as unknown as { provider: string; webhookSecret: string };
const originalProvider = paymentsEnv.provider;
const originalWebhookSecret = paymentsEnv.webhookSecret;

const documentFile = "regression-doc.pdf";
const documentsDir = path.resolve(process.cwd(), env.uploadDir, "documents");

beforeAll(async () => {
  await connectDB();
  app = createApp();

  const customerReg = await request(app).post("/api/auth/register").send({
    name: "Regression Customer",
    phone: "9800000401",
    email: "regressioncustomer@example.com",
    password: "Password123",
    role: "customer",
  });
  customerToken = customerReg.body.token;
  customerId = customerReg.body.user.id;

  const workerReg = await request(app).post("/api/auth/register").send({
    name: "Regression Worker",
    phone: "9800000402",
    email: "regressionworker@example.com",
    password: "Password123",
    role: "worker",
  });
  workerToken = workerReg.body.token;
  workerUserId = workerReg.body.user.id;

  await User.create({
    name: "Regression Admin",
    phone: "9800000403",
    email: "regressionadmin@example.com",
    passwordHash: await hashPassword("Password123"),
    role: "admin",
    accountStatus: "active",
  });
  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "9800000403", password: "Password123" });
  adminToken = adminLogin.body.token;

  const profile = await request(app)
    .post("/api/workers/profile")
    .set("Authorization", `Bearer ${workerToken}`)
    .send(validProfile);
  workerProfileId = profile.body.workerProfile._id;

  await request(app)
    .patch(`/api/admin/workers/${workerProfileId}/approval`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ decision: "approved" })
    .expect(200);
});

afterAll(async () => {
  paymentsEnv.provider = originalProvider;
  paymentsEnv.webhookSecret = originalWebhookSecret;
  fs.rmSync(path.join(documentsDir, documentFile), { force: true });
  await disconnectDB();
});

describe("enquiry status transition fixes", () => {
  let enquiryId = "";

  it("creates a service request", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Appliance Repair",
        problemDescription: "The refrigerator stopped cooling after a power surge.",
        location: "Kolhapur",
      });
    expect(res.status).toBe(201);
    enquiryId = res.body.enquiry._id;
  });

  it("validates the amount against the pre-mutation status (ACCEPTED is allowed)", async () => {
    await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "ACCEPTED" })
      .expect(200);

    // ACCEPTED -> IN_PROGRESS used to be rejected because the handler validated
    // the amount after overwriting the status to IN_PROGRESS.
    const res = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "IN_PROGRESS", serviceAmount: 400 });
    expect(res.status).toBe(200);
    expect(res.body.enquiry.status).toBe("IN_PROGRESS");
    expect(res.body.enquiry.serviceAmount).toBe(400);
  });

  it("increments completedEnquiries when an admin resolves an IN_PROGRESS dispute", async () => {
    const dispute = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "DISPUTED", disputeReason: "Worker left the job unfinished." });
    expect(dispute.status).toBe(200);

    const before = await WorkerProfile.findOne({ userId: workerUserId }).lean();
    expect(before?.completedEnquiries ?? 0).toBe(0);

    const resolved = await request(app)
      .post(`/api/admin/enquiries/${enquiryId}/resolve-dispute`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ resolution: "COMPLETED", note: "Verified the work was actually finished." });
    expect(resolved.status).toBe(200);
    expect(resolved.body.enquiry.status).toBe("COMPLETED");

    const after = await WorkerProfile.findOne({ userId: workerUserId }).lean();
    expect(after?.completedEnquiries).toBe(1);
  });

  it("does not double-count when a customer resolves their own dispute", async () => {
    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Appliance Repair",
        problemDescription: "Second job for the completion counter regression.",
        location: "Kolhapur",
      });
    expect(created.status).toBe(201);
    const secondId = created.body.enquiry._id;

    await request(app)
      .patch(`/api/enquiries/${secondId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "ACCEPTED" })
      .expect(200);
    await request(app)
      .patch(`/api/enquiries/${secondId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "IN_PROGRESS" })
      .expect(200);
    await request(app)
      .patch(`/api/enquiries/${secondId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "COMPLETED", serviceAmount: 600 })
      .expect(200);

    let profile = await WorkerProfile.findOne({ userId: workerUserId }).lean();
    expect(profile?.completedEnquiries).toBe(2);

    await request(app)
      .patch(`/api/enquiries/${secondId}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "DISPUTED", disputeReason: "Amount seems too high." })
      .expect(200);

    await request(app)
      .patch(`/api/enquiries/${secondId}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "COMPLETED", note: "Resolved with the worker directly." })
      .expect(200);

    profile = await WorkerProfile.findOne({ userId: workerUserId }).lean();
    expect(profile?.completedEnquiries).toBe(2);
  });
});

describe("private verification documents", () => {
  beforeAll(async () => {
    fs.mkdirSync(documentsDir, { recursive: true });
    fs.writeFileSync(path.join(documentsDir, documentFile), "%PDF-1.4 regression test document");
    await WorkerProfile.updateOne(
      { _id: workerProfileId },
      { $set: { verificationDocuments: [{ label: "ID proof", url: `/uploads/documents/${documentFile}` }] } },
    );
  });

  it("does not expose documents through the public uploads mount", async () => {
    const res = await request(app).get(`/uploads/documents/${documentFile}`);
    expect(res.status).toBe(404);
  });

  it("requires authentication for the admin document endpoint", async () => {
    const res = await request(app).get(`/api/admin/workers/${workerProfileId}/documents/0`);
    expect(res.status).toBe(401);
  });

  it("blocks non-admin users from reading verification documents", async () => {
    const res = await request(app)
      .get(`/api/admin/workers/${workerProfileId}/documents/0`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it("streams the document to an authenticated admin", async () => {
    const res = await request(app)
      .get(`/api/admin/workers/${workerProfileId}/documents/0`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["cache-control"]).toContain("no-store");
  });
});

describe("categories and audit logging", () => {
  let categoryId = "";

  it("creates a category and records an audit entry", async () => {
    const res = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Regression Plumbing", description: "Test category", icon: "wrench" });
    expect(res.status).toBe(201);
    categoryId = res.body.category._id;
    expect(res.body.category.isActive).toBe(true);

    const logs = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(logs.status).toBe(200);
    expect(logs.body.items.some((l: { action: string; targetId?: string }) => l.action === "category.create" && l.targetId === categoryId)).toBe(true);
  });

  it("persists isActive changes made by an admin", async () => {
    const res = await request(app)
      .patch(`/api/admin/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.category.isActive).toBe(false);

    const stored = await ServiceCategory.findById(categoryId).lean();
    expect(stored?.isActive).toBe(false);

    const logs = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(logs.body.items.some((l: { action: string; targetId?: string }) => l.action === "category.update" && l.targetId === categoryId)).toBe(true);
  });

  it("rejects duplicate category slugs", async () => {
    const res = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Regression Plumbing", description: "Duplicate" });
    expect(res.status).toBe(409);
  });

  it("blocks non-admins from reading the audit log", async () => {
    const res = await request(app)
      .get("/api/admin/audit-logs")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

describe("review duplication rules", () => {
  async function completeJob(description: string): Promise<string> {
    const created = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Appliance Repair",
        problemDescription: description,
        location: "Kolhapur",
      });
    expect(created.status).toBe(201);
    const id = created.body.enquiry._id;

    await request(app).patch(`/api/enquiries/${id}/status`).set("Authorization", `Bearer ${workerToken}`).send({ status: "ACCEPTED" }).expect(200);
    await request(app).patch(`/api/enquiries/${id}/status`).set("Authorization", `Bearer ${workerToken}`).send({ status: "IN_PROGRESS" }).expect(200);
    await request(app).patch(`/api/enquiries/${id}/status`).set("Authorization", `Bearer ${workerToken}`).send({ status: "COMPLETED", serviceAmount: 300 }).expect(200);
    return id as string;
  }

  it("allows one review per completed job and blocks duplicates for the same job", async () => {
    const firstJob = await completeJob("Review rule job one.");
    const secondJob = await completeJob("Review rule job two.");

    const firstReview = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: workerUserId, enquiryId: firstJob, rating: 5, comment: "First completed job." });
    expect(firstReview.status).toBe(201);

    const duplicate = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: workerUserId, enquiryId: firstJob, rating: 4, comment: "Trying to review the same job twice." });
    expect(duplicate.status).toBe(409);

    const secondReview = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ workerId: workerUserId, enquiryId: secondJob, rating: 4, comment: "Second completed job." });
    expect(secondReview.status).toBe(201);
    expect(secondReview.body.review.enquiryId).toBe(secondJob);
  });
});

describe("payment webhook idempotency", () => {
  const orderId = "order_regression_webhook_1";
  const paymentId = "pay_regression_webhook_1";
  const eventId = "evt_regression_webhook_1";
  let rawBody = "";

  beforeAll(async () => {
    paymentsEnv.provider = "razorpay";
    paymentsEnv.webhookSecret = "test_webhook_secret_regression";

    const enquiry = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Appliance Repair",
        problemDescription: "Webhook settlement regression job.",
        location: "Kolhapur",
      });

    await Payment.create({
      enquiryId: enquiry.body.enquiry._id,
      customerId,
      workerId: workerUserId,
      amount: 500,
      currency: "INR",
      commissionPercent: 10,
      commissionAmount: 50,
      workerPayableAmount: 450,
      provider: "razorpay",
      providerOrderId: orderId,
      transactionRef: "tx_regression_webhook_1",
      status: "PENDING",
    });

    rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: orderId, method: "upi" } } },
    });
  });

  function sign(body: string): string {
    return crypto.createHmac("sha256", paymentsEnv.webhookSecret).update(body).digest("hex");
  }

  it("rejects a webhook with an invalid signature", async () => {
    await expect(handlePaymentWebhook(Buffer.from(rawBody), "deadbeef", eventId)).rejects.toThrow();
    expect(await WebhookEvent.countDocuments({ eventId })).toBe(0);
  });

  it("processes a valid webhook once and creates a single payout", async () => {
    const first = await handlePaymentWebhook(Buffer.from(rawBody), sign(rawBody), eventId);
    expect(first.processed).toBe(true);
    expect(first.alreadyProcessed).toBe(false);

    const payment = await Payment.findOne({ providerOrderId: orderId }).lean();
    expect(payment?.status).toBe("COMPLETED");
    expect(await Payout.countDocuments({ paymentId: payment?._id })).toBe(1);
  });

  it("ignores a duplicate delivery of the same event id", async () => {
    const second = await handlePaymentWebhook(Buffer.from(rawBody), sign(rawBody), eventId);
    expect(second.duplicate).toBe(true);

    const payment = await Payment.findOne({ providerOrderId: orderId }).lean();
    expect(await Payout.countDocuments({ paymentId: payment?._id })).toBe(1);
    expect(await WebhookEvent.countDocuments({ eventId, processed: true })).toBe(1);
  });

  it("stays idempotent even when the provider retries under a new event id", async () => {
    const third = await handlePaymentWebhook(Buffer.from(rawBody), sign(rawBody), "evt_regression_webhook_2");
    expect(third.alreadyProcessed).toBe(true);

    const payment = await Payment.findOne({ providerOrderId: orderId }).lean();
    expect(await Payout.countDocuments({ paymentId: payment?._id })).toBe(1);
  });
});
