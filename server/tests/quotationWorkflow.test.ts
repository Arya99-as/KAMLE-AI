import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { createApp } from "../src/app.js";
import User from "../src/models/User.js";
import Payment from "../src/models/Payment.js";
import Quotation from "../src/models/Quotation.js";
import Enquiry from "../src/models/Enquiry.js";
import { hashPassword } from "../src/utils/password.js";

let app: Express;

let adminToken = "";
let workerToken = "";
let otherWorkerToken = "";
let customerToken = "";
let otherCustomerToken = "";

let workerUserId = "";
let otherWorkerUserId = "";
let customerUserId = "";

const COMMISSION_PERCENT = 15;

const mainBreakdown = {
  labourCharges: 5000,
  materialCharges: 1000,
  additionalCharges: [
    { description: "Replacement valve", amount: 250 },
    { description: "Disposal of old parts", amount: 300 },
  ],
  estimatedCompletionTime: "2 working days",
  notes: "Includes testing after installation.",
};

const expectedTotal = 6550;
const expectedCommission = Math.round((expectedTotal * COMMISSION_PERCENT) / 100);
const expectedWorkerPayable = expectedTotal - expectedCommission;

function futureDate(days = 7): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function quotationPayload(overrides: Record<string, unknown> = {}) {
  return {
    ...mainBreakdown,
    validUntil: futureDate(),
    ...overrides,
  };
}

async function registerWorker(name: string, phone: string, email: string) {
  const res = await request(app).post("/api/auth/register").send({
    name,
    phone,
    email,
    password: "Password123",
    role: "worker",
  });
  expect(res.status).toBe(201);
  const token = res.body.token as string;
  const userId = res.body.user.id as string;

  const profile = await request(app)
    .post("/api/workers/profile")
    .set("Authorization", `Bearer ${token}`)
    .send({
      professionalDescription: "Experienced home repair professional with plumbing and appliance expertise.",
      serviceCategories: ["Plumbing"],
      skills: ["Pipe repair"],
      experienceYears: 6,
      experienceSummary: "Completed 400+ jobs.",
      serviceAreas: ["Kolhapur"],
      pricing: { type: "quote", currency: "INR" },
      availability: { availableNow: true, days: ["Mon", "Tue"] },
      consent: true,
    });
  expect(profile.status).toBe(201);

  await request(app)
    .patch(`/api/admin/workers/${profile.body.workerProfile._id}/approval`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ decision: "approved" })
    .expect(200);

  return { token, userId };
}

async function registerCustomer(name: string, phone: string, email: string) {
  const res = await request(app).post("/api/auth/register").send({
    name,
    phone,
    email,
    password: "Password123",
    role: "customer",
  });
  expect(res.status).toBe(201);
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

async function createEnquiry(workerId: string, description: string) {
  const res = await request(app)
    .post("/api/enquiries")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      workerId,
      serviceCategory: "Plumbing",
      problemDescription: description,
      location: "Kolhapur",
    });
  expect(res.status).toBe(201);
  return res.body.enquiry._id as string;
}

/** Frees the customer/worker pair so the next scenario can raise a new enquiry. */
async function closeEnquiry(enquiryId: string) {
  await Enquiry.updateOne({ _id: enquiryId }, { $set: { status: "CANCELLED" } });
}

async function submitApprovedQuotation(enquiryId: string) {
  const created = await request(app)
    .post("/api/quotations")
    .set("Authorization", `Bearer ${workerToken}`)
    .send({ enquiryId, ...quotationPayload() });
  expect(created.status).toBe(201);

  const submitted = await request(app)
    .post(`/api/quotations/${created.body.quotation._id}/submit`)
    .set("Authorization", `Bearer ${workerToken}`);
  expect(submitted.status).toBe(200);

  const approved = await request(app)
    .post(`/api/admin/quotations/${created.body.quotation._id}/decision`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ decision: "approve", remarks: "Price is fair for the scope." });
  expect(approved.status).toBe(200);

  return created.body.quotation._id as string;
}

