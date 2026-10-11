import type { Request, Response } from "express";
import mongoose from "mongoose";
import Favorite from "../models/Favorite.js";
import WorkerProfile from "../models/WorkerProfile.js";
import ApiError from "../utils/ApiError.js";

export async function listFavorites(req: Request, res: Response) {
  const favorites = await Favorite.find({ customerId: req.user!.id })
    .sort({ createdAt: -1 })
    .populate<{ workerId: { _id: mongoose.Types.ObjectId; name: string; avatarUrl?: string } | null }>(
      "workerId",
      "name avatarUrl",
    )
    .lean()
    .exec();

  const workerUserIds = favorites.map((f) => f.workerId?._id).filter(Boolean);
  const profiles = await WorkerProfile.find({ userId: { $in: workerUserIds } })
    .select("userId serviceCategories skills experienceYears serviceAreas pricing availability verificationStatus ratingAverage ratingCount approvalStatus")
    .lean()
    .exec();

  const items = favorites
    .map((fav) => {
      const user = fav.workerId as unknown as { _id: mongoose.Types.ObjectId; name: string; avatarUrl?: string } | null;
      if (!user) return null;
      const profile = profiles.find((p) => String(p.userId) === String(user._id));
      return {
        favoriteId: String(fav._id),
        createdAt: fav.createdAt,
        worker: {
          workerId: profile ? String(profile._id) : "",
          userId: String(user._id),
          name: user.name,
          avatarUrl: user.avatarUrl || "",
          available: profile?.approvalStatus === "approved",
          serviceCategories: profile?.serviceCategories ?? [],
          skills: profile?.skills ?? [],
          experienceYears: profile?.experienceYears ?? 0,
          serviceAreas: profile?.serviceAreas ?? [],
          pricing: profile?.pricing ?? { type: "quote", currency: "INR" },
          availability: profile?.availability ?? { availableNow: false, days: [] },
          verificationStatus: profile?.verificationStatus ?? "unverified",
          ratingAverage: profile?.ratingAverage ?? 0,
          ratingCount: profile?.ratingCount ?? 0,
        },
      };
    })
    .filter(Boolean);

  res.json({ items });
}

export async function addFavorite(req: Request<{ workerId: string }>, res: Response) {
  const { workerId } = req.params;
  if (!mongoose.isValidObjectId(workerId)) throw ApiError.badRequest("Invalid worker id");
  if (workerId === req.user!.id) throw ApiError.badRequest("You cannot favorite yourself");

  const profile = await WorkerProfile.findOne({ userId: workerId, approvalStatus: "approved" }).exec();
  if (!profile) throw ApiError.notFound("This worker is not available");

  await Favorite.updateOne(
    { customerId: req.user!.id, workerId },
    { $setOnInsert: { customerId: req.user!.id, workerId } },
    { upsert: true },
  );
  res.status(201).json({ ok: true });
}

export async function removeFavorite(req: Request<{ workerId: string }>, res: Response) {
  await Favorite.deleteOne({ customerId: req.user!.id, workerId: req.params.workerId });
  res.json({ ok: true });
}
