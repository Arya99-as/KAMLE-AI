import type { ReactNode } from "react";
import { Badge } from "../ui/primitives";
import type { Quotation, QuotationStatus, UserRef } from "../../types";

const STATUS_TONE: Record<QuotationStatus, "default" | "brand" | "success" | "danger" | "warning" | "muted"> = {
  DRAFT: "muted",
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVISION_REQUESTED: "brand",
  EXPIRED: "muted",
};

const STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISION_REQUESTED: "Revision Requested",
  EXPIRED: "Expired",
};

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "default"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function entityName(ref: string | UserRef | { name?: string } | null | undefined): string {
  if (!ref) return "—";
  if (typeof ref === "string") return ref;
  return ref.name || "—";
}

export function money(value: number | undefined | null): string {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatValidUntil(value?: string | Date | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function isPastDate(value?: string | Date | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export function QuotationBreakdown({
  quotation,
  showApproved = true,
  footer,
}: {
  quotation: Quotation;
  showApproved?: boolean;
  footer?: ReactNode;
}) {
  const additionalTotal = (quotation.additionalCharges ?? []).reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
  return (
    <div className="rounded-2xl border border-line bg-slate-50/60 p-4">
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Labour charges</dt>
          <dd className="font-semibold text-ink">{money(quotation.labourCharges)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Material charges</dt>
          <dd className="font-semibold text-ink">{money(quotation.materialCharges)}</dd>
        </div>
        {(quotation.additionalCharges ?? []).length > 0 && (
          <div className="space-y-1.5 border-t border-dashed border-line pt-2">
            {quotation.additionalCharges.map((charge, index) => (
              <div key={`${charge.description}-${index}`} className="flex items-start justify-between gap-3">
                <dt className="text-muted">{charge.description || "Additional charge"}</dt>
                <dd className="font-semibold text-ink">{money(charge.amount)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <dt>Additional charges total</dt>
              <dd>{money(additionalTotal)}</dd>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
          <dt className="font-semibold text-ink">Quoted subtotal</dt>
          <dd className="font-semibold text-ink">{money(quotation.subtotal)}</dd>
        </div>
        {showApproved && quotation.approvedAmount !== undefined && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2">
            <dt className="font-bold text-emerald-800">Admin-approved amount</dt>
            <dd className="text-base font-black text-emerald-800">{money(quotation.approvedAmount)}</dd>
          </div>
        )}
        {showApproved && quotation.approvedAmount === undefined && (
          <div className="flex items-center justify-between gap-3 text-xs text-muted">
            <dt>Total payable after admin approval</dt>
            <dd>{money(quotation.total)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        <span>
          <span className="font-semibold text-ink">Completion:</span> {quotation.estimatedCompletionTime || "—"}
        </span>
        <span>
          <span className="font-semibold text-ink">Valid until:</span> {formatValidUntil(quotation.validUntil)}
        </span>
        <span>
          <span className="font-semibold text-ink">Revision:</span> #{quotation.revisionNumber}
        </span>
      </div>
      {quotation.notes && <p className="mt-2 text-xs text-muted">{quotation.notes}</p>}
      {footer}
    </div>
  );
}
