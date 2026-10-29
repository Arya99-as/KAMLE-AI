import { z } from "zod";

export const approvalSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().trim().max(500).optional().default(""),
  })
  .refine((d) => d.decision !== "rejected" || d.reason.trim().length >= 5, {
    message: "A rejection reason is required",
    path: ["reason"],
  });

export const moderationSchema = z.object({
  moderationStatus: z.enum(["approved", "rejected"]),
});

export const accountStatusSchema = z.object({
  accountStatus: z.enum(["active", "suspended", "deactivated"]),
  reason: z.string().trim().max(300).optional().default(""),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(400).optional().default(""),
  icon: z.string().trim().max(40).optional().default("wrench"),
  keywords: z.array(z.string().trim().max(60)).max(30).optional().default([]),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().optional().default(0),
});

export const categoryUpdateSchema = categorySchema.partial();

export const reportStatusSchema = z.object({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]),
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(["COMPLETED", "CANCELLED"]).optional().default("COMPLETED"),
  note: z.string().trim().max(1000).optional().default("Dispute resolved by platform admin"),
});

export const payoutStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "PAID", "FAILED"]),
  providerPayoutRef: z.string().trim().max(200).optional(),
  note: z.string().trim().max(500).optional(),
});
