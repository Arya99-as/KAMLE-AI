import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, CreditCard, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import type { Quotation } from "../../types";
import { Badge, Button, Modal, Textarea } from "../ui/primitives";
import { EmptyState } from "../ui/states";
import { getMyQuotations, respondToQuotation } from "../../services/api";
import {
  QuotationBreakdown,
  QuotationStatusBadge,
  entityName,
  formatDateTime,
  formatValidUntil,
  isPastDate,
  money,
} from "./quotationUi";

export default function CustomerQuotations({
  onPay,
  refreshKey,
  onOpenPayments,
}: {
  onPay: (quotation: Quotation) => void;
  refreshKey: number;
  onOpenPayments: () => void;
}) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Quotation | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [responding, setResponding] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const response = await getMyQuotations();
      setQuotations(response.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your quotations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function handleAccept(quotation: Quotation) {
    if (!confirm(`Accept the approved amount of ${money(quotation.approvedAmount ?? quotation.total)}?`)) return;
    setResponding(true);
    setNotice(null);
    try {
      await respondToQuotation(quotation._id, "accept");
      setNotice("Quotation accepted. You can now pay the approved amount.");
      await load(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not accept the quotation.");
    } finally {
      setResponding(false);
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    if (rejectNote.trim().length < 3) {
      setNotice("Add a short reason for rejecting the quotation.");
      return;
    }
    setResponding(true);
    setNotice(null);
    try {
      await respondToQuotation(rejecting._id, "reject", rejectNote.trim());
      setRejecting(null);
      setRejectNote("");
      setNotice("Quotation rejected. The worker has been notified to revise the price.");
      await load(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not reject the quotation.");
    } finally {
      setResponding(false);
    }
  }

  const payable = quotations.filter(
    (quotation) => quotation.status === "APPROVED" && quotation.customerStatus === "ACCEPTED" && !quotation.paidAt,
  );
  const awaitingResponse = quotations.filter(
    (quotation) => quotation.status === "APPROVED" && quotation.customerStatus === "PENDING",
  );
  const paidTotal = quotations
    .filter((quotation) => Boolean(quotation.paidAt))
    .reduce((sum, quotation) => sum + Number(quotation.approvedAmount ?? quotation.total), 0);

  if (loading) {
    return (
      <div className="rounded-3xl border border-line bg-white p-10 text-center text-sm text-muted shadow-sm">
        Loading your service quotations…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">Service Quotations</p>
            <h2 className="mt-2 text-2xl font-black text-ink">Approved price → accept → pay</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Your worker proposes a price, the admin reviews it, and only the approved amount can be paid. The
              amount below is set by KAMLE AI and cannot be changed by you.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Awaiting you</p>
              <p className="mt-1 text-lg font-black text-ink">{awaitingResponse.length}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Ready to pay</p>
              <p className="mt-1 text-lg font-black text-brand-700">{money(payable.reduce((sum, q) => sum + Number(q.approvedAmount ?? q.total), 0))}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Paid</p>
              <p className="mt-1 text-lg font-black text-emerald-700">{money(paidTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </span>
          <Button variant="secondary" size="sm" onClick={() => void load(false)}>
            Retry
          </Button>
        </div>
      )}

      {notice && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          {notice}
        </div>
      )}

      <section className="rounded-3xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h3 className="text-lg font-black text-ink">My Quotations</h3>
            <p className="text-xs text-muted">Each quotation is tied to one of your service enquiries.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load(false)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {quotations.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<ShieldCheck size={22} />}
              title="No quotations yet"
              message="When a worker prices your service enquiry and an admin approves it, the quotation will appear here for you to accept and pay."
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {quotations.map((quotation) => {
              const enquiry = typeof quotation.enquiryId === "string" ? null : quotation.enquiryId;
              const expired = quotation.status === "EXPIRED" || (quotation.status === "APPROVED" && isPastDate(quotation.validUntil));
              const canRespond = quotation.status === "APPROVED" && quotation.customerStatus === "PENDING" && !expired && !quotation.paidAt;
              const canPay = quotation.status === "APPROVED" && quotation.customerStatus === "ACCEPTED" && !quotation.paidAt && !expired;
              return (
                <article key={quotation._id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{enquiry?.serviceCategory ?? "Service"}</Badge>
                        <QuotationStatusBadge status={quotation.status} />
                        {quotation.customerStatus === "ACCEPTED" && <Badge tone="success">You accepted</Badge>}
                        {quotation.customerStatus === "REJECTED" && <Badge tone="danger">You rejected</Badge>}
                        {quotation.paidAt && <Badge tone="success">Paid</Badge>}
                        {expired && !quotation.paidAt && <Badge tone="muted">Expired</Badge>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{enquiry?.problemDescription ?? "Service quotation"}</p>
                        <p className="mt-1 text-xs text-muted">
                          Worker: {entityName(quotation.workerId)} · Revision #{quotation.revisionNumber} · Valid until{" "}
                          {formatValidUntil(quotation.validUntil)}
                        </p>
                      </div>

                      <QuotationBreakdown quotation={quotation} />

                      {quotation.adminRemarks && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <span className="font-bold">Admin remarks:</span> {quotation.adminRemarks}
                        </p>
                      )}
                      {quotation.approvedAt && (
                        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                          <span className="font-bold">Admin approval:</span> {money(quotation.approvedAmount)}{" "}
                          by {entityName(quotation.approvedBy)} on {formatDateTime(quotation.approvedAt)}. This amount
                          is locked and cannot be edited.
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:w-60">
                      {canRespond && (
                        <>
                          <Button onClick={() => void handleAccept(quotation)} disabled={responding}>
                            <CheckCircle2 size={15} /> Accept approved amount
                          </Button>
                          <Button variant="secondary" onClick={() => { setRejecting(quotation); setRejectNote(""); setNotice(null); }} disabled={responding}>
                            <XCircle size={15} /> Reject quotation
                          </Button>
                        </>
                      )}
                      {canPay && (
                        <Button onClick={() => onPay(quotation)}>
                          <CreditCard size={15} /> Pay {money(quotation.approvedAmount ?? quotation.total)}
                        </Button>
                      )}
                      {quotation.paidAt && (
                        <>
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            <p className="flex items-center gap-2 font-bold">
                              <CheckCircle2 size={15} /> Payment verified
                            </p>
                            <p className="mt-1 text-xs">Paid on {formatDateTime(quotation.paidAt)}</p>
                          </div>
                          <Button variant="secondary" onClick={onOpenPayments}>
                            <Clock3 size={15} /> View receipt
                          </Button>
                        </>
                      )}
                      {!canRespond && !canPay && !quotation.paidAt && (
                        <div className="rounded-2xl border border-line bg-slate-50 px-4 py-3 text-xs text-muted">
                          {quotation.status === "APPROVED"
                            ? quotation.customerStatus === "ACCEPTED"
                              ? "Accepted — payment is available until the validity date."
                              : expired
                                ? "This quotation expired before it was accepted. Ask the worker to submit a new quote."
                                : "You have already responded to this quotation."
                            : quotation.customerStatus === "REJECTED"
                              ? "You rejected this quotation. The worker can send a revised quote for you to review."
                              : quotation.status === "SUBMITTED" || quotation.status === "UNDER_REVIEW"
                                ? "Waiting for admin review. You can pay only after approval."
                                : quotation.status === "DRAFT"
                                  ? "The worker is still preparing this quotation."
                                  : quotation.status === "REVISION_REQUESTED"
                                    ? "The worker is revising this quotation."
                                    : quotation.status === "REJECTED"
                                      ? "The admin rejected this quotation. No payment is possible."
                                      : "This quotation is no longer payable."}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={Boolean(rejecting)} onClose={() => !responding && setRejecting(null)} title="Reject quotation">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Rejecting tells the worker and admin that this price is not acceptable. You can accept a revised
            quotation later.
          </p>
          <Textarea
            rows={4}
            value={rejectNote}
            onChange={(event) => setRejectNote(event.target.value)}
            placeholder="Why are you rejecting this quotation?"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)} disabled={responding}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleReject()} disabled={responding}>
              {responding ? "Submitting…" : "Reject quotation"}
            </Button>
          </div>
          {notice && <p className="text-xs font-semibold text-rose-700">{notice}</p>}
        </div>
      </Modal>
    </div>
  );
}
