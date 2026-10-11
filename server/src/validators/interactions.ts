import { z } from "zod";

export const createEnquirySchema = z.object({
  workerId: z.string().trim().min(1, "Worker is required"),
  serviceCategory: z.string().trim().min(1).max(80),
  problemDescription: z.string().trim().min(10, "Describe the problem (min 10 characters)").max(2000),
  location: z.string().trim().max(120).optional().default(""),
});

export const updateEnquiryStatusSchema = z.object({
  status: z.enum(["accepted", "declined", "completed", "cancelled"]),
  note: z.string().trim().max(300).optional().default(""),
});

export const reviewSchema = z.object({
  workerId: z.string().trim().min(1),
  enquiryId: z.string().trim().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1500).optional().default(""),
});

export const reportSchema = z.object({
  reportedUserId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(200),
  details: z.string().trim().max(1500).optional().default(""),
});
