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

type ActorRole = "customer" | "worker";
const TRANSITIONS: Record<EnquiryStatus, Partial<Record<ActorRole, EnquiryStatus[]>>> = {
  sent: { worker: ["accepted", "declined"], customer: ["cancelled"] },
  accepted: { worker: ["completed"], customer: ["cancelled"] },
  declined: {},
  completed: {},
  cancelled: {},
};

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function createEnquiry(req: Request<unknown, unknown, CreateInput>, res: Response) {
  const { workerId, serviceCategory, problemDescription, location } = req.body;

  if (!mongoose.isValidObjectId(workerId)) throw ApiError.badRequest("Invalid worker");
  if (workerId === req.user!.id) throw ApiError.badRequest("You cannot send an enquiry to yourself");

  const profile = await WorkerProfile.findOne({ userId: workerId, approvalStatus: "approved" }).exec();
  if (!profile) throw ApiError.notFound("This worker is not available for enquiries");

  // Prevent duplicate submissions to the same worker within a short window.
  const recent = await Enquiry.findOne({
    customerId: req.user!.id,
    workerId,
    status: { $in: ["sent", "accepted"] },
    createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
  });
  if (recent) throw ApiError.conflict("You already have an open enquiry with this worker");

  const enquiry = await Enquiry.create({
    customerId: req.user!.id,
    workerId,
    serviceCategory,
    problemDescription,
    location: location || "",
    status: "sent",
    statusHistory: [{ status: "sent", at: new Date(), by: new mongoose.Types.ObjectId(req.user!.id) }],
  });

  res.status(201).json({ enquiry });
}

export async function listMyEnquiries(req: Request, res: Response) {
  const box = String(req.query.box ?? "all");
  const role = req.user!.role;
  const filter: Record<string, unknown> = {};

  if (box === "received") {
    filter.workerId = req.user!.id;
  } else if (box === "sent") {
    filter.customerId = req.user!.id;
  } else {
    filter.$or = [{ customerId: req.user!.id }, { workerId: req.user!.id }];
  }

  if (role !== "admin" && box === "all") {
    filter.$or = [{ customerId: req.user!.id }, { workerId: req.user!.id }];
  }

  const page = getPagination(req.query as Record<string, unknown>, 20);
  const [items, total] = await Promise.all([
    Enquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name phone")
      .populate("workerId", "name phone")
      .lean()
      .exec(),
    Enquiry.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function updateEnquiryStatus(req: Request<{ id: string }, unknown, UpdateInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid enquiry id");

  const enquiry = await Enquiry.findById(req.params.id);
  if (!enquiry) throw ApiError.notFound("Enquiry not found");

  const me = req.user!.id;
  const isCustomer = String(enquiry.customerId) === me;
  const isWorker = String(enquiry.workerId) === me;
  if (!isCustomer && !isWorker) throw ApiError.forbidden("You are not part of this enquiry");

  const actor: ActorRole = isWorker ? "worker" : "customer";
  const next = req.body.status as EnquiryStatus;
  const allowed = TRANSITIONS[enquiry.status][actor] ?? [];
  if (!allowed.includes(next)) {
    throw ApiError.badRequest(`Cannot change status from "${enquiry.status}" to "${next}"`);
  }

  enquiry.status = next;
  enquiry.statusHistory.push({ status: next, at: new Date(), by: new mongoose.Types.ObjectId(req.user!.id), note: req.body.note });
  await enquiry.save();

  if (next === "completed") {
    await WorkerProfile.updateOne({ userId: enquiry.workerId }, { $inc: { completedEnquiries: 1 } });
  }

  res.json({ enquiry });
}
