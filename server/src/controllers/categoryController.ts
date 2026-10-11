import type { Request, Response } from "express";
import ServiceCategory from "../models/ServiceCategory.js";

export async function listCategories(_req: Request, res: Response) {
  const categories = await ServiceCategory.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select("name slug description icon")
    .lean()
    .exec();
  res.json({ categories });
}
