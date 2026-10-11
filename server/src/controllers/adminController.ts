import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User.js";
import WorkerProfile from "../models/WorkerProfile.js";
import Enquiry from "../models/Enquiry.js";
import Review from "../models/Review.js";
import Report from "../models/Report.js";
import AuditLog from "../models/AuditLog.js";
import ServiceCategory from "../models/ServiceCategory.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination, slugify } from "../utils/pagination.js";
import { recordAudit } from "../services/auditService.js";
import { recomputeRating } from "../services/workerService.js";
import { checkAiProvider } from "../services/aiService.js";
import type { approvalSchema, accountStatusSchema, categorySchema, moderationSchema, reportStatusSchema } from "../validators/admin.js";

type ApprovalInput = z.infer<typeof approvalSchema>;
type AccountInput = z.infer<typeof accountStatusSchema>;
type CategoryInput = z.infer<typeof categorySchema>;
type ModerationInput = z.infer<typeof moderationSchema>;
type ReportStatusInput = z.infer<typeof reportStatusSchema>;

export async function aiHealth(_req: Request, res: Response) {
  res.json({ health: await checkAiProvider() });
}

export async function dashboard(_req: Request, res: Response) {
  const [totalUsers, totalWorkers, approvedWorkers, pendingApplications, totalEnquiries, openReports, pendingReviews] =
    await Promise.all([
      User.countDocuments({ accountStatus: { $ne: "deactivated" } }),
      User.countDocuments({ role: "worker" }),
      WorkerProfile.countDocuments({ approvalStatus: "approved" }),
      WorkerProfile.countDocuments({ approvalStatus: "pending" }),
      Enquiry.countDocuments({}),
      Report.countDocuments({ status: { $in: ["open", "reviewing"] } }),
      Review.countDocuments({ moderationStatus: "pending" }),
    ]);

  res.json({
    stats: {
      totalUsers,
      totalWorkers,
      approvedWorkers,
      pendingApplications,
      totalEnquiries,
      openReports,
      pendingReviews,
    },
  });
}

