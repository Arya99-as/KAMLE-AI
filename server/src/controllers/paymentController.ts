import type { Request, Response } from "express";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Payout from "../models/Payout.js";
import ApiError from "../utils/ApiError.js";
import {
  createPaymentOrder,
  verifyAndRecordPayment,
  getPlatformCommissionPercent,
  handlePaymentWebhook,
} from "../services/paymentService.js";

export async function createOrder(req: Request, res: Response) {
  const { enquiryId } = req.body;
  if (!enquiryId) {
    throw ApiError.badRequest("enquiryId is required");
  }

  const order = await createPaymentOrder({
    enquiryId,
    customerId: req.user!.id,
  });

  res.status(201).json({ success: true, order });
}

export async function verifyPayment(req: Request, res: Response) {
  const { transactionRef, providerOrderId, providerPaymentId, signature, paymentMethod } = req.body;

  if (!providerOrderId) {
    throw ApiError.badRequest("providerOrderId is required");
  }

  const result = await verifyAndRecordPayment({
    transactionRef,
    providerOrderId,
    providerPaymentId,
    signature,
    paymentMethod,
    customerId: req.user!.id,
  });

  res.json({
    success: true,
    message: "Payment successfully verified and recorded",
    payment: result.payment,
    payout: result.payout,
  });
}

export async function paymentWebhook(req: Request, res: Response) {
  const signature = req.header("x-razorpay-signature") ?? req.header("x-webhook-signature") ?? "";
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    throw ApiError.badRequest("Missing raw request body for webhook");
  }

  const result = await handlePaymentWebhook(rawBody, signature);
  res.json({ success: true, ...result });
}

export async function getMyPayments(req: Request, res: Response) {
  const payments = await Payment.find({ customerId: req.user!.id })
    .sort({ createdAt: -1 })
    .populate("workerId", "name phone")
    .populate("enquiryId", "serviceCategory problemDescription")
    .lean()
    .exec();

  res.json({ success: true, payments });
}

export async function getWorkerEarnings(req: Request, res: Response) {
  const workerId = new mongoose.Types.ObjectId(req.user!.id);

  const [payouts, completedPayments] = await Promise.all([
    Payout.find({ workerId }).sort({ createdAt: -1 }).populate("enquiryId", "serviceCategory").lean().exec(),
    Payment.find({ workerId, status: "COMPLETED" }).lean().exec(),
  ]);

  const totalGrossEarnings = completedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalCommissionDeducted = completedPayments.reduce((acc, p) => acc + (p.commissionAmount || 0), 0);
  const netPayable = completedPayments.reduce((acc, p) => acc + (p.workerPayableAmount || 0), 0);

  const totalPaidOut = payouts
    .filter((p) => p.status === "PAID")
    .reduce((acc, p) => acc + (p.workerPayableAmount || 0), 0);

  const pendingPayouts = payouts
    .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
    .reduce((acc, p) => acc + (p.workerPayableAmount || 0), 0);

  res.json({
    success: true,
    stats: {
      totalGrossEarnings,
      totalCommissionDeducted,
      netPayable,
      totalPaidOut,
      pendingPayouts,
    },
    payouts,
  });
}

export async function getCommissionRate(_req: Request, res: Response) {
  const commissionPercent = await getPlatformCommissionPercent();
  res.json({ success: true, commissionPercent });
}
