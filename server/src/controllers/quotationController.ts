import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Enquiry from "../models/Enquiry.js";
import Quotation, { type IQuotation, type QuotationStatus } from "../models/Quotation.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination } from "../utils/pagination.js";
import recordAudit from "../services/auditService.js";
import {
  QUOTATION_DECIDABLE_STATUSES,
  QUOTATION_EDITABLE_STATUSES,
  computeSubtotal,
  expireQuotationIfNeeded,
} from "../services/quotationService.js";
import type {
  adminQuotationDecisionSchema,
  adminQuotationRemarksSchema,
  customerQuotationResponseSchema,
  quotationPayloadSchema,
} from "../validators/quotation.js";

type QuotationPayload = z.infer<typeof quotationPayloadSchema>;
type DecisionInput = z.infer<typeof adminQuotationDecisionSchema>;
type RemarksInput = z.infer<typeof adminQuotationRemarksSchema>;
type RespondInput = z.infer<typeof customerQuotationResponseSchema>;

const POPULATE = [
  { path: "customerId", select: "name phone email avatarUrl" },
  { path: "workerId", select: "name phone email avatarUrl" },
  {
    path: "enquiryId",
    select: "serviceCategory problemDescription location status paymentStatus serviceAmount clientConfirmedAt createdAt statusHistory",
  },
  { path: "approvedBy", select: "name email" },
];

const WORKER_QUOTABLE_ENQUIRY_STATUSES = ["PENDING", "sent", "ACCEPTED", "accepted", "IN_PROGRESS"];
const TERMINAL_QUOTATION_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "APPROVED"];

function idOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const candidate = (value as { _id?: unknown })._id;
  return candidate ? String(candidate) : String(value);
}

function isParticipant(quotation: IQuotation, userId: string): boolean {
  return idOf(quotation.workerId) === userId || idOf(quotation.customerId) === userId;
}

function assertFutureValidity(validUntil: Date): void {
  if (Number.isNaN(validUntil.getTime())) throw ApiError.badRequest("Invalid quotation validity date");
  if (validUntil.getTime() <= Date.now()) throw ApiError.badRequest("Quotation validity must be a future date");
}

function addHistory(
  quotation: IQuotation,
  status: QuotationStatus,
  actorId: string | null,
  role: "worker" | "customer" | "admin" | "system",
  note = "",
): void {
  quotation.history.push({
    status,
    at: new Date(),
    ...(actorId ? { by: new mongoose.Types.ObjectId(actorId) } : {}),
    role,
    note,
  });
}

/** Applies the worker's price breakdown. The client cannot submit a total. */
function applyBreakdown(quotation: IQuotation, body: QuotationPayload): void {
  const additionalCharges = (body.additionalCharges ?? []).map((c) => ({
    description: c.description.trim(),
    amount: Number(c.amount),
  }));
  const subtotal = computeSubtotal({
    labourCharges: Number(body.labourCharges ?? 0),
    materialCharges: Number(body.materialCharges ?? 0),
    additionalCharges,
  });

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    throw ApiError.badRequest("A quotation must include at least one charge greater than zero");
  }

  quotation.labourCharges = Number(body.labourCharges ?? 0);
  quotation.materialCharges = Number(body.materialCharges ?? 0);
  quotation.additionalCharges = additionalCharges;
  quotation.subtotal = subtotal;
  quotation.total = subtotal;
  quotation.estimatedCompletionTime = body.estimatedCompletionTime.trim();
  quotation.validUntil = body.validUntil;
  quotation.notes = body.notes ?? "";
}

