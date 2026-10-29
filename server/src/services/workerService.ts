import mongoose from "mongoose";
import WorkerProfile, { type IWorkerProfile } from "../models/WorkerProfile.js";
import User from "../models/User.js";
import Review from "../models/Review.js";

/** Public-safe representation of a worker (never exposes private fields). */
export interface PublicWorker {
  workerId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  professionalDescription: string;
  serviceCategories: string[];
  skills: string[];
  experienceYears: number;
  experienceSummary: string;
  serviceAreas: string[];
  pricing: { type: string; amount?: number; currency: string; note?: string };
  availability: { availableNow: boolean; days: string[]; note?: string };
  portfolioImages: string[];
  verificationStatus: string;
  ratingAverage: number;
  ratingCount: number;
  completedEnquiries: number;
}

interface LeanUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  avatarUrl?: string;
  accountStatus: string;
  role: string;
  phone?: string;
}

export function toPublicWorker(profile: IWorkerProfile, user: LeanUser, reasons?: string[]): PublicWorker & { reasons?: string[] } {
  return {
    workerId: String(profile._id),
    userId: String(user._id),
    name: user.name,
    avatarUrl: user.avatarUrl || "",
    professionalDescription: profile.professionalDescription,
    serviceCategories: profile.serviceCategories ?? [],
    skills: profile.skills ?? [],
    experienceYears: profile.experienceYears ?? 0,
    experienceSummary: profile.experienceSummary ?? "",
    serviceAreas: profile.serviceAreas ?? [],
    pricing: profile.pricing ?? { type: "quote", currency: "INR" },
    availability: profile.availability ?? { availableNow: false, days: [] },
    portfolioImages: profile.portfolioImages ?? [],
    verificationStatus: profile.verificationStatus,
    ratingAverage: profile.ratingAverage ?? 0,
    ratingCount: profile.ratingCount ?? 0,
    completedEnquiries: profile.completedEnquiries ?? 0,
    ...(reasons ? { reasons } : {}),
  };
}

/** Load an approved worker profile by its profile id or user id. Returns null if not public. */
export async function getPublicWorkerById(idOrUserId: string) {
  if (!mongoose.isValidObjectId(idOrUserId)) return null;
  const profile = await WorkerProfile.findOne({
    $or: [{ _id: idOrUserId }, { userId: idOrUserId }],
    approvalStatus: "approved",
  })
    .populate<{ userId: LeanUser | null }>("userId", "name avatarUrl accountStatus role phone")
    .exec();
  if (!profile) return null;
  const user = profile.userId as unknown as LeanUser | null;
  if (!user || user.accountStatus !== "active" || user.role !== "worker") return null;
  return { profile, user };
}

/** Recompute a worker's rating aggregate from active reviews (excludes rejected). */
export async function recomputeRating(workerUserId: string): Promise<void> {
  const stats = await Review.aggregate<{ _id: mongoose.Types.ObjectId; avg: number; count: number }>([
    { $match: { workerId: new mongoose.Types.ObjectId(workerUserId), moderationStatus: { $ne: "rejected" } } },
    { $group: { _id: "$workerId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const result = stats[0];
  await WorkerProfile.updateOne(
    { userId: workerUserId },
    {
      ratingAverage: result ? Math.round(result.avg * 10) / 10 : 0,
      ratingCount: result ? result.count : 0,
    },
  );
}

export { User, WorkerProfile };
