import { z } from "zod";

const stringArray = (max = 40) =>
  z
    .array(z.string().trim().min(1).max(80))
    .max(max)
    .transform((arr) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))));

export const workerProfileSchema = z.object({
  professionalDescription: z.string().trim().min(20, "Describe your services (min 20 characters)").max(1200),
  serviceCategories: stringArray(10).refine((a) => a.length > 0, "Select at least one category"),
  skills: stringArray(40).refine((a) => a.length > 0, "Add at least one skill"),
  experienceYears: z.coerce.number().min(0).max(70).default(0),
  experienceSummary: z.string().trim().max(1500).optional().default(""),
  serviceAreas: z
    .array(z.string().trim().min(1).max(120))
    .max(30)
    .transform((arr) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))))
    .refine((a) => a.length > 0, "Add at least one service area"),
  pricing: z
    .object({
      type: z.enum(["fixed", "hourly", "quote"]),
      amount: z.coerce.number().min(0).max(10_000_000).optional(),
      currency: z.string().trim().min(1).max(6).default("INR"),
      note: z.string().trim().max(300).optional().default(""),
    })
    .refine((p) => p.type === "quote" || typeof p.amount === "number", {
      message: "Provide an amount for fixed or hourly pricing",
      path: ["amount"],
    }),
  availability: z
    .object({
      availableNow: z.boolean().default(true),
      days: z.array(z.string().trim().min(1).max(20)).max(7).default([]),
      note: z.string().trim().max(200).optional().default(""),
    })
    .default({ availableNow: true, days: [], note: "" }),
  portfolioImages: z.array(z.string().trim().max(500)).max(12).optional().default([]),
  verificationDocuments: z
    .array(z.object({ label: z.string().trim().min(1).max(80), url: z.string().trim().max(500) }))
    .max(10)
    .optional()
    .default([]),
  consent: z.boolean().optional(),
});

export const workerProfileUpdateSchema = workerProfileSchema.partial();

export type WorkerProfileInput = z.infer<typeof workerProfileSchema>;