/** Worker submits a price breakdown for one of their own enquiries. */
export async function createQuotation(req: Request<unknown, unknown, QuotationPayload>, res: Response) {
  const enquiryId = req.body.enquiryId;
  if (!enquiryId || !mongoose.isValidObjectId(enquiryId)) throw ApiError.badRequest("Invalid service request ID");

  const enquiry = await Enquiry.findById(enquiryId);
  if (!enquiry) throw ApiError.notFound("Service request not found");
  if (String(enquiry.workerId) !== req.user!.id) {
    throw ApiError.forbidden("You can only quote for service requests assigned to you");
  }
  if (!WORKER_QUOTABLE_ENQUIRY_STATUSES.includes(String(enquiry.status))) {
    throw ApiError.badRequest("This request can no longer receive a quotation");
  }
  assertFutureValidity(req.body.validUntil);

  let quotation = await Quotation.findOne({ enquiryId: enquiry._id });

  if (quotation) {
    await expireQuotationIfNeeded(quotation);
    if (TERMINAL_QUOTATION_STATUSES.includes(quotation.status)) {
      throw ApiError.conflict(
        quotation.status === "APPROVED"
          ? "This quotation is already approved and cannot be replaced"
          : "A quotation is already awaiting review for this request",
      );
    }
    if (quotation.paidAt) throw ApiError.conflict("This request has already been paid");

    applyBreakdown(quotation, req.body);
    quotation.status = "DRAFT";
    quotation.revisionNumber = Math.max(1, quotation.revisionNumber + 1);
    quotation.approvedAmount = undefined;
    quotation.approvedBy = undefined;
    quotation.approvedAt = undefined;
    quotation.decidedAt = undefined;
    quotation.customerStatus = "PENDING";
    quotation.respondedAt = undefined;
    addHistory(quotation, "DRAFT", req.user!.id, "worker", "Quotation revised by worker");
    await quotation.save();
  } else {
    quotation = new Quotation({
      enquiryId: enquiry._id,
      customerId: enquiry.customerId,
      workerId: enquiry.workerId,
      status: "DRAFT",
      revisionNumber: 1,
      customerStatus: "PENDING",
      adminRemarks: "",
      history: [],
    });
    applyBreakdown(quotation, req.body);
    addHistory(quotation, "DRAFT", req.user!.id, "worker", "Quotation draft created");
    await quotation.save();
  }

  const populated = await Quotation.findById(quotation._id).populate(POPULATE).lean().exec();
  res.status(201).json({ quotation: populated });
}

/** Worker edits a draft / revision-requested / rejected / expired quotation. */
export async function updateQuotation(req: Request<{ id: string }, unknown, QuotationPayload>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid quotation ID");

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound("Quotation not found");
  if (String(quotation.workerId) !== req.user!.id) {
    throw ApiError.forbidden("You can only edit your own quotation");
  }
  await expireQuotationIfNeeded(quotation);
  if (!QUOTATION_EDITABLE_STATUSES.includes(quotation.status)) {
    throw ApiError.badRequest("An approved or in-review quotation cannot be modified");
  }
  if (quotation.paidAt) throw ApiError.conflict("A paid quotation cannot be modified");
  assertFutureValidity(req.body.validUntil);

  const wasRevision = quotation.status !== "DRAFT";
  applyBreakdown(quotation, req.body);
  quotation.status = "DRAFT";
  if (wasRevision) quotation.revisionNumber = Math.max(1, quotation.revisionNumber + 1);
  quotation.approvedAmount = undefined;
  quotation.approvedBy = undefined;
  quotation.approvedAt = undefined;
  quotation.decidedAt = undefined;
  quotation.customerStatus = "PENDING";
  quotation.respondedAt = undefined;
  addHistory(quotation, "DRAFT", req.user!.id, "worker", wasRevision ? "Quotation revised by worker" : "Quotation draft updated");
  await quotation.save();

  const populated = await Quotation.findById(quotation._id).populate(POPULATE).lean().exec();
  res.json({ quotation: populated });
}

/** Worker submits the draft to the admin review queue. */
export async function submitQuotation(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid quotation ID");

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound("Quotation not found");
  if (String(quotation.workerId) !== req.user!.id) {
    throw ApiError.forbidden("You can only submit your own quotation");
  }
  await expireQuotationIfNeeded(quotation);
  if (!QUOTATION_EDITABLE_STATUSES.includes(quotation.status)) {
    throw ApiError.badRequest("This quotation has already been submitted");
  }
  if (quotation.total <= 0) throw ApiError.badRequest("Add at least one charge before submitting");
  if (quotation.validUntil.getTime() <= Date.now()) {
    quotation.status = "EXPIRED";
    addHistory(quotation, "EXPIRED", null, "system", "Validity elapsed before submission");
    await quotation.save();
    throw ApiError.badRequest("The quotation has expired. Update the validity date and try again.");
  }

  quotation.status = "SUBMITTED";
  quotation.approvedAmount = undefined;
  quotation.approvedBy = undefined;
  quotation.approvedAt = undefined;
  quotation.decidedAt = undefined;
  addHistory(quotation, "SUBMITTED", req.user!.id, "worker", "Submitted for admin approval");
  await quotation.save();

  const populated = await Quotation.findById(quotation._id).populate(POPULATE).lean().exec();
  res.json({ quotation: populated });
}