beforeAll(async () => {
  await connectDB();
  app = createApp();

  await User.create({
    name: "Quotation Admin",
    phone: "9700000401",
    email: "quotationadmin@example.com",
    passwordHash: await hashPassword("Password123"),
    role: "admin",
    accountStatus: "active",
  });
  const adminLogin = await request(app)
    .post("/api/auth/login")
    .send({ identifier: "9700000401", password: "Password123" });
  adminToken = adminLogin.body.token;

  const worker = await registerWorker("Quotation Worker", "9700000402", "quotationworker@example.com");
  workerToken = worker.token;
  workerUserId = worker.userId;

  const otherWorker = await registerWorker("Other Quote Worker", "9700000403", "otherquoteworker@example.com");
  otherWorkerToken = otherWorker.token;
  otherWorkerUserId = otherWorker.userId;

  const customer = await registerCustomer("Quotation Customer", "9700000404", "quotationcustomer@example.com");
  customerToken = customer.token;
  customerUserId = customer.userId;

  const otherCustomer = await registerCustomer("Other Quote Customer", "9700000405", "otherquotecustomer@example.com");
  otherCustomerToken = otherCustomer.token;

  const config = await request(app)
    .put("/api/admin/config")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ commissionPercent: COMMISSION_PERCENT });
  expect(config.status).toBe(200);
  expect(config.body.config.commissionPercent).toBe(COMMISSION_PERCENT);
});

afterAll(async () => {
  await disconnectDB();
});

