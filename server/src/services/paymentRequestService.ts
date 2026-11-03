import mongoose, { type Types } from "mongoose";
import PaymentRequest, { type IPaymentRequest } from "../models/PaymentRequest.js";
import Enquiry from "../models/Enquiry.js";
import Quotation from "../models/Quotation.js";
import Payout from "../models/Payout.js";
import PlatformConfig from "../models/PlatformConfig.js";
import { notifyUser } from "./whatsappService.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

const DEFAULT_COMMISSION_PERCENT = 10;

export async function getCommissionForCategory(categoryName?: string): Promise<{
  commissionPercent: number;
  gatewayFeeBorneBy: "platform" | "customer" | "worker";
}> {
  const config = await PlatformConfig.findOne({ key: "global" }).lean().exec();
  if (!config) {
    return { commissionPercent: DEFAULT_COMMISSION_PERCENT, gatewayFeeBorneBy: "platform" };
  }

  if (categoryName && config.categoryCommissions && config.categoryCommissions.length > 0) {
    const match = config.categoryCommissions.find(
      (c) => c.categoryName.toLowerCase() === categoryName.trim().toLowerCase(),
    );
    if (match && typeof match.commissionPercent === "number") {
      return {
        commissionPercent: match.commissionPercent,
        gatewayFeeBorneBy: config.gatewayFeeBorneBy || "platform",
      };
    }
  }

  return {
    commissionPercent: config.commissionPercent ?? DEFAULT_COMMISSION_PERCENT,
    gatewayFeeBorneBy: config.gatewayFeeBorneBy || "platform",
  };
}

export interface SubmitPaymentRequestInput {
  workerId: string;
  enquiryId: string;
  completionNotes: string;
  completionEvidence?: string[];
}

export async function submitPaymentRequest(input: SubmitPaymentRequestInput): Promise<IPaymentRequest> {
  const { workerId, enquiryId, completionNotes, completionEvidence = [] } = input;

  if (!mongoose.isValidObjectId(enquiryId)) {
    throw ApiError.badRequest("Invalid booking ID");
  }

  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) {
    throw ApiError.notFound("Booking not found");
  }

  if (String(enquiry.workerId) !== workerId) {
    throw ApiError.forbidden("You are not assigned to this booking");
  }

  // Work must either be already completed, or the worker is marking completion now
  const allowedCompletionStatuses = ["ACCEPTED", "IN_PROGRESS", "COMPLETED"];
  if (!allowedCompletionStatuses.includes(String(enquiry.status).toUpperCase())) {
    throw ApiError.badRequest(
      `Cannot request payment for booking with status "${enquiry.status}". Job must be accepted or in progress.`,
    );
  }

  // Check agreed quotation — worker must not alter the approved price
  const quotation = await Quotation.findOne({ enquiryId: enquiry._id });
  let agreedAmount: number;

  if (quotation) {
    if (quotation.status !== "APPROVED") {
      throw ApiError.badRequest("The quotation for this booking has not been approved by admin.");
    }
    if (quotation.customerStatus !== "ACCEPTED") {
      throw ApiError.badRequest("The customer has not yet accepted the approved quotation.");
    }
    agreedAmount = Number(quotation.approvedAmount ?? quotation.total);
  } else {
    agreedAmount = Number(enquiry.serviceAmount ?? 0);
  }

  if (!Number.isFinite(agreedAmount) || agreedAmount <= 0) {
    throw ApiError.badRequest("Agreed service amount is not set or invalid for this booking.");
  }

  // Calculate commission based on category configuration
  const { commissionPercent } = await getCommissionForCategory(enquiry.serviceCategory);
  const commissionAmount = Math.round((agreedAmount * commissionPercent) / 100);
  const workerPayableAmount = agreedAmount - commissionAmount;

  // Mark enquiry as COMPLETED if not already
  if (enquiry.status !== "COMPLETED") {
    enquiry.status = "COMPLETED";
    enquiry.statusHistory.push({
      status: "COMPLETED",
      at: new Date(),
      by: new mongoose.Types.ObjectId(workerId),
      note: completionNotes || "Worker completed job and requested payment",
    });
    await enquiry.save();
  }

  // Check if an existing payment request exists for this enquiry
  let request = await PaymentRequest.findOne({ enquiryId: enquiry._id });
  const isNew = !request;

  if (!request) {
    request = new PaymentRequest({
      enquiryId: enquiry._id,
      quotationId: quotation?._id,
      workerId: enquiry.workerId,
      customerId: enquiry.customerId,
      serviceCategory: enquiry.serviceCategory,
      amount: agreedAmount,
      agreedAmount,
      currency: "INR",
      completionNotes,
      completionEvidence,
      status: "SUBMITTED",
      customerPaymentStatus: "NOT_INITIATED",
      commissionPercent,
      commissionAmount,
      workerPayableAmount,
      payoutStatus: "NOT_ELIGIBLE",
      history: [
        {
          status: "SUBMITTED",
          at: new Date(),
          by: new mongoose.Types.ObjectId(workerId),
          role: "worker",
          note: completionNotes || "Payment request submitted to Admin",
        },
      ],
    });
  } else {
    // If request was rejected or revision requested, worker can re-submit with updated notes/evidence
    if (request.status !== "REJECTED" && request.status !== "REVISION_REQUESTED" && request.status !== "SUBMITTED") {
      throw ApiError.conflict(
        `A payment request already exists in state "${request.status}" for this booking.`,
      );
    }
    request.completionNotes = completionNotes;
    if (completionEvidence.length > 0) {
      request.completionEvidence = completionEvidence;
    }
    request.status = "SUBMITTED";
    request.history.push({
      status: "SUBMITTED",
      at: new Date(),
      by: new mongoose.Types.ObjectId(workerId),
      role: "worker",
      note: completionNotes || "Payment request re-submitted",
    });
  }

  await request.save();

  // Notify admins via log / push
  logger.info(
    `[PaymentRequest] Worker ${workerId} submitted payment request for Enquiry ${enquiryId} (₹${agreedAmount})`,
  );

  return request;
}