/** Quotations for the caller: workers see their quotes, customers see quotes for their requests. */
export async function listMyQuotations(req: Request, res: Response) {
  const role = req.user!.role;
  const filter: Record<string, unknown> = {};
  if (role === "worker") filter.workerId = req.user!.id;
  else if (role === "customer") filter.customerId = req.user!.id;
  if (req.query.status) filter.status = String(req.query.status);

  const page = getPagination(req.query as Record<string, unknown>, 50);
  const quotations = await Quotation.find(filter)
    .sort({ updatedAt: -1 })
    .skip(page.skip)
    .limit(page.limit)
    .populate(POPULATE)
    .exec();

  for (const quotation of quotations) await expireQuotationIfNeeded(quotation);

  const total = await Quotation.countDocuments(filter);
  res.json(buildPaginated(quotations.map((q) => q.toObject()), total, page));
}

export async function getQuotationById(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid quotation ID");

  const quotation = await Quotation.findById(req.params.id).populate(POPULATE).exec();
  if (!quotation) throw ApiError.notFound("Quotation not found");

  const isAdmin = req.user!.role === "admin";
  if (!isAdmin && !isParticipant(quotation, req.user!.id)) {
    throw ApiError.forbidden("You are not allowed to view this quotation");
  }
  await expireQuotationIfNeeded(quotation);
  res.json({ quotation });
}

/** The active quotation for an enquiry, for the customer/worker/admin. */
export async function getQuotationForEnquiry(req: Request<{ enquiryId: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.enquiryId)) throw ApiError.badRequest("Invalid service request ID");

  const enquiry = await Enquiry.findById(req.params.enquiryId).lean().exec();
  if (!enquiry) throw ApiError.notFound("Service request not found");
  const isAdmin = req.user!.role === "admin";
  if (!isAdmin && String(enquiry.customerId) !== req.user!.id && String(enquiry.workerId) !== req.user!.id) {
    throw ApiError.forbidden("You are not allowed to view this quotation");
  }

  const quotation = await Quotation.findOne({ enquiryId: req.params.enquiryId }).populate(POPULATE).exec();
  if (!quotation) throw ApiError.notFound("No quotation exists for this request");
  await expireQuotationIfNeeded(quotation);
  res.json({ quotation });
}

/** Customer accepts or rejects an admin-approved quotation. */
export async function respondToQuotation(req: Request<{ id: string }, unknown, RespondInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid quotation ID");

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound("Quotation not found");
  if (String(quotation.customerId) !== req.user!.id) {
    throw ApiError.forbidden("You can only respond to your own quotation");
  }
  await expireQuotationIfNeeded(quotation);

  if (quotation.paidAt) throw ApiError.conflict("This quotation has already been paid");
  if (quotation.status === "EXPIRED" || quotation.validUntil.getTime() <= Date.now()) {
    throw ApiError.badRequest("This quotation has expired");
  }
  if (quotation.customerStatus !== "PENDING") {
    throw ApiError.conflict(
      quotation.customerStatus === "ACCEPTED"
        ? "You have already accepted this quotation"
        : "You have already rejected this quotation. Ask the worker to submit a revised quote.",
    );
  }
  if (quotation.status !== "APPROVED") {
    throw ApiError.badRequest("You can respond only after an admin approves the quotation");
  }

  const accepted = req.body.response === "accept";
  quotation.customerStatus = accepted ? "ACCEPTED" : "REJECTED";
  quotation.respondedAt = new Date();
  // A customer rejection reopens the quote for the worker to revise. Without
  // this the approved document would stay terminal and the worker could never
  // submit a new price for the same enquiry.
  if (!accepted) quotation.status = "REJECTED";
  addHistory(
    quotation,
    accepted ? "APPROVED" : "REJECTED",
    req.user!.id,
    "customer",
    accepted ? "Customer accepted the approved quotation" : req.body.note || "Customer rejected the approved quotation",
  );
  await quotation.save();

  const populated = await Quotation.findById(quotation._id).populate(POPULATE).lean().exec();
  res.json({ quotation: populated });
}

