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
let workerUserId = "";
let workerProfileId = "";
let enquiryId = "";
let orderId = "";
let payoutId = "";

const validProfile = {
  professionalDescription: "Experienced appliance repair technician with a decade of hands-on refrigerator and washing machine service experience.",
  serviceCategories: ["Appliance Repair"],
  skills: ["Refrigerator Repair"],
  experienceYears: 8,
  experienceSummary: "Repaired 800+ appliances.",
  serviceAreas: ["Kolhapur"],
  pricing: { type: "quote", currency: "INR", note: "Quote before repair." },
  availability: { availableNow: true, days: ["Mon", "Tue"] },
  consent: true,
};

beforeAll(async () => {
  await connectDB();
  app = createApp();

  const workerReg = await request(app).post("/api/auth/register").send({
    name: "Payment Worker",
    phone: "9600000301",
    email: "paymentworker@example.com",
    password: "Password123",
    role: "worker",
  });
  workerToken = workerReg.body.token;
  workerUserId = workerReg.body.user.id;

  const customerReg = await request(app).post("/api/auth/register").send({
    name: "Payment Customer",
    phone: "9600000302",
    email: "paymentcustomer@example.com",
    password: "Password123",
    role: "customer",
  });
  customerToken = customerReg.body.token;

  await User.create({
    name: "Payment Admin",
    phone: "9600000303",
    email: "paymentadmin@example.com",
    passwordHash: await hashPassword("Password123"),
    role: "admin",
    accountStatus: "active",
  });
  const adminLogin = await request(app).post("/api/auth/login").send({ identifier: "9600000303", password: "Password123" });
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
  await disconnectDB();
});

describe("payments, commission and payouts", () => {
  it("creates a service request", async () => {
    const res = await request(app)
      .post("/api/enquiries")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        workerId: workerUserId,
        serviceCategory: "Appliance Repair",
        problemDescription: "Refrigerator is not cooling and makes a loud noise.",
        location: "Kolhapur",
      });
    expect(res.status).toBe(201);
    enquiryId = res.body.enquiry._id;
  });

  it("refuses payment before the work is marked completed", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId });
    expect(res.status).toBe(400);
  });

  it("lets the worker accept, start and complete the job with a final amount", async () => {
    const accept = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "ACCEPTED" });
    expect(accept.status).toBe(200);

    const start = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "IN_PROGRESS" });
    expect(start.status).toBe(200);

    const complete = await request(app)
      .patch(`/api/enquiries/${enquiryId}/status`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ status: "COMPLETED", serviceAmount: 1000, note: "Replaced the compressor relay." });
    expect(complete.status).toBe(200);
    expect(complete.body.enquiry.serviceAmount).toBe(1000);
  });

  it("lets the customer confirm completion", async () => {
    const res = await request(app)
      .post(`/api/enquiries/${enquiryId}/confirm`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.enquiry.clientConfirmedAt).toBeTruthy();
  });

  it("uses the admin-configured commission rate and ignores a client-supplied amount", async () => {
    const config = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ commissionPercent: 12 });
    expect(config.status).toBe(200);

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId, amount: 1 });
    expect(res.status).toBe(201);
    expect(res.body.order.provider).toBe("mock");
    expect(res.body.order.amount).toBe(1000);
    expect(res.body.order.commissionPercent).toBe(12);
    expect(res.body.order.commissionAmount).toBe(120);
    expect(res.body.order.workerPayableAmount).toBe(880);
    orderId = res.body.order.orderId;
  });

  it("verifies the payment and creates a pending payout", async () => {
    const res = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ providerOrderId: orderId });
    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("COMPLETED");
    expect(res.body.payout.status).toBe("PENDING");
    expect(res.body.payout.workerPayableAmount).toBe(880);
    payoutId = res.body.payout._id;

    const enquiry = await request(app)
      .get(`/api/enquiries/${enquiryId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(enquiry.body.enquiry.paymentStatus).toBe("PAID");
  });

  it("reflects the net earnings for the worker", async () => {
    const res = await request(app).get("/api/payments/worker-earnings").set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.totalGrossEarnings).toBe(1000);
    expect(res.body.stats.totalCommissionDeducted).toBe(120);
    expect(res.body.stats.netPayable).toBe(880);
    expect(res.body.stats.pendingPayouts).toBe(880);
  });

  it("requires a payout reference before marking a payout PAID", async () => {
    const missing = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID" });
    expect(missing.status).toBe(400);

    const paid = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID", providerPayoutRef: "UTR_TEST_123" });
    expect(paid.status).toBe(200);
    expect(paid.body.payout.status).toBe("PAID");
    expect(paid.body.payout.paidAt).toBeTruthy();
  });

  it("prevents duplicate payout processing", async () => {
    const res = await request(app)
      .patch(`/api/admin/payouts/${payoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID", providerPayoutRef: "UTR_TEST_123" });
    expect(res.status).toBe(409);
  });

  it("reports payment, commission and payout totals in the admin dashboard", async () => {
    const res = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.paymentsReceived).toBeGreaterThanOrEqual(1);
    expect(res.body.stats.totalVolume).toBeGreaterThanOrEqual(1000);
    expect(res.body.stats.totalCommission).toBeGreaterThanOrEqual(120);
    expect(res.body.stats.totalPayoutsPaid).toBeGreaterThanOrEqual(880);
    expect(res.body.stats.completedRequests).toBeGreaterThanOrEqual(1);
  });
});
