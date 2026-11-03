import { z } from "zod";

export const chatMessageSchema = z.object({
  /** Preferred identifier for the conversation. */
  conversationId: z.string().trim().min(6).max(80).optional(),
  /** Legacy identifier retained for older clients. */
  sessionKey: z.string().trim().min(6).max(80).optional(),
  message: z.string().trim().min(1, "Type a message").max(1000),
});

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .refine((v) => v.title !== undefined || v.status !== undefined, {
    message: "Provide a title or a status to update",
  });

export const requirementsSchema = z.object({
  service_category: z.string().trim().max(80).nullable().default(null),
  required_skills: z.array(z.string().trim().max(80)).max(30).default([]),
  location: z.string().trim().max(120).nullable().default(null),
  budget: z.number().min(0).nullable().default(null),
  urgency: z.enum(["low", "normal", "high", "emergency"]).default("normal"),
  missing_information: z.array(z.string().trim().max(120)).max(10).default([]),
  search_ready: z.boolean().default(false),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type RequirementsInput = z.infer<typeof requirementsSchema>;
