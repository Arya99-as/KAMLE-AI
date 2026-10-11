import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().max(300).optional().default(""),
  category: z.string().trim().max(80).optional(),
  skills: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      if (v === undefined) return [] as string[];
      const arr = Array.isArray(v) ? v : v.split(",");
      return arr.map((s) => s.trim()).filter(Boolean);
    }),
  location: z.string().trim().max(120).optional().default(""),
  minExperience: z.coerce.number().min(0).max(70).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availability: z.enum(["any", "now"]).optional().default("any"),
  sort: z.enum(["relevance", "rating", "experience", "reviews"]).optional().default("relevance"),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(12),
});

export const searchBodySchema = z.object({
  query: z.string().trim().max(500).optional().default(""),
  category: z.string().trim().max(80).optional(),
  skills: z.array(z.string().trim().max(80)).max(40).optional().default([]),
  location: z.string().trim().max(120).optional().default(""),
  budget: z.number().min(0).optional().nullable(),
  urgency: z.enum(["low", "normal", "high", "emergency"]).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(12),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchBody = z.infer<typeof searchBodySchema>;
