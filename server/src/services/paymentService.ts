import crypto from "node:crypto";
import mongoose, { type Connection } from "mongoose";
import Payment, { type IPayment } from "../models/Payment.js";
import Payout, { type IPayout } from "../models/Payout.js";
import Enquiry from "../models/Enquiry.js";
import PlatformConfig from "../models/PlatformConfig.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import env from "../config/env.js";

const DEFAULT_COMMISSION_PERCENT = 10;
type ClientSessionLike = Awaited<ReturnType<Connection["startSession"]>>;

async function executeInTransaction<T>(fn: (session: ClientSessionLike | null) => Promise<T>): Promise<T> {
  const topology = (mongoose.connection as unknown as { topology?: { type?: string } }).topology;
  const txCapable = topology?.type === "ReplicaSet";
  if (!txCapable) return fn(null);
  const session = await mongoose.connection.startSession();
  try {
    return await session.withTransaction((s) => fn(s));
  } finally {
    await session.endSession();
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function getPlatformCommissionPercent(): Promise<number> {
  const config = await PlatformConfig.findOne({ key: "global" }).lean().exec();
  return config ? config.commissionPercent : DEFAULT_COMMISSION_PERCENT;
}

async function createRazorpayOrder(amountInPaise: number, receipt: string): Promise<string> {
  const auth = Buffer.from(`${env.payments.keyId}:${env.payments.keySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      payment_capture: 1,
    }),
  });

  const data = (await response.json()) as { id?: string; error?: { description?: string } };
  if (!response.ok || !data.id) {
    logger.error(`Razorpay order creation failed: ${data.error?.description ?? response.statusText}`);
    throw new ApiError(502, "Payment provider could not create an order. Please try again.", "PAYMENT_PROVIDER_ERROR");
  }
  return data.id;
}

function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!env.payments.keySecret) return false;
  const expected = crypto
    .createHmac("sha256", env.payments.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqual(expected, signature);
}

export interface CreateOrderParams {
  enquiryId: string;
  customerId: string;
}

export async function createPaymentOrder(params: CreateOrderParams) {
  const { enquiryId, customerId } = params;

  if (!mongoose.isValidObjectId(enquiryId)) {
    throw ApiError.badRequest("Invalid service request ID");
  }

  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) {
    throw ApiError.notFound("Service request not found");
  }

  if (String(enquiry.customerId) !== customerId) {
    throw ApiError.forbidden("You are not authorized to pay for this service request");
  }

  if (enquiry.paymentStatus === "PAID") {
    throw ApiError.badRequest("This service request has already been paid for");
  }

  if (String(enquiry.status).toUpperCase() !== "COMPLETED") {
    throw ApiError.badRequest("The worker must mark the work as completed before payment");
  }

  const amount = Number(enquiry.serviceAmount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest("The service amount has not been set for this request");
  }
  const amountInPaise = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
    throw ApiError.badRequest("The service amount is outside the supported payment range");
  }

  const existingCompletedPayment = await Payment.findOne({
    enquiryId: enquiry._id,
    status: "COMPLETED",
  });
  if (existingCompletedPayment) {
    throw ApiError.conflict("A completed payment already exists for this request");
  }

  const commissionPercent = await getPlatformCommissionPercent();
  const commissionAmount = Math.round((amount * commissionPercent) / 100);
  const workerPayableAmount = amount - commissionAmount;

  const provider = env.payments.provider;
  let providerOrderId: string;
  if (provider === "razorpay") {
    providerOrderId = await createRazorpayOrder(amountInPaise, String(enquiry._id));
  } else if (env.payments.allowMock) {
    providerOrderId = "mock_ord_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
  } else {
    throw new ApiError(503, "Payments are not configured. Please contact support.", "PAYMENTS_DISABLED");
  }

  let payment = await Payment.findOne({
    enquiryId: enquiry._id,
    status: "PENDING",
  });

  if (!payment) {
    payment = new Payment({
      enquiryId: enquiry._id,
      customerId: enquiry.customerId,
      workerId: enquiry.workerId,
      transactionRef: "tx_" + Date.now() + "_" + crypto.randomBytes(6).toString("hex"),
    });
  }

  payment.amount = amount;
  payment.currency = "INR";
  payment.commissionPercent = commissionPercent;
  payment.commissionAmount = commissionAmount;
  payment.workerPayableAmount = workerPayableAmount;
  payment.provider = provider;
  payment.providerOrderId = providerOrderId;
  payment.status = "PENDING";
  await payment.save();

  return {
    provider,
    orderId: providerOrderId,
    transactionRef: payment.transactionRef,
    amount,
    currency: "INR",
    commissionPercent,
    commissionAmount,
    workerPayableAmount,
    keyId: provider === "razorpay" ? env.payments.keyId : undefined,
    workerId: String(enquiry.workerId),
  };
}

async function settlePayment(
  payment: IPayment,
  providerPaymentId?: string,
  paymentMethod?: string,
): Promise<{ payment: IPayment; payout: IPayout | null; alreadyProcessed: boolean }> {
  const existingPayout = await Payout.findOne({ paymentId: payment._id });
  if (payment.status === "COMPLETED") {
    return { payment, payout: existingPayout, alreadyProcessed: true };
  }

  return executeInTransaction(async (session) => {
    const completedPayment = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: "COMPLETED" } },
      {
        $set: {
          status: "COMPLETED",
          verifiedAt: new Date(),
          ...(providerPaymentId ? { providerPaymentId } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
        },
      },
      { new: true, session: session ?? undefined },
    ).exec();

    if (!completedPayment) {
      const payoutAgain = await Payout.findOne({ paymentId: payment._id });
      return { payment, payout: payoutAgain, alreadyProcessed: true };
    }

    await Enquiry.updateOne({ _id: completedPayment.enquiryId }, { $set: { paymentStatus: "PAID" } }, { session: session ?? undefined });

    const payout = await Payout.findOneAndUpdate(
      { paymentId: completedPayment._id },
      {
        $setOnInsert: {
          workerId: completedPayment.workerId,
          enquiryId: completedPayment.enquiryId,
          paymentId: completedPayment._id,
          serviceAmount: completedPayment.amount,
          commissionAmount: completedPayment.commissionAmount,
          workerPayableAmount: completedPayment.workerPayableAmount,
          status: "PENDING",
          providerPayoutRef: "",
        },
      },
      { upsert: true, new: true, session: session ?? undefined },
    ).exec();

    return { payment: completedPayment, payout, alreadyProcessed: false };
  });
}

export interface VerifyPaymentParams {
  transactionRef?: string;
  providerOrderId: string;
  providerPaymentId?: string;
  signature?: string;
  paymentMethod?: string;
  customerId: string;
}

export async function verifyAndRecordPayment(params: VerifyPaymentParams) {
  const { transactionRef, providerOrderId, providerPaymentId, signature, paymentMethod, customerId } = params;

  if (!providerOrderId) {
    throw ApiError.badRequest("Missing payment order reference");
  }

  const payment = await Payment.findOne(
    transactionRef ? { $or: [{ providerOrderId }, { transactionRef }] } : { providerOrderId },
  );
  if (!payment) {
    throw ApiError.notFound("Payment transaction not found");
  }

  if (String(payment.customerId) !== customerId) {
    throw ApiError.forbidden("Unauthorized payment verification attempt");
  }

  if (payment.status === "COMPLETED") {
    return settlePayment(payment);
  }

  if (payment.provider === "razorpay") {
    if (!providerPaymentId || !signature) {
      throw ApiError.badRequest("Missing Razorpay verification fields");
    }
    const orderId = payment.providerOrderId ?? providerOrderId;
    if (!verifyRazorpayPaymentSignature(orderId, providerPaymentId, signature)) {
      payment.status = "FAILED";
      await payment.save();
      logger.warn(`Razorpay signature mismatch for order ${orderId}`);
      throw ApiError.badRequest("Payment signature verification failed");
    }
    return settlePayment(payment, providerPaymentId, paymentMethod ?? "razorpay");
  }

  if (!env.payments.allowMock) {
    throw new ApiError(403, "Simulated payments are disabled. Use a real payment provider.", "MOCK_PAYMENT_DISABLED");
  }

  return settlePayment(payment, providerPaymentId, paymentMethod ?? "simulated");
}

export async function handlePaymentWebhook(rawBody: Buffer, signature: string) {
  if (env.payments.provider !== "razorpay") {
    throw ApiError.badRequest("Webhooks are only supported for the Razorpay provider");
  }
  if (!env.payments.webhookSecret) {
    throw new ApiError(500, "Webhook secret is not configured", "CONFIG_ERROR");
  }
  if (!signature) {
    throw ApiError.badRequest("Missing webhook signature");
  }

  const expected = crypto.createHmac("sha256", env.payments.webhookSecret).update(rawBody).digest("hex");
  if (!safeEqual(expected, signature)) {
    logger.warn("Rejected Razorpay webhook with invalid signature");
    throw ApiError.badRequest("Invalid webhook signature");
  }

  let event: { event?: string; payload?: { payment?: { entity?: Record<string, unknown> } } };
  try {
    event = JSON.parse(rawBody.toString("utf8")) as typeof event;
  } catch {
    throw ApiError.badRequest("Invalid webhook payload");
  }

  const entity = event.payload?.payment?.entity;
  if (!entity) {
    return { received: true, ignored: true };
  }

  const orderId = entity.order_id ? String(entity.order_id) : "";
  const paymentId = entity.id ? String(entity.id) : "";
  const method = entity.method ? String(entity.method) : undefined;

  const payment = orderId ? await Payment.findOne({ providerOrderId: orderId }) : null;
  if (!payment) {
    return { received: true, ignored: true };
  }

  switch (event.event) {
    case "payment.captured":
    case "order.paid": {
      const result = await settlePayment(payment, paymentId, method);
      return { received: true, processed: true, alreadyProcessed: result.alreadyProcessed };
    }
    case "payment.failed": {
      if (payment.status !== "COMPLETED") {
        payment.status = "FAILED";
        await payment.save();
      }
      return { received: true, processed: true };
    }
    case "refund.processed": {
      payment.status = "REFUNDED";
      await payment.save();
      await Enquiry.updateOne({ _id: payment.enquiryId }, { $set: { paymentStatus: "REFUNDED" } });
      await Payout.updateOne({ paymentId: payment._id }, { $set: { status: "FAILED", note: "Payment refunded" } });
      return { received: true, processed: true };
    }
    default:
      return { received: true, ignored: true };
  }
}
