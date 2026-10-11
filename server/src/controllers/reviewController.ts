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

/** Customers may only review a worker after a completed enquiry (a genuine interaction). */
export async function createReview(req: Request<unknown, unknown, ReviewInput>, res: Response) {
  const { workerId, rating, comment } = req.body;

  if (!mongoose.isValidObjectId(workerId)) throw ApiError.badRequest("Invalid worker");
  if (workerId === req.user!.id) throw ApiError.badRequest("You cannot review yourself");

  const completed = await Enquiry.findOne({
    customerId: req.user!.id,
    workerId,
    status: "completed",
  })
    .sort({ updatedAt: -1 })
    .exec();
  if (!completed) {
    throw ApiError.forbidden("You can only review a worker after a completed enquiry");
  }

  const existing = await Review.findOne({ customerId: req.user!.id, workerId });
  if (existing) throw ApiError.conflict("You have already reviewed this worker");

  const review = await Review.create({
    customerId: req.user!.id,
    workerId,
    enquiryId: completed._id,
    rating,
    comment: comment ?? "",
    moderationStatus: "pending",
  });

  res.status(201).json({ review, message: "Thanks! Your review is awaiting moderation." });
}

/** Public: approved reviews for a worker. */
export async function listWorkerReviews(req: Request<{ id: string }>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid worker id");

  const profile = await WorkerProfile.findById(req.params.id).select("userId").lean().exec();
  if (!profile) throw ApiError.notFound("Worker not found");

  const page = getPagination(req.query as Record<string, unknown>, 20);
  const [items, total] = await Promise.all([
    Review.find({ workerId: profile.userId, moderationStatus: "approved" })
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name")
      .lean()
      .exec(),
    Review.countDocuments({ workerId: profile.userId, moderationStatus: "approved" }),
  ]);

  res.json(buildPaginated(items, total, page));
}

/** Authenticated customer: reviews I wrote. */
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