export type AdminDecisionAction =
  | "approve"
  | "reject"
  | "request_evidence"
  | "send_to_customer";

export interface AdminDecideInput {
  adminId: string;
  requestId: string;
  action: AdminDecisionAction;
  remarks?: string;
}

export async function adminDecidePaymentRequest(input: AdminDecideInput): Promise<IPaymentRequest> {
  const { adminId, requestId, action, remarks = "" } = input;

  if (!mongoose.isValidObjectId(requestId)) {
    throw ApiError.badRequest("Invalid payment request ID");
  }

  const request = await PaymentRequest.findById(requestId)
    .populate("workerId", "name phone email")
    .populate("customerId", "name phone email")
    .populate("enquiryId", "serviceCategory problemDescription location");

  if (!request) {
    throw ApiError.notFound("Payment request not found");
  }

  request.adminRemarks = remarks;
  request.decidedBy = new mongoose.Types.ObjectId(adminId);
  request.decidedAt = new Date();

  switch (action) {
    case "approve":
    case "send_to_customer": {
      request.status = "CUSTOMER_PAYMENT_REQUESTED";
      request.customerPaymentStatus = "PENDING";
      request.history.push({
        status: "CUSTOMER_PAYMENT_REQUESTED",
        at: new Date(),
        by: new mongoose.Types.ObjectId(adminId),
        role: "admin",
        note: remarks || "Admin approved work completion and requested payment from customer.",
      });

      // Notify customer that work is verified and payment is due
      notifyUser(
        String(request.customerId._id || request.customerId),
        "PAYMENT",
        "Payment Requested for Completed Service",
        `Work on your ${request.serviceCategory} request has been completed and verified. Total payable: ₹${request.amount}. Please review and pay.`,
        { enquiryId: String(request.enquiryId._id || request.enquiryId), requestId: String(request._id) },
      ).catch(() => {});

      // Notify worker
      notifyUser(
        String(request.workerId._id || request.workerId),
        "PAYMENT",
        "Payment Request Approved",
        `Your payment request for ₹${request.amount} was approved by Admin and sent to the customer.`,
        { enquiryId: String(request.enquiryId._id || request.enquiryId) },
      ).catch(() => {});
      break;
    }

    case "reject": {
      request.status = "REJECTED";
      request.history.push({
        status: "REJECTED",
        at: new Date(),
        by: new mongoose.Types.ObjectId(adminId),
        role: "admin",
        note: remarks || "Payment request rejected by Admin.",
      });

      notifyUser(
        String(request.workerId._id || request.workerId),
        "PAYMENT",
        "Payment Request Rejected",
        `Your payment request for ₹${request.amount} was rejected. Reason: ${remarks || "No details provided"}.`,
        { enquiryId: String(request.enquiryId._id || request.enquiryId) },
      ).catch(() => {});
      break;
    }

    case "request_evidence": {
      request.status = "REVISION_REQUESTED";
      request.history.push({
        status: "REVISION_REQUESTED",
        at: new Date(),
        by: new mongoose.Types.ObjectId(adminId),
        role: "admin",
        note: remarks || "Additional work evidence or clarification requested.",
      });

      notifyUser(
        String(request.workerId._id || request.workerId),
        "PAYMENT",
        "Clarification Requested on Completed Work",
        `Admin requested more evidence or clarification for your payment request. ${remarks}`,
        { enquiryId: String(request.enquiryId._id || request.enquiryId) },
      ).catch(() => {});
      break;
    }

    default:
      throw ApiError.badRequest("Invalid decision action");
  }

  await request.save();
  return request;
}

