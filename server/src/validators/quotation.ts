import { z } from "zod";

const money = z.coerce.number().min(0).max(10_000_000);

export const quotationPayloadSchema = z
  .object({
    enquiryId: z.string().trim().optional(),
    labourCharges: money.optional().default(0),
    materialCharges: money.optional().default(0),
    additionalCharges: z
      .array(
        z.object({
          description: z.string().trim().min(1, "Describe the additional charge").max(120),
          amount: money,
        }),
      )
      .max(10)
      .optional()
      .default([]),
    estimatedCompletionTime: z.string().trim().min(1, "Estimated completion time is required").max(120),
    validUntil: z.coerce.date(),
    notes: z.string().trim().max(1000).optional().default(""),
  })
  .refine(
    (v) =>
      v.labourCharges + v.materialCharges + v.additionalCharges.reduce((sum, c) => sum + c.amount, 0) > 0,
    { message: "A quotation must include at least one charge greater than zero", path: ["labourCharges"] },
  );

export type QuotationPayload = z.infer<typeof quotationPayloadSchema>;

export const adminQuotationDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject", "request_revision"]),
    remarks: z.string().trim().max(1000).optional().default(""),
  })
  .refine((v) => v.decision === "approve" || v.remarks.trim().length >= 5, {
    message: "Remarks are required when rejecting or requesting a revision",
    path: ["remarks"],
  });

export const adminQuotationRemarksSchema = z.object({
  remarks: z.string().trim().min(1, "Remarks are required").max(1000),
});

export const customerQuotationResponseSchema = z.object({
  response: z.enum(["accept", "reject"]),
  note: z.string().trim().max(500).optional().default(""),
});

export const paymentReconcileSchema = z
  .object({
    action: z.enum(["sync", "request_refund", "mark_refunded"]),
    note: z.string().trim().max(500).optional().default(""),
  })
  .refine((v) => v.action === "sync" || v.note.trim().length >= 3, {
    message: "A note is required for refund actions",
    path: ["note"],
  });
