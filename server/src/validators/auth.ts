import { z } from "zod";

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, "Enter a valid phone number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(120),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  phone,
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(["customer", "worker"]).default("customer"),
  location: z.string().trim().max(120).optional().or(z.literal("")),
});

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(3, "Enter your phone or email").optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((d) => d.identifier || d.phone || d.email, {
    message: "Provide a phone number or email",
    path: ["identifier"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().max(120).optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