export async function syncPaymentRequestOnSettlement(params: {
  enquiryId: Types.ObjectId | string;
  paymentId: Types.ObjectId | string;
  amount: number;
  commissionPercent: number;
  commissionAmount: number;
  workerPayableAmount: number;
  payoutId?: Types.ObjectId | string;
}) {
  const { enquiryId, paymentId, amount, commissionPercent, commissionAmount, workerPayableAmount, payoutId } = params;

  const request = await PaymentRequest.findOne({ enquiryId });
  if (!request) return null;

  request.customerPaymentStatus = "PAID";
  request.paymentId = new mongoose.Types.ObjectId(paymentId);
  request.paidAt = new Date();
  request.commissionPercent = commissionPercent;
  request.commissionAmount = commissionAmount;
  request.workerPayableAmount = workerPayableAmount;
  request.payoutStatus = "PENDING_ADMIN_APPROVAL";

  if (payoutId) {
    request.payoutId = new mongoose.Types.ObjectId(payoutId);
  }

  request.history.push({
    status: "PAID",
    at: new Date(),
    by: request.customerId,
    role: "customer",
    note: `Customer paid ₹${amount} via Razorpay. Worker net payable: ₹${workerPayableAmount}.`,
  });

  await request.save();
  return request;
}

export async function adminAuthorizeWorkerPayout(params: {
  adminId: string;
  payoutId: string;
  providerPayoutRef?: string;
  note?: string;
}): Promise<{ payout: unknown; paymentRequest?: IPaymentRequest | null }> {
  const { adminId, payoutId, providerPayoutRef = "", note = "" } = params;

  if (!mongoose.isValidObjectId(payoutId)) {
    throw ApiError.badRequest("Invalid payout ID");
  }

  const payout = await Payout.findById(payoutId);
  if (!payout) {
    throw ApiError.notFound("Payout record not found");
  }

  if (payout.status === "PAID") {
    throw ApiError.conflict("This payout has already been marked as PAID");
  }

  const generatedRef =
    providerPayoutRef.trim() ||
    `pout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  payout.status = "PAID";
  payout.approvedBy = new mongoose.Types.ObjectId(adminId);
  payout.approvedAt = new Date();
  payout.paidAt = new Date();
  payout.providerPayoutRef = generatedRef;
  payout.note = note || "Payout authorized by administrator";
  await payout.save();

  // Update associated payment request
  const paymentRequest = await PaymentRequest.findOne({ enquiryId: payout.enquiryId });
  if (paymentRequest) {
    paymentRequest.payoutStatus = "PAID";
    paymentRequest.payoutApprovedBy = new mongoose.Types.ObjectId(adminId);
    paymentRequest.payoutApprovedAt = new Date();
    paymentRequest.payoutPaidAt = new Date();
    paymentRequest.providerPayoutRef = generatedRef;
    paymentRequest.history.push({
      status: "PAYOUT_PAID",
      at: new Date(),
      by: new mongoose.Types.ObjectId(adminId),
      role: "admin",
      note: `Payout of ₹${payout.workerPayableAmount} authorized and transferred. Ref: ${generatedRef}`,
    });
    await paymentRequest.save();
  }

  notifyUser(
    String(payout.workerId),
    "PAYOUT",
    "Payout Transferred Successfully",
    `Your payout of ₹${payout.workerPayableAmount} has been disbursed to your account. Ref: ${generatedRef}`,
    { payoutId: String(payout._id), ref: generatedRef },
  ).catch(() => {});

  return { payout, paymentRequest };
}