/* ------------------------------ admin side ------------------------------- */

export async function listAllQuotations(req: Request, res: Response) {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = String(req.query.status);

  const page = getPagination(req.query as Record<string, unknown>, 50);
  const quotations = await Quotation.find(filter)
    .sort({ updatedAt: -1 })
    .skip(page.skip)
    .limit(page.limit)
    .populate(POPULATE)
    .exec();

  for (const quotation of quotations) await expireQuotationIfNeeded(quotation);

  const total = await Quotation.countDocuments(filter);
  res.json(buildPaginated(quotations.map((q) => q.toObject()), total, page));
}

/** Admin approves, rejects, or requests a revision. The approved amount is the server-computed total. */
export async function decideQuotation(req: Request<{ id: string }, unknown, DecisionInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid quotation ID");

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound("Quotation not found");
  await expireQuotationIfNeeded(quotation);

  if (!QUOTATION_DECIDABLE_STATUSES.includes(quotation.status)) {
    throw ApiError.badRequest("Only submitted quotations can be reviewed");
  }
  if (quotation.validUntil.getTime() <= Date.now()) {
    throw ApiError.badRequest("This quotation has expired and can no longer be approved");
  }

  const { decision, remarks } = req.body;

  if (decision === "request_revision") {
    quotation.status = "REVISION_REQUESTED";
    quotation.adminRemarks = remarks;
    quotation.decidedAt = new Date();
    addHistory(quotation, "REVISION_REQUESTED", req.user!.id, "admin", remarks);
  } else if (decision === "reject") {
    quotation.status = "REJECTED";
    quotation.adminRemarks = remarks;
    quotation.decidedAt = new Date();
    addHistory(quotation, "REJECTED", req.user!.id, "admin", remarks);
  } else {
    quotation.status = "APPROVED";
    quotation.adminRemarks = remarks;
    quotation.approvedAmount = quotation.total;
    quotation.approvedBy = new mongoose.Types.ObjectId(req.user!.id);
    quotation.approvedAt = new Date();
    quotation.decidedAt = quotation.approvedAt;
    quotation.customerStatus = "PENDING";
    quotation.respondedAt = undefined;
    addHistory(quotation, "APPROVED", req.user!.id, "admin", remarks || "Quotation approved");
    // Keep the enquiry amount in sync for legacy views/receipts. Payments still
    // read the immutable approvedAmount from the quotation document.
    await Enquiry.updateOne({ _id: quotation.enquiryId }, { $set: { serviceAmount: quotation.total } });
  }

  await quotation.save();

  await recordAudit({
    adminId: req.user!.id,
    action: `quotation.${decision}`,
    targetType: "Quotation",
    targetId: String(quotation._id),
    metadata: {
      enquiryId: String(quotation.enquiryId),
      workerId: String(quotation.workerId),
      total: quotation.total,
      approvedAmount: quotation.approvedAmount ?? null,
      remarks,
    },
  });

  const populated = await Quotation.findById(quotation._id).populate(POPULATE).lean().exec();
  res.json({ success: true, quotation: populated, message: "Quotation " + decision.replace("_", " ") });
}

/** Admin free-text remarks without changing the decision. */
export async function updateQuotationRemarks(req: Request<{ id: string }, unknown, RemarksInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid quotation ID");

  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw ApiError.notFound("Quotation not found");
  if (quotation.paidAt) throw ApiError.conflict("A paid quotation cannot be edited");

  quotation.adminRemarks = req.body.remarks;
  await quotation.save();

  await recordAudit({
    adminId: req.user!.id,
    action: "quotation.remarks_update",
    targetType: "Quotation",
    targetId: String(quotation._id),
    metadata: { remarks: req.body.remarks },
  });

  const populated = await Quotation.findById(quotation._id).populate(POPULATE).lean().exec();
  res.json({ success: true, quotation: populated });
}
