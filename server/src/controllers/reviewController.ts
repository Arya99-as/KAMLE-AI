import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Review from "../models/Review.js";
import Enquiry from "../models/Enquiry.js";
import WorkerProfile from "../models/WorkerProfile.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination } from "../utils/pagination.js";
import { recomputeRating } from "../services/workerService.js";
import type { reviewSchema } from "../validators/interactions.js";

type ReviewInput = z.infer<typeof reviewSchema>;

export async function createReview(req: Request<unknown, unknown, ReviewInput>, res: Response) {
  const { workerId, enquiryId, rating, comment } = req.body;

  if (!mongoose.isValidObjectId(workerId)) throw ApiError.badRequest("Invalid worker");
  if (workerId === req.user!.id) throw ApiError.badRequest("You cannot review yourself");

  let query: Record<string, unknown> = {
    customerId: req.user!.id,
    workerId,
    status: { $in: ["completed", "COMPLETED"] },
  };

  if (enquiryId && mongoose.isValidObjectId(enquiryId)) {
    query._id = enquiryId;
  }

  const completed = await Enquiry.findOne(query).sort({ updatedAt: -1 }).exec();
  if (!completed) {
    throw ApiError.forbidden("You can only review a worker after a completed service request");
  }

  const existing = await Review.findOne({
    $or: [
      { customerId: req.user!.id, enquiryId: completed._id },
      { customerId: req.user!.id, workerId },
    ],
  });
  if (existing) {
    throw ApiError.conflict("You have already submitted a review for this service");
  }

  const review = await Review.create({
    customerId: req.user!.id,
    workerId,
    enquiryId: completed._id,
    rating,
    comment: comment ?? "",
    moderationStatus: "pending",
  });

  await recomputeRating(String(workerId));

  res.status(201).json({ review, message: "Thank you! Your review has been recorded." });
}

export async function listWorkerReviews(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid worker id");

  const profile = await WorkerProfile.findOne({
    $or: [{ _id: req.params.id }, { userId: req.params.id }],
  }).select("userId").lean().exec();
  if (!profile) throw ApiError.notFound("Worker not found");

  const page = getPagination(req.query as Record<string, unknown>, 20);
  const [items, total] = await Promise.all([
    Review.find({ workerId: profile.userId, moderationStatus: { $ne: "rejected" } })
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name")
      .lean()
      .exec(),
    Review.countDocuments({ workerId: profile.userId, moderationStatus: { $ne: "rejected" } }),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function listMyReviews(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const [items, total] = await Promise.all([
    Review.find({ customerId: req.user!.id })
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("workerId", "name avatarUrl")
      .lean()
      .exec(),
    Review.countDocuments({ customerId: req.user!.id }),
  ]);

  res.json(buildPaginated(items, total, page));
}

export { recomputeRating };
