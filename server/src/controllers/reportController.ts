import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Report from "../models/Report.js";
import ApiError from "../utils/ApiError.js";
import type { reportSchema } from "../validators/interactions.js";

type ReportInput = z.infer<typeof reportSchema>;

export async function createReport(req: Request<unknown, unknown, ReportInput>, res: Response) {
  const { reportedUserId, reason, details } = req.body;
  if (!mongoose.isValidObjectId(reportedUserId)) throw ApiError.badRequest("Invalid user");
  if (reportedUserId === req.user!.id) throw ApiError.badRequest("You cannot report yourself");

  const report = await Report.create({
    reporterId: req.user!.id,
    reportedUserId,
    reason,
    details: details ?? "",
  });

  res.status(201).json({ report: { id: String(report._id), status: report.status } });
}
