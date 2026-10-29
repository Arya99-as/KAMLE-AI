import type { Request, Response } from "express";
import mongoose from "mongoose";
import Enquiry, { type EnquiryStatus } from "../models/Enquiry.js";
import WorkerProfile from "../models/WorkerProfile.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination } from "../utils/pagination.js";
import type { z } from "zod";
import type { createEnquirySchema, updateEnquiryStatusSchema } from "../validators/interactions.js";

type CreateInput = z.infer<typeof createEnquirySchema>;
type UpdateInput = z.infer<typeof updateEnquiryStatusSchema>;

type ActorRole = "customer" | "worker" | "admin";

function normalizeStatus(st: string): EnquiryStatus {
  if (st === "sent") return "PENDING";
  if (st === "declined") return "REJECTED";
  if (st === "completed") return "COMPLETED";
  if (st === "accepted") return "ACCEPTED";
  if (st === "cancelled") return "CANCELLED";
  return st as EnquiryStatus;
}

const TRANSITIONS: Record<string, Partial<Record<ActorRole, string[]>>> = {
  PENDING: {
    worker: ["ACCEPTED", "REJECTED", "accepted", "declined"],
    customer: ["CANCELLED", "cancelled"],
    admin: ["CANCELLED"],
  },
  sent: {
    worker: ["ACCEPTED", "REJECTED", "accepted", "declined"],
    customer: ["CANCELLED", "cancelled"],
    admin: ["CANCELLED"],
  },
  ACCEPTED: {
    worker: ["IN_PROGRESS", "COMPLETED", "completed"],
    customer: ["CANCELLED", "cancelled"],
    admin: ["CANCELLED"],
  },
  accepted: {
    worker: ["IN_PROGRESS", "COMPLETED", "completed"],
    customer: ["CANCELLED", "cancelled"],
    admin: ["CANCELLED"],
  },
  IN_PROGRESS: {
    worker: ["COMPLETED", "completed"],
    customer: ["DISPUTED"],
    admin: ["CANCELLED", "DISPUTED"],
  },
  COMPLETED: {
    customer: ["DISPUTED"],
    admin: ["DISPUTED"],
  },
  completed: {
    customer: ["DISPUTED"],
    admin: ["DISPUTED"],
  },
  DISPUTED: {
    customer: ["COMPLETED"],
    admin: ["COMPLETED", "CANCELLED"],
  },
  REJECTED: {},
  declined: {},
  CANCELLED: {},
  cancelled: {},
};

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createEnquiry(req: Request<unknown, unknown, CreateInput>, res: Response) {
  if (req.user && req.user.role !== "customer") {
    throw ApiError.forbidden("Only customers can create service requests");
  }

  const { workerId, serviceCategory, problemDescription, location, serviceAmount } = req.body;

  if (!mongoose.isValidObjectId(workerId)) throw ApiError.badRequest("Invalid worker");
  if (workerId === req.user!.id) throw ApiError.badRequest("You cannot send a request to yourself");

  const profile = await WorkerProfile.findOne({ userId: workerId, approvalStatus: "approved" }).exec();
  if (!profile) throw ApiError.notFound("This worker is not available or not yet approved");

  const recent = await Enquiry.findOne({
    customerId: req.user!.id,
    workerId,
    status: { $in: ["PENDING", "sent", "ACCEPTED", "accepted", "IN_PROGRESS"] },
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  });
  if (recent) throw ApiError.conflict("You already have an active service request with this worker");

  const initialAmountRaw = serviceAmount ?? (profile.pricing && profile.pricing.amount) ?? 0;
  const initialAmount = Number(initialAmountRaw);
  if (!Number.isFinite(initialAmount) || initialAmount < 0) {
    throw ApiError.badRequest("Invalid service amount");
  }

  const enquiry = await Enquiry.create({
    customerId: req.user!.id,
    workerId,
    serviceCategory,
    problemDescription,
    location: location || "",
    serviceAmount: initialAmount,
    status: "PENDING",
    paymentStatus: "UNPAID",
    statusHistory: [{ status: "PENDING", at: new Date(), by: new mongoose.Types.ObjectId(req.user!.id), note: "Service request created" }],
  });

  res.status(201).json({ enquiry });
}