export async function listPendingWorkers(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = { approvalStatus: "pending" };
  if (req.query.status === "approved" || req.query.status === "rejected" || req.query.status === "draft") {
    filter.approvalStatus = req.query.status;
  }

  const [items, total] = await Promise.all([
    WorkerProfile.find(filter)
      .sort({ updatedAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("userId", "name phone email avatarUrl accountStatus")
      .lean()
      .exec(),
    WorkerProfile.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function setApproval(req: Request<{ id: string }, unknown, ApprovalInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid profile id");

  const profile = await WorkerProfile.findById(req.params.id);
  if (!profile) throw ApiError.notFound("Worker profile not found");

  profile.approvalStatus = req.body.decision;
  profile.rejectionReason = req.body.decision === "rejected" ? req.body.reason : "";
  if (req.body.decision === "approved" && profile.verificationDocuments.length > 0) {
    profile.verificationStatus = "verified";
  }
  await profile.save();

  await recordAudit({
    adminId: req.user!.id,
    action: `worker.${req.body.decision}`,
    targetType: "workerProfile",
    targetId: req.params.id,
    metadata: { reason: req.body.reason || undefined },
  });

  res.json({ workerProfile: profile });
}

export async function listUsers(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.accountStatus = req.query.status;
  if (req.query.q) {
    const re = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: { $regex: re, $options: "i" } }, { phone: { $regex: re, $options: "i" } }, { email: { $regex: re, $options: "i" } }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).lean().exec(),
    User.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function setAccountStatus(req: Request<{ id: string }, unknown, AccountInput>, res: Response) {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest("Invalid user id");
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "admin") throw ApiError.forbidden("Admin accounts cannot be modified here");

  user.accountStatus = req.body.accountStatus;
  await user.save();

  await recordAudit({
    adminId: req.user!.id,
    action: `account.${req.body.accountStatus}`,
    targetType: "user",
    targetId: req.params.id,
    metadata: { reason: req.body.reason || undefined },
  });

  res.json({ user: { id: String(user._id), accountStatus: user.accountStatus } });
}

export async function listReports(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("reporterId", "name phone")
      .populate("reportedUserId", "name phone accountStatus")
      .lean()
      .exec(),
    Report.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function setReportStatus(req: Request<{ id: string }, unknown, ReportStatusInput>, res: Response) {
  const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!report) throw ApiError.notFound("Report not found");
  await recordAudit({
    adminId: req.user!.id,
    action: `report.${req.body.status}`,
    targetType: "report",
    targetId: req.params.id,
  });
  res.json({ report });
}

export async function listReviews(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 20);
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.moderationStatus = req.query.status;

  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .populate("customerId", "name")
      .populate("workerId", "name")
      .lean()
      .exec(),
    Review.countDocuments(filter),
  ]);

  res.json(buildPaginated(items, total, page));
}

export async function moderateReview(req: Request<{ id: string }, unknown, ModerationInput>, res: Response) {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound("Review not found");

  review.moderationStatus = req.body.moderationStatus;
  await review.save();
  await recomputeRating(String(review.workerId));

  await recordAudit({
    adminId: req.user!.id,
    action: `review.${req.body.moderationStatus}`,
    targetType: "review",
    targetId: req.params.id,
  });

  res.json({ review });
}

export async function analytics(_req: Request, res: Response) {
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [enquiriesByStatus, enquiriesByCategory, workersByCategory, enquiriesByDay, topWorkers] = await Promise.all([
    Enquiry.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Enquiry.aggregate([
      { $group: { _id: "$serviceCategory", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    WorkerProfile.aggregate([
      { $match: { approvalStatus: "approved" } },
      { $unwind: "$serviceCategories" },
      { $group: { _id: "$serviceCategories", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Enquiry.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    WorkerProfile.find({ approvalStatus: "approved" })
      .sort({ completedEnquiries: -1, ratingAverage: -1 })
      .limit(5)
      .populate("userId", "name")
      .select("userId completedEnquiries ratingAverage ratingCount")
      .lean()
      .exec(),
  ]);

  res.json({ enquiriesByStatus, enquiriesByCategory, workersByCategory, enquiriesByDay, topWorkers });
}

export async function listAllCategories(_req: Request, res: Response) {
  const categories = await ServiceCategory.find().sort({ sortOrder: 1, name: 1 }).lean().exec();
  res.json({ categories });
}

export async function createCategory(req: Request<unknown, unknown, CategoryInput>, res: Response) {
  const slug = req.body.slug ? slugify(req.body.slug) : slugify(req.body.name);
  const category = await ServiceCategory.create({ ...req.body, slug });
  await recordAudit({ adminId: req.user!.id, action: "category.create", targetType: "category", targetId: String(category._id) });
  res.status(201).json({ category });
}

export async function updateCategory(req: Request<{ id: string }, unknown, Partial<CategoryInput>>, res: Response) {
  const update: Record<string, unknown> = { ...req.body };
  if (req.body.name && !req.body.slug) update.slug = slugify(req.body.name);
  if (req.body.slug) update.slug = slugify(req.body.slug);

  const category = await ServiceCategory.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!category) throw ApiError.notFound("Category not found");
  await recordAudit({ adminId: req.user!.id, action: "category.update", targetType: "category", targetId: req.params.id });
  res.json({ category });
}

export async function deleteCategory(req: Request<{ id: string }>, res: Response) {
  const category = await ServiceCategory.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!category) throw ApiError.notFound("Category not found");
  await recordAudit({ adminId: req.user!.id, action: "category.deactivate", targetType: "category", targetId: req.params.id });
  res.json({ category });
}

export async function listAuditLogs(req: Request, res: Response) {
  const page = getPagination(req.query as Record<string, unknown>, 30);
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(page.skip).limit(page.limit).populate("adminId", "name").lean().exec(),
    AuditLog.countDocuments(),
  ]);
  res.json(buildPaginated(items, total, page));
}
