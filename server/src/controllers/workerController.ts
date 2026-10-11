import type { Request, Response } from "express";
import mongoose from "mongoose";
import WorkerProfile, { type IWorkerProfile } from "../models/WorkerProfile.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import ApiError from "../utils/ApiError.js";
import { buildPaginated, getPagination } from "../utils/pagination.js";
import findMatches from "../services/matchingService.js";
import { getPublicWorkerById, toPublicWorker } from "../services/workerService.js";
import type { SearchQuery } from "../validators/search.js";
import type { WorkerProfileInput } from "../validators/worker.js";

function resolveVerification(status: string, docCount: number): string {
  if (status === "verified") return "verified";
  return docCount > 0 ? "pending" : "unverified";
}

/** Public, paginated worker discovery (approved workers only). */
export async function listWorkers(req: Request<unknown, unknown, unknown, SearchQuery>, res: Response) {
  const q = req.query;
  const result = await findMatches(
    {
      category: q.category ?? null,
      skills: q.skills ?? [],
      location: q.location ?? "",
      budget: q.maxBudget ?? null,
      text: q.q || null,
    },
    {
      page: q.page,
      limit: q.limit,
      minRating: q.minRating,
      minExperience: q.minExperience,
      availabilityNow: q.availability === "now",
      sort: q.sort,
    },
  );

  const paginated = buildPaginated(result.workers, result.total, getPagination(q as unknown as Record<string, unknown>, 12));
  res.json({ ...paginated, weightsUsed: result.weightsUsed });
}

/** Public worker profile. Pending/rejected workers are never exposed here. */
export async function getWorker(req: Request<{ id: string }>, res: Response) {
  const found = await getPublicWorkerById(req.params.id);
  if (!found) throw ApiError.notFound("This worker profile is not available");

  const reviews = await Review.find({ workerId: found.user._id, moderationStatus: "approved" })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate<{ customerId: { name: string } | null }>("customerId", "name")
    .lean()
    .exec();

  res.json({
    worker: { ...toPublicWorker(found.profile as unknown as IWorkerProfile, found.user), phone: found.user.phone },
    reviews: reviews.map((r) => ({
      id: String(r._id),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      customerName: (r.customerId as unknown as { name?: string } | null)?.name ?? "KAMLE customer",
    })),
  });
}

/** Worker views their own profile (all statuses). */
export async function getMyProfile(req: Request, res: Response) {
  const profile = await WorkerProfile.findOne({ userId: req.user!.id }).lean().exec();
  res.json({ workerProfile: profile });
}

async function upsertProfile(userId: string, input: WorkerProfileInput, mode: "create" | "update") {
  const exists = await WorkerProfile.findOne({ userId });
  const docCount = input.verificationDocuments?.length ?? exists?.verificationDocuments.length ?? 0;

  const data = {
    professionalDescription: input.professionalDescription,
    serviceCategories: input.serviceCategories,
    skills: input.skills,
    experienceYears: input.experienceYears,
    experienceSummary: input.experienceSummary ?? "",
    serviceAreas: input.serviceAreas,
    pricing: input.pricing,
    availability: input.availability,
    portfolioImages: input.portfolioImages ?? [],
    verificationDocuments: input.verificationDocuments ?? [],
    verificationStatus: resolveVerification(exists?.verificationStatus ?? "unverified", docCount),
    approvalStatus: exists?.approvalStatus === "approved" && mode === "update" ? "approved" : "pending",
    rejectionReason: exists?.approvalStatus === "rejected" ? "" : exists?.rejectionReason ?? "",
  };

  const profile = await WorkerProfile.findOneAndUpdate(
    { userId },
    { $set: data, $setOnInsert: { userId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean().exec();

  return profile;
}

/** Submit or replace the worker profile (moves it to "pending" for admin review). */
export async function createProfile(req: Request<unknown, unknown, WorkerProfileInput>, res: Response) {
  const profile = await upsertProfile(req.user!.id, req.body, "create");
  res.status(201).json({ workerProfile: profile });
}

/** Update profile details without granting approval. */
export async function updateProfile(req: Request<unknown, unknown, Partial<WorkerProfileInput>>, res: Response) {
  const existing = await WorkerProfile.findOne({ userId: req.user!.id });
  if (!existing) throw ApiError.notFound("Create your profile before updating it");

  const merged = {
    ...existing.toObject(),
    ...req.body,
  } as unknown as WorkerProfileInput;

  const profile = await upsertProfile(req.user!.id, merged, "update");
  res.json({ workerProfile: profile });
}

/** Explicit re-submission after a rejection or while drafting. */
export async function submitProfile(req: Request, res: Response) {
  const updated = await WorkerProfile.findOneAndUpdate(
    { userId: req.user!.id },
    { $set: { approvalStatus: "pending", rejectionReason: "" } },
    { new: true },
  ).lean().exec();
  if (!updated) throw ApiError.notFound("Create your profile before submitting it");
  res.json({ workerProfile: updated });
}

function portfolioUrls(req: Request): string[] {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  return files.map((f) => `/uploads/images/${f.filename}`);
}

export async function uploadPortfolio(req: Request, res: Response) {
  const urls = portfolioUrls(req);
  if (urls.length === 0) throw ApiError.badRequest("No images were uploaded");
  const profile = await WorkerProfile.findOneAndUpdate(
    { userId: req.user!.id },
    { $push: { portfolioImages: { $each: urls } } },
    { new: true },
  ).lean().exec();
  res.json({ urls, workerProfile: profile });
}

export async function uploadDocuments(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw ApiError.badRequest("No documents were uploaded");
  const docs = files.map((f) => ({
    label: f.originalname.slice(0, 80),
    url: `/uploads/documents/${f.filename}`,
  }));
  const profile = await WorkerProfile.findOneAndUpdate(
    { userId: req.user!.id },
    { $push: { verificationDocuments: { $each: docs } }, $set: { verificationStatus: "pending" } },
    { new: true },
  ).lean().exec();
  res.json({ documents: docs, workerProfile: profile });
}

/** Public recommendations for the homepage (approved workers only). */
export async function recommendedWorkers(_req: Request, res: Response) {
  const profiles = await WorkerProfile.find({ approvalStatus: "approved" })
    .sort({ ratingAverage: -1, ratingCount: -1, createdAt: -1 })
    .limit(6)
    .populate<{ userId: { _id: mongoose.Types.ObjectId; name: string; avatarUrl?: string; accountStatus: string; role: string } | null }>(
      "userId",
      "name avatarUrl accountStatus role",
    )
    .lean()
    .exec();

  const workers = profiles
    .filter((p) => {
      const u = p.userId as unknown as { accountStatus?: string; role?: string } | null;
      return u && u.accountStatus === "active" && u.role === "worker";
    })
    .map((p) => toPublicWorker(p as never, p.userId as never));

  res.json({ workers });
}

export { User };
