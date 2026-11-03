import type { Request, Response } from "express";
import mongoose from "mongoose";
import PaymentRequest from "../models/PaymentRequest.js";
import {
  submitPaymentRequest,
  adminDecidePaymentRequest,
  adminAuthorizeWorkerPayout,
  type AdminDecisionAction,
} from "../services/paymentRequestService.js";
import ApiError from "../utils/ApiError.js";
import { getPagination, buildPaginated } from "../utils/pagination.js";

/**
 * Worker submits a payment request after completing job.
 * POST /api/payment-requests
 */
export async function createPaymentRequest(req: Request, res: Response) {
  const { enquiryId, completionNotes, completionEvidence } = req.body;

  if (!enquiryId) {
    throw ApiError.badRequest("enquiryId is required");
  }

  const request = await submitPaymentRequest({
    workerId: req.user!.id,
    enquiryId,
    completionNotes: completionNotes || "",
    completionEvidence: Array.isArray(completionEvidence) ? completionEvidence : [],
  });

  res.status(201).json({
    success: true,
    message: "Payment request submitted to Admin successfully",
    paymentRequest: request,
  });
}

/**
 * Worker lists their own payment requests.
 * GET /api/payment-requests/my
 */
export async function getMyWorkerPaymentRequests(req: Request, res: Response) {
  const workerId = new mongoose.Types.ObjectId(req.user!.id);
  const status = req.query.status ? String(req.query.status) : undefined;

  const filter: Record<string, unknown> = { workerId };
  if (status) filter.status = status;

  const page = getPagination(req.query as Record<string, unknown>, 20);

  const [items, total] = await Promise.all([
    PaymentRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name phone email avatarUrl")
      .populate("enquiryId", "serviceCategory problemDescription location status")
      .populate("quotationId")
      .populate("paymentId")
      .populate("payoutId")
      .lean()
      .exec(),
    PaymentRequest.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

/**
 * Customer views payment requests pending their payment.
 * GET /api/payment-requests/customer-pending
 */
export async function getCustomerPendingPaymentRequests(req: Request, res: Response) {
  const customerId = new mongoose.Types.ObjectId(req.user!.id);

  const requests = await PaymentRequest.find({
    customerId,
    status: "CUSTOMER_PAYMENT_REQUESTED",
  })
    .sort({ createdAt: -1 })
    .populate("workerId", "name phone avatarUrl")
    .populate("enquiryId", "serviceCategory problemDescription location")
    .populate("quotationId")
    .lean()
    .exec();

  res.json({
    success: true,
    requests,
  });
}

/**
 * Get payment request for a specific booking.
 * GET /api/payment-requests/for-enquiry/:enquiryId
 */
export async function getPaymentRequestForEnquiry(req: Request, res: Response) {
  const { enquiryId } = req.params;
  if (!mongoose.isValidObjectId(enquiryId)) {
    throw ApiError.badRequest("Invalid enquiryId");
  }

  const request = await PaymentRequest.findOne({ enquiryId })
    .populate("workerId", "name phone avatarUrl")
    .populate("customerId", "name phone avatarUrl")
    .populate("enquiryId", "serviceCategory problemDescription location status")
    .populate("quotationId")
    .populate("paymentId")
    .populate("payoutId")
    .lean()
    .exec();

  if (!request) {
    return res.json({ success: true, paymentRequest: null });
  }

  // Ensure caller is authorized (worker, customer, or admin)
  const me = req.user!.id;
  const workerObj = request.workerId as any;
  const customerObj = request.customerId as any;
  const isWorker = String(workerObj?._id || workerObj || "") === me;
  const isCustomer = String(customerObj?._id || customerObj || "") === me;
  const isAdmin = req.user!.role === "admin";

  if (!isWorker && !isCustomer && !isAdmin) {
    throw ApiError.forbidden("You are not authorized to view this payment request");
  }

  res.json({ success: true, paymentRequest: request });
}

/**
 * Admin lists all payment requests.
 * GET /api/payment-requests/admin
 */
export async function getAdminPaymentRequests(req: Request, res: Response) {
  const status = req.query.status ? String(req.query.status) : undefined;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const page = getPagination(req.query as Record<string, unknown>, 20);

  const [items, total] = await Promise.all([
    PaymentRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("workerId", "name phone email")
      .populate("customerId", "name phone email")
      .populate("enquiryId", "serviceCategory problemDescription location")
      .populate("quotationId")
      .populate("paymentId")
      .populate("payoutId")
      .lean()
      .exec(),
    PaymentRequest.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

/**
 * Admin reviews and makes decision on a payment request.
 * POST /api/payment-requests/admin/:id/decision
 */
export async function adminDecidePayment(req: Request, res: Response) {
  const { id } = req.params;
  const { action, remarks } = req.body;

  if (!id) {
    throw ApiError.badRequest("Payment request ID is required");
  }

  if (!["approve", "reject", "request_evidence", "send_to_customer"].includes(action)) {
    throw ApiError.badRequest("action must be one of: approve, reject, request_evidence, send_to_customer");
  }

  const request = await adminDecidePaymentRequest({
    adminId: req.user!.id,
    requestId: id,
    action: action as AdminDecisionAction,
    remarks,
  });

  res.json({
    success: true,
    message: `Payment request updated to status: ${request.status}`,
    paymentRequest: request,
  });
}

/**
 * Admin authorizes worker payout.
 * POST /api/payment-requests/admin/authorize-payout
 */
export async function adminAuthorizePayout(req: Request, res: Response) {
  const { payoutId, providerPayoutRef, note } = req.body;

  if (!payoutId) {
    throw ApiError.badRequest("payoutId is required");
  }

  const result = await adminAuthorizeWorkerPayout({
    adminId: req.user!.id,
    payoutId,
    providerPayoutRef,
    note,
  });

  res.json({
    success: true,
    message: "Worker payout authorized and recorded successfully",
    ...result,
  });
}