describe("worker quotation and admin approval workflow", () => {
  let mainEnquiryId = "";
  let mainQuotationId = "";
  let mainOrderId = "";
  let mainPaymentId = "";
  let mainPayoutId = "";

  it("lets the assigned worker create a quotation with a server-computed total", async () => {
    mainEnquiryId = await createEnquiry(workerUserId, "Kitchen sink is leaking under the cabinet and needs a new valve.");

    const res = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({
        enquiryId: mainEnquiryId,
        ...quotationPayload(),
        total: 1,
        approvedAmount: 1,
        subtotal: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.quotation.status).toBe("DRAFT");
    expect(res.body.quotation.subtotal).toBe(expectedTotal);
    expect(res.body.quotation.total).toBe(expectedTotal);
    expect(res.body.quotation.approvedAmount).toBeUndefined();
    expect(String((res.body.quotation.customerId as { _id?: string })._id ?? res.body.quotation.customerId)).toBe(
      customerUserId,
    );
    expect(String((res.body.quotation.workerId as { _id?: string })._id ?? res.body.quotation.workerId)).toBe(
      workerUserId,
    );
    mainQuotationId = res.body.quotation._id;
  });

  it("prevents a worker from quoting an enquiry assigned to someone else", async () => {
    const res = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${otherWorkerToken}`)
      .send({ enquiryId: mainEnquiryId, ...quotationPayload() });
    expect(res.status).toBe(403);
  });

  it("lets the worker submit the quotation for admin review", async () => {
    const res = await request(app)
      .post(`/api/quotations/${mainQuotationId}/submit`)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.quotation.status).toBe("SUBMITTED");
    expect(res.body.quotation.history.some((event: { status: string }) => event.status === "SUBMITTED")).toBe(true);
  });

  it("blocks customer payment until an admin approves the quotation", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId: mainEnquiryId });
    expect(res.status).toBe(400);
    expect(String(res.body.error?.message)).toMatch(/approved/i);
  });

  it("rejects approval attempts from non-admin roles", async () => {
    const asCustomer = await request(app)
      .post(`/api/admin/quotations/${mainQuotationId}/decision`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ decision: "approve" });
    expect(asCustomer.status).toBe(403);

    const asWorker = await request(app)
      .post(`/api/admin/quotations/${mainQuotationId}/decision`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ decision: "approve" });
    expect(asWorker.status).toBe(403);
  });

  it("lets the admin see the quotation in the review queue", async () => {
    const res = await request(app)
      .get("/api/admin/quotations?status=SUBMITTED")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.some((item: { _id: string }) => item._id === mainQuotationId)).toBe(true);
  });

  it("records admin approval with admin ID, timestamp and an immutable amount", async () => {
    const res = await request(app)
      .post(`/api/admin/quotations/${mainQuotationId}/decision`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "approve", remarks: "Approved after checking the breakdown." });

    expect(res.status).toBe(200);
    expect(res.body.quotation.status).toBe("APPROVED");
    expect(res.body.quotation.approvedAmount).toBe(expectedTotal);
    expect(res.body.quotation.approvedAt).toBeTruthy();
    expect(res.body.quotation.approvedBy).toBeTruthy();
    expect(res.body.quotation.adminRemarks).toContain("Approved");
    expect(res.body.quotation.history.some((event: { status: string }) => event.status === "APPROVED")).toBe(true);
  });

  it("audit-logs the approval decision", async () => {
    const res = await request(app)
      .get("/api/admin/audit-logs?action=quotation.approve")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(
      res.body.items.some(
        (log: { action: string; targetId: string; adminId: unknown }) =>
          log.action === "quotation.approve" && log.targetId === mainQuotationId && Boolean(log.adminId),
      ),
    ).toBe(true);
  });

  it("prevents the worker from modifying an approved quotation", async () => {
    const patch = await request(app)
      .patch(`/api/quotations/${mainQuotationId}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send(quotationPayload({ labourCharges: 1 }));
    expect(patch.status).toBe(400);

    const replace = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ enquiryId: mainEnquiryId, ...quotationPayload({ labourCharges: 1 }) });
    expect(replace.status).toBe(409);

    const stored = await Quotation.findById(mainQuotationId).lean();
    expect(stored?.total).toBe(expectedTotal);
    expect(stored?.approvedAmount).toBe(expectedTotal);
  });

  it("lets the customer view only their own quotation", async () => {
    const own = await request(app)
      .get(`/api/quotations/${mainQuotationId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(own.status).toBe(200);
    expect(own.body.quotation._id).toBe(mainQuotationId);

    const other = await request(app)
      .get(`/api/quotations/${mainQuotationId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`);
    expect(other.status).toBe(403);

    const list = await request(app)
      .get("/api/quotations/my")
      .set("Authorization", `Bearer ${otherCustomerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((item: { _id: string }) => item._id === mainQuotationId)).toBe(false);
  });

  it("requires the customer to accept the approved quotation before paying", async () => {
    const tooEarly = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId: mainEnquiryId });
    expect(tooEarly.status).toBe(400);
    expect(String(tooEarly.body.error?.message)).toMatch(/accept/i);

    const accepted = await request(app)
      .post(`/api/quotations/${mainQuotationId}/respond`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ response: "accept" });
    expect(accepted.status).toBe(200);
    expect(accepted.body.quotation.customerStatus).toBe("ACCEPTED");
    expect(accepted.body.quotation.respondedAt).toBeTruthy();
  });

  it("creates a payment order for the approved amount and snapshots commission", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId: mainEnquiryId, amount: 1 });

    expect(res.status).toBe(201);
    expect(res.body.order.amount).toBe(expectedTotal);
    expect(res.body.order.approvedAmount).toBe(expectedTotal);
    expect(res.body.order.quotationId).toBe(mainQuotationId);
    expect(res.body.order.commissionPercent).toBe(COMMISSION_PERCENT);
    expect(res.body.order.commissionAmount).toBe(expectedCommission);
    expect(res.body.order.workerPayableAmount).toBe(expectedWorkerPayable);
    mainOrderId = res.body.order.orderId;
  });

  it("verifies the payment on the backend and creates a pending payout", async () => {
    const res = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ providerOrderId: mainOrderId });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("COMPLETED");
    expect(res.body.payment.amount).toBe(expectedTotal);
    expect(res.body.payment.quotationId).toBe(mainQuotationId);
    expect(res.body.payout.status).toBe("PENDING");
    expect(res.body.payout.workerPayableAmount).toBe(expectedWorkerPayable);
    mainPaymentId = res.body.payment._id;
    mainPayoutId = res.body.payout._id;

    const quotation = await Quotation.findById(mainQuotationId).lean();
    expect(quotation?.paidAt).toBeTruthy();
    expect(String(quotation?.paymentId)).toBe(String(mainPaymentId));
  });

  it("prevents a duplicate payment for the same enquiry", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId: mainEnquiryId });
    expect([400, 409]).toContain(res.status);

    const count = await Payment.countDocuments({ enquiryId: mainEnquiryId, status: "COMPLETED" });
    expect(count).toBe(1);
  });

  it("shows the worker their approved amount and verified earnings", async () => {
    const quotes = await request(app)
      .get("/api/quotations/my")
      .set("Authorization", `Bearer ${workerToken}`);
    expect(quotes.status).toBe(200);
    const quote = quotes.body.items.find((item: { _id: string }) => item._id === mainQuotationId);
    expect(quote.status).toBe("APPROVED");
    expect(quote.paidAt).toBeTruthy();

    const earnings = await request(app)
      .get("/api/payments/worker-earnings")
      .set("Authorization", `Bearer ${workerToken}`);
    expect(earnings.status).toBe(200);
    expect(earnings.body.stats.totalGrossEarnings).toBe(expectedTotal);
    expect(earnings.body.stats.totalCommissionDeducted).toBe(expectedCommission);
    expect(earnings.body.stats.netPayable).toBe(expectedWorkerPayable);
    expect(earnings.body.stats.pendingPayouts).toBe(expectedWorkerPayable);
  });

  it("shows verified payment, commission and payout totals in the admin dashboard", async () => {
    const res = await request(app).get("/api/admin/dashboard").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.totalVolume).toBeGreaterThanOrEqual(expectedTotal);
    expect(res.body.stats.totalCommission).toBeGreaterThanOrEqual(expectedCommission);
  });

  it("gives the admin a verified payment record with consistency checks", async () => {
    const res = await request(app)
      .get(`/api/admin/payments/${mainPaymentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("COMPLETED");
    expect(res.body.payout.status).toBe("PENDING");
    expect(res.body.checks.every((check: { ok: boolean }) => check.ok)).toBe(true);
  });

  it("lets the admin release the worker payout only with a reference", async () => {
    const missing = await request(app)
      .patch(`/api/admin/payouts/${mainPayoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID" });
    expect(missing.status).toBe(400);

    const paid = await request(app)
      .patch(`/api/admin/payouts/${mainPayoutId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAID", providerPayoutRef: "UTR_QUOTATION_001" });
    expect(paid.status).toBe(200);
    expect(paid.body.payout.status).toBe("PAID");
    expect(paid.body.payout.paidAt).toBeTruthy();
    await closeEnquiry(mainEnquiryId);
  });
});

describe("quotation rejection and revision flows", () => {
  it("lets the admin reject a quotation and the worker revise it afterwards", async () => {
    const enquiryId = await createEnquiry(workerUserId, "Bathroom tap drips continuously even when closed.");

    const created = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ enquiryId, ...quotationPayload() });
    expect(created.status).toBe(201);

    await request(app)
      .post(`/api/quotations/${created.body.quotation._id}/submit`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    const rejected = await request(app)
      .post(`/api/admin/quotations/${created.body.quotation._id}/decision`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "reject", remarks: "Material cost is too high for this job." });
    expect(rejected.status).toBe(200);
    expect(rejected.body.quotation.status).toBe("REJECTED");
    expect(rejected.body.quotation.adminRemarks).toContain("too high");

    const revised = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ enquiryId, ...quotationPayload({ materialCharges: 400 }) });
    expect(revised.status).toBe(201);
    expect(revised.body.quotation.status).toBe("DRAFT");
    expect(revised.body.quotation.revisionNumber).toBe(2);
    expect(revised.body.quotation.total).toBe(5950);
    expect(revised.body.quotation.approvedAmount).toBeUndefined();
    await closeEnquiry(enquiryId);
  });

  it("lets the admin request a revision and the worker resubmit", async () => {
    const enquiryId = await createEnquiry(workerUserId, "Ceiling fan makes a grinding noise at high speed.");

    const created = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ enquiryId, ...quotationPayload() });
    await request(app)
      .post(`/api/quotations/${created.body.quotation._id}/submit`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    const revision = await request(app)
      .post(`/api/admin/quotations/${created.body.quotation._id}/decision`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "request_revision", remarks: "Please split out the material charges." });
    expect(revision.status).toBe(200);
    expect(revision.body.quotation.status).toBe("REVISION_REQUESTED");

    const updated = await request(app)
      .patch(`/api/quotations/${created.body.quotation._id}`)
      .set("Authorization", `Bearer ${workerToken}`)
      .send(quotationPayload({ materialCharges: 700 }));
    expect(updated.status).toBe(200);
    expect(updated.body.quotation.status).toBe("DRAFT");
    expect(updated.body.quotation.revisionNumber).toBe(2);

    const resubmitted = await request(app)
      .post(`/api/quotations/${created.body.quotation._id}/submit`)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.quotation.status).toBe("SUBMITTED");
    await closeEnquiry(enquiryId);
  });

  it("requires remarks when rejecting or requesting a revision", async () => {
    const enquiryId = await createEnquiry(workerUserId, "Water motor trips the circuit breaker when started.");
    const created = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ enquiryId, ...quotationPayload() });
    await request(app)
      .post(`/api/quotations/${created.body.quotation._id}/submit`)
      .set("Authorization", `Bearer ${workerToken}`)
      .expect(200);

    const res = await request(app)
      .post(`/api/admin/quotations/${created.body.quotation._id}/decision`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "reject", remarks: "" });
    expect(res.status).toBe(400);
    await closeEnquiry(enquiryId);
  });
});

describe("customer rejection, expiry and payment security", () => {
  it("prevents payment when the customer rejects the approved quotation", async () => {
    const enquiryId = await createEnquiry(workerUserId, "Geyser is not heating water after a power surge.");
    const quotationId = await submitApprovedQuotation(enquiryId);

    const rejected = await request(app)
      .post(`/api/quotations/${quotationId}/respond`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ response: "reject", note: "The price is higher than my budget." });
    expect(rejected.status).toBe(200);
    expect(rejected.body.quotation.customerStatus).toBe("REJECTED");
    expect(rejected.body.quotation.status).toBe("REJECTED");

    const payment = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId });
    expect(payment.status).toBe(400);
    expect(String(payment.body.error?.message)).toMatch(/reject/i);

    const secondResponse = await request(app)
      .post(`/api/quotations/${quotationId}/respond`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ response: "accept" });
    expect(secondResponse.status).toBe(409);

    // A customer rejection must reopen the quote so the worker can revise it.
    const revised = await request(app)
      .post("/api/quotations")
      .set("Authorization", `Bearer ${workerToken}`)
      .send({ enquiryId, ...quotationPayload({ labourCharges: 4800 }) });
    expect(revised.status).toBe(201);
    expect(revised.body.quotation.status).toBe("DRAFT");
    expect(revised.body.quotation.revisionNumber).toBe(2);
    expect(revised.body.quotation.approvedAmount).toBeUndefined();

    const resubmitted = await request(app)
      .post(`/api/quotations/${revised.body.quotation._id}/submit`)
      .set("Authorization", `Bearer ${workerToken}`);
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.quotation.status).toBe("SUBMITTED");

    await closeEnquiry(enquiryId);
  });

  it("expires a quotation after its validity date and blocks payment", async () => {
    const enquiryId = await createEnquiry(workerUserId, "Washing machine drain pump needs replacement.");
    const quotationId = await submitApprovedQuotation(enquiryId);

    await request(app)
      .post(`/api/quotations/${quotationId}/respond`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ response: "accept" })
      .expect(200);

    await Quotation.updateOne(
      { _id: quotationId },
      { $set: { validUntil: new Date(Date.now() - 60 * 1000) } },
    );

    const list = await request(app)
      .get("/api/quotations/my")
      .set("Authorization", `Bearer ${customerToken}`);
    expect(list.status).toBe(200);
    const expired = list.body.items.find((item: { _id: string }) => item._id === quotationId);
    expect(expired.status).toBe("EXPIRED");

    const payment = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId });
    expect(payment.status).toBe(400);
    expect(String(payment.body.error?.message)).toMatch(/expired|approved/i);
    await closeEnquiry(enquiryId);
  });

  it("rejects an invalid Razorpay signature and marks the payment failed", async () => {
    const enquiryId = await createEnquiry(workerUserId, "Electrical socket sparks when a plug is inserted.");

    const payment = await Payment.create({
      enquiryId,
      customerId: customerUserId,
      workerId: workerUserId,
      amount: 1200,
      currency: "INR",
      commissionPercent: 15,
      commissionAmount: 180,
      workerPayableAmount: 1020,
      provider: "razorpay",
      providerOrderId: "order_invalid_signature_test",
      transactionRef: "tx_invalid_signature_test",
      status: "PENDING",
    });

    const res = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        providerOrderId: "order_invalid_signature_test",
        providerPaymentId: "pay_invalid_signature_test",
        signature: "definitely-not-a-valid-signature",
      });
    expect(res.status).toBe(400);

    const stored = await Payment.findById(payment._id).lean();
    expect(stored?.status).toBe("FAILED");
    await closeEnquiry(enquiryId);
  });

  it("prevents a different customer from verifying someone else's payment", async () => {
    const res = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({ providerOrderId: "order_invalid_signature_test" });
    expect([403, 404]).toContain(res.status);
  });
});

describe("admin payment reconciliation", () => {
  it("supports refund request and confirmed refund without inventing provider evidence", async () => {
    const enquiryId = await createEnquiry(workerUserId, "Broken pipe behind the wall needs emergency repair.");
    await submitApprovedQuotation(enquiryId);

    await request(app)
      .post(`/api/quotations/for-enquiry/${enquiryId}`)
      .set("Authorization", `Bearer ${customerToken}`);
    const quotation = await Quotation.findOne({ enquiryId }).lean();
    expect(quotation).toBeTruthy();

    await request(app)
      .post(`/api/quotations/${quotation!._id}/respond`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ response: "accept" })
      .expect(200);

    const order = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ enquiryId });
    expect(order.status).toBe(201);

    const verified = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ providerOrderId: order.body.order.orderId });
    expect(verified.status).toBe(200);
    const paymentId = verified.body.payment._id;
    const payoutId = verified.body.payout._id;

    const nonAdmin = await request(app)
      .post(`/api/admin/payments/${paymentId}/reconcile`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ action: "request_refund", note: "Customer asked for a refund." });
    expect(nonAdmin.status).toBe(403);

    const requested = await request(app)
      .post(`/api/admin/payments/${paymentId}/reconcile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "request_refund", note: "Customer raised a valid refund request." });
    expect(requested.status, JSON.stringify(requested.body)).toBe(200);
    expect(requested.body.payment.status).toBe("REFUND_REQUESTED");

    const refunded = await request(app)
      .post(`/api/admin/payments/${paymentId}/reconcile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "mark_refunded", note: "Refund processed via Razorpay dashboard, ref rfnd_001." });
    expect(refunded.status).toBe(200);
    expect(refunded.body.payment.status).toBe("REFUNDED");
    expect(refunded.body.payment.refundedAmount).toBe(expectedTotal);

    const storedPayout = await request(app)
      .get(`/api/admin/payments/${paymentId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(storedPayout.status).toBe(200);
    expect(storedPayout.body.payout.status).toBe("FAILED");
    expect(String(storedPayout.body.payout._id)).toBe(String(payoutId));
    await closeEnquiry(enquiryId);
  });

  it("syncs derived records without changing verified money fields", async () => {
    const payment = await Payment.findOne({ status: "COMPLETED" }).sort({ createdAt: -1 }).lean();
    expect(payment).toBeTruthy();

    const res = await request(app)
      .post(`/api/admin/payments/${payment!._id}/reconcile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "sync", note: "Routine reconciliation check." });
    expect(res.status).toBe(200);
    expect(res.body.payment.amount).toBe(payment!.amount);
    expect(res.body.payment.commissionAmount).toBe(payment!.commissionAmount);
    expect(res.body.payment.workerPayableAmount).toBe(payment!.workerPayableAmount);
  });
});