export async function listMyEnquiries(req: Request, res: Response) {
  const box = String(req.query.box ?? "all");
  const role = req.user!.role;
  const filter: Record<string, unknown> = {};

  if (role === "admin") {
    if (req.query.status) {
      filter.status = req.query.status;
    }
  } else if (box === "received" || role === "worker") {
    filter.workerId = req.user!.id;
  } else if (box === "sent" || role === "customer") {
    filter.customerId = req.user!.id;
  } else {
    filter.$or = [{ customerId: req.user!.id }, { workerId: req.user!.id }];
  }

  if (req.query.status && role !== "admin") {
    filter.status = req.query.status;
  }

  const page = getPagination(req.query as Record<string, unknown>, 30);
  const [items, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name phone avatarUrl")
      .populate("workerId", "name phone avatarUrl")
      .lean()
      .exec(),
    Enquiry.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function updateEnquiryStatus(req: Request<{ id: string }, unknown, UpdateInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid enquiry id");

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound("Service request not found");

  const me = req.user!.id;
  const isCustomer = String(enquiry.customerId) === me;
  const isWorker = String(enquiry.workerId) === me;
  const isAdmin = req.user!.role === "admin";

  if (!isCustomer && !isWorker && !isAdmin) {
    throw ApiError.forbidden("You are not authorized to update this service request");
  }

  const actor: ActorRole = isAdmin ? "admin" : isWorker ? "worker" : "customer";
  const requestedStatus = req.body.status;
  const normalizedTarget = normalizeStatus(requestedStatus);

  const allowedTransitions = TRANSITIONS[enquiry.status]?.[actor] ?? [];
  if (!allowedTransitions.includes(requestedStatus) && !allowedTransitions.includes(normalizedTarget)) {
    throw ApiError.badRequest("Cannot change request status from " + enquiry.status + " to " + requestedStatus + ". Unauthorized or invalid transition.");
  }

  enquiry.status = normalizedTarget;

  if (req.body.serviceAmount !== undefined) {
    const current = normalizeStatus(String(enquiry.status));
    const target = normalizedTarget;
    const allowedAmountChange = current === "PENDING" || current === "ACCEPTED" || target === "COMPLETED";
    if (!allowedAmountChange) {
      throw ApiError.badRequest("Service amount can only be updated while the request is pending, accepted, or when completing the job");
    }
    const nextAmount = Number(req.body.serviceAmount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      throw ApiError.badRequest("Invalid service amount");
    }
    enquiry.serviceAmount = nextAmount;
  }

  if (normalizedTarget === "DISPUTED") {
    enquiry.disputeReason = req.body.disputeReason || req.body.note || "Customer reported an issue";
  } else if (normalizedTarget === "COMPLETED" && enquiry.disputeReason) {
    enquiry.disputeResolvedAt = new Date();
  }

  enquiry.statusHistory.push({
    status: normalizedTarget,
    at: new Date(),
    by: new mongoose.Types.ObjectId(req.user!.id),
    note: req.body.note || req.body.disputeReason || "",
  });

  await enquiry.save();

  if (normalizedTarget === "COMPLETED") {
    await WorkerProfile.updateOne({ userId: enquiry.workerId }, { $inc: { completedEnquiries: 1 } });
  }

  res.json({ enquiry });
}

export async function confirmCompletion(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid enquiry id");

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound("Service request not found");

  if (String(enquiry.customerId) !== req.user!.id) {
    throw ApiError.forbidden("Only the customer can confirm completion of this request");
  }

  if (normalizeStatus(String(enquiry.status)) !== "COMPLETED") {
    throw ApiError.badRequest("You can confirm completion only after the worker marks the work as completed");
  }

  if (!enquiry.clientConfirmedAt) {
    enquiry.clientConfirmedAt = new Date();
    enquiry.statusHistory.push({
      status: "COMPLETED",
      at: new Date(),
      by: new mongoose.Types.ObjectId(req.user!.id),
      note: "Customer confirmed the work is completed",
    });
    await enquiry.save();
  }

  res.json({ success: true, enquiry });
}

export async function getEnquiryById(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid enquiry id");

  const enquiry = await Enquiry.findById(req.params.id)
    .populate("customerId", "name phone avatarUrl")
    .populate("workerId", "name phone avatarUrl")
    .lean()
    .exec();

  if (!enquiry) throw ApiError.notFound("Service request not found");

  const me = req.user!.id;
  const isAdmin = req.user!.role === "admin";
  if (String(enquiry.customerId._id) !== me && String(enquiry.workerId._id) !== me && !isAdmin) {
    throw ApiError.forbidden("Access denied");
  }

  res.json({ success: true, enquiry });
}
