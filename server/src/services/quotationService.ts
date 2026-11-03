import Quotation, { type IQuotation, type QuotationStatus } from "../models/Quotation.js";

export const QUOTATION_OPEN_STATUSES: QuotationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"];
export const QUOTATION_DECIDABLE_STATUSES: QuotationStatus[] = ["SUBMITTED", "UNDER_REVIEW"];
export const QUOTATION_EDITABLE_STATUSES: QuotationStatus[] = ["DRAFT", "REVISION_REQUESTED", "REJECTED", "EXPIRED"];

export interface ChargeBreakdown {
  labourCharges: number;
  materialCharges: number;
  additionalCharges: { description: string; amount: number }[];
}

/** Server-side money authority: never trusts a client-supplied total. */
export function computeSubtotal(breakdown: ChargeBreakdown): number {
  const labour = Number(breakdown.labourCharges) || 0;
  const material = Number(breakdown.materialCharges) || 0;
  const additional = (breakdown.additionalCharges ?? []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  return Math.round((labour + material + additional) * 100) / 100;
}

export function isQuotationExpired(quotation: Pick<IQuotation, "status" | "validUntil" | "paidAt">, now = new Date()): boolean {
  if (quotation.paidAt) return false;
  if (!["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(quotation.status)) return false;
  return new Date(quotation.validUntil).getTime() < now.getTime();
}

/**
 * Lazily expires a quotation when its validity window has passed. There is no
 * background scheduler, so every read/payment path calls this before acting.
 */
export async function expireQuotationIfNeeded(quotation: IQuotation): Promise<IQuotation> {
  if (!isQuotationExpired(quotation)) return quotation;

  quotation.status = "EXPIRED";
  quotation.history.push({
    status: "EXPIRED",
    at: new Date(),
    role: "system",
    note: "Quotation validity period elapsed",
  });
  await quotation.save();
  return quotation;
}

/** The only quotation that may be paid: approved by an admin, accepted by the customer. */
export async function getPayableQuotation(enquiryId: string) {
  const quotation = await Quotation.findOne({ enquiryId });
  if (!quotation) return null;
  await expireQuotationIfNeeded(quotation);
  return quotation;
}
