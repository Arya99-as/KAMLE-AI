import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  CreditCard,
  IndianRupee,
  Landmark,
  RefreshCw,
  Scale,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import type { Payment, Payout, PlatformConfig, Quotation } from "../../types";
import { Badge, Button, Field, Modal, Select, Textarea } from "../ui/primitives";
import { EmptyState } from "../ui/states";
import {
  adminGetConfig,
  adminPaymentDetail,
  adminPayments,
  adminPayouts,
  adminQuotationDecision,
  adminQuotations,
  adminReconcilePayment,
  adminUpdatePayoutStatus,
  type PaymentConsistencyCheck,
} from "../../services/api";
import {
  QuotationBreakdown,
  QuotationStatusBadge,
  entityName,
  formatDateTime,
  money,
} from "./quotationUi";

type AdminTab = "quotations" | "payments" | "payouts";
type Decision = "approve" | "reject" | "request_revision";

const QUOTATION_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All quotations" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REVISION_REQUESTED", label: "Revision requested" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
  { value: "DRAFT", label: "Draft" },
];

const PAYMENT_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "All payments" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Paid / verified" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUND_REQUESTED", label: "Refund requested" },
  { value: "REFUNDED", label: "Refunded" },
];

function quotationEnquiryId(quotation: Quotation): string {
  return typeof quotation.enquiryId === "string" ? quotation.enquiryId : quotation.enquiryId._id;
}

function refId(value: string | { _id?: string } | undefined | null): string {
  if (!value) return "";
  return typeof value === "string" ? value : value._id ?? "";
}

function paymentStatusLabel(status: Payment["status"]): string {
  if (status === "COMPLETED") return "Paid";
  if (status === "PENDING") return "Pending";
  if (status === "REFUND_REQUESTED") return "Refund Requested";
  if (status === "REFUNDED") return "Refunded";
  return "Failed";
}

function paymentTone(status: Payment["status"]): "success" | "warning" | "danger" | "muted" {
  if (status === "COMPLETED") return "success";
  if (status === "PENDING" || status === "REFUND_REQUESTED") return "warning";
  if (status === "REFUNDED") return "muted";
  return "danger";
}

export default function AdminQuotations() {
  const [tab, setTab] = useState<AdminTab>("quotations");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [quotationFilter, setQuotationFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [decisionTarget, setDecisionTarget] = useState<Quotation | null>(null);
  const [decision, setDecision] = useState<Decision>("approve");
  const [remarks, setRemarks] = useState("");
  const [working, setWorking] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState<Payment | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<{
    payment: Payment;
    payout: Payout | null;
    checks: PaymentConsistencyCheck[];
  } | null>(null);
  const [paymentDetailLoading, setPaymentDetailLoading] = useState(false);
  const [reconcileAction, setReconcileAction] = useState<"sync" | "request_refund" | "mark_refunded">("sync");
  const [reconcileNote, setReconcileNote] = useState("");

  const load = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [quotes, paymentPage, payoutPage, configRes] = await Promise.all([
          adminQuotations(quotationFilter || undefined),
          adminPayments(paymentFilter || undefined),
          adminPayouts(),
          adminGetConfig().catch(() => null),
        ]);
        setQuotations(quotes.items ?? []);
        setPayments(paymentPage.items ?? []);
        setPayouts(payoutPage.items ?? []);
        if (configRes) setConfig(configRes.config);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the approval workspace.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [quotationFilter, paymentFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const paymentsByEnquiry = useMemo(() => {
    const map = new Map<string, Payment>();
    for (const payment of payments) map.set(refId(payment.enquiryId as string | { _id?: string }), payment);
    return map;
  }, [payments]);

  const kpis = useMemo(() => {
    const commission = payments
      .filter((payment) => payment.status === "COMPLETED")
      .reduce((sum, payment) => sum + Number(payment.commissionAmount || 0), 0);
    const verified = payments.filter((payment) => payment.status === "COMPLETED").reduce((sum, p) => sum + p.amount, 0);
    return {
      pendingReview: quotations.filter((quotation) => ["SUBMITTED", "UNDER_REVIEW"].includes(quotation.status)).length,
      approved: quotations.filter((quotation) => quotation.status === "APPROVED").length,
      verified,
      commission,
      pendingPayouts: payouts.filter((payout) => ["PENDING", "PROCESSING"].includes(payout.status)).length,
    };
  }, [quotations, payments, payouts]);

  function openDecision(quotation: Quotation, next: Decision) {
    setDecisionTarget(quotation);
    setDecision(next);
    setRemarks(quotation.adminRemarks || "");
    setNotice(null);
  }

  async function submitDecision() {
    if (!decisionTarget) return;
    if (decision !== "approve" && remarks.trim().length < 5) {
      setNotice("Add remarks (at least 5 characters) for a rejection or revision request.");
      return;
    }
    setWorking(true);
    setNotice(null);
    try {
      await adminQuotationDecision(decisionTarget._id, decision, remarks.trim());
      setDecisionTarget(null);
      setNotice(
        decision === "approve"
          ? "Quotation approved. The customer can now accept and pay the locked amount."
          : decision === "reject"
            ? "Quotation rejected and the worker has been notified."
            : "Revision requested from the worker.",
      );
      await load(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not record the decision.");
    } finally {
      setWorking(false);
    }
  }

  async function openPayment(payment: Payment) {
    setPaymentTarget(payment);
    setPaymentDetail(null);
    setReconcileAction("sync");
    setReconcileNote("");
    setPaymentDetailLoading(true);
    try {
      const response = await adminPaymentDetail(payment._id);
      setPaymentDetail({ payment: response.payment, payout: response.payout, checks: response.checks });
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load the verified payment.");
    } finally {
      setPaymentDetailLoading(false);
    }
  }

  async function submitReconcile() {
    if (!paymentTarget) return;
    if (reconcileAction !== "sync" && reconcileNote.trim().length < 3) {
      setNotice("Add a note explaining the refund action.");
      return;
    }
    setWorking(true);
    setNotice(null);
    try {
      await adminReconcilePayment(paymentTarget._id, reconcileAction, reconcileNote.trim());
      setPaymentTarget(null);
      setPaymentDetail(null);
      setNotice("Payment reconciliation recorded and audit-logged.");
      await load(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not reconcile the payment.");
    } finally {
      setWorking(false);
    }
  }

  async function updatePayout(payout: Payout, status: "PROCESSING" | "PAID" | "FAILED") {
    let providerPayoutRef: string | undefined;
    if (status === "PAID") {
      const input = prompt("Enter the verified payout reference (UTR / provider payout ID). Do not mark paid without one.");
      if (!input || input.trim().length < 3) {
        setNotice("A payout reference is required before marking a payout as paid.");
        return;
      }
      providerPayoutRef = input.trim();
    }
    setWorking(true);
    setNotice(null);
    try {
      await adminUpdatePayoutStatus(payout._id, status, providerPayoutRef, "Updated from quotation & payout console");
      setNotice(`Payout marked ${status.toLowerCase()}.`);
      await load(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update the payout.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-line bg-white p-10 text-center text-sm text-muted shadow-sm">
        Loading quotation and payment approvals…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">Quotation &amp; Payment Approval</p>
            <h2 className="mt-2 text-2xl font-black">Review prices, verify payments, release payouts</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Workers propose prices. You approve, reject, or request a revision. Customers can pay only the
              admin-approved amount, and every decision is audit-logged with your admin ID and timestamp.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Pending review</p>
              <p className="mt-1 text-xl font-black">{kpis.pendingReview}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Approved quotes</p>
              <p className="mt-1 text-xl font-black">{kpis.approved}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Verified revenue</p>
              <p className="mt-1 text-xl font-black">{money(kpis.verified)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Commission</p>
              <p className="mt-1 text-xl font-black">{money(kpis.commission)}</p>
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

      <div className="rounded-3xl border border-line bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 pt-3">
          <div className="flex gap-1 overflow-x-auto">
            {(
              [
                { key: "quotations", label: `Quotation Requests${kpis.pendingReview ? ` (${kpis.pendingReview})` : ""}` },
                { key: "payments", label: "Payment Monitoring" },
                { key: "payouts", label: `Commission & Payouts${kpis.pendingPayouts ? ` (${kpis.pendingPayouts})` : ""}` },
              ] as Array<{ key: AdminTab; label: string }>
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold transition ${
                  tab === item.key
                    ? "border-indigo-600 bg-white text-indigo-700"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load(false)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {tab === "quotations" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <p className="text-xs text-muted">
                Commission configured at{" "}
                <span className="font-bold text-ink">{config?.commissionPercent ?? "—"}%</span> — snapshotted on each
                payment.
              </p>
              <Select value={quotationFilter} onChange={(event) => setQuotationFilter(event.target.value)} className="w-52">
                {QUOTATION_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </Select>
            </div>

            {quotations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ClipboardCheck size={22} />}
                  title="No quotations in this view"
                  message="Worker quotations will appear here as soon as they are submitted for review."
                />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {quotations.map((quotation) => {
                  const enquiry = typeof quotation.enquiryId === "string" ? null : quotation.enquiryId;
                  const payment = paymentsByEnquiry.get(quotationEnquiryId(quotation));
                  const decidable = ["SUBMITTED", "UNDER_REVIEW"].includes(quotation.status);
                  const open = expanded === quotation._id;
                  return (
                    <article key={quotation._id} className="p-5 sm:p-6">
                      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <QuotationStatusBadge status={quotation.status} />
                            <Badge tone="brand">{enquiry?.serviceCategory ?? "Service"}</Badge>
                            <Badge tone={payment ? paymentTone(payment.status) : "muted"}>
                              Payment: {payment ? paymentStatusLabel(payment.status) : "Not Initiated"}
                            </Badge>
                            {quotation.paidAt && <Badge tone="success">Paid</Badge>}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-ink">{enquiry?.problemDescription ?? "Service quotation"}</p>
                            <p className="mt-1 text-xs text-muted">
                              Worker: {entityName(quotation.workerId)} · Customer: {entityName(quotation.customerId)} ·
                              Revision #{quotation.revisionNumber}
                            </p>
                          </div>

                          <div className="grid gap-2 text-xs text-muted sm:grid-cols-2">
                            <p>
                              <span className="font-bold text-ink">Labour:</span> {money(quotation.labourCharges)}
                            </p>
                            <p>
                              <span className="font-bold text-ink">Material:</span> {money(quotation.materialCharges)}
                            </p>
                            <p>
                              <span className="font-bold text-ink">Additional:</span>{" "}
                              {money(
                                quotation.additionalCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
                              )}
                            </p>
                            <p>
                              <span className="font-bold text-ink">Completion:</span>{" "}
                              {quotation.estimatedCompletionTime || "—"}
                            </p>
                          </div>

                          <button
                            onClick={() => setExpanded(open ? null : quotation._id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
                          >
                            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {open ? "Hide full breakdown & history" : "Full breakdown & history"}
                          </button>

                          {open && (
                            <div className="space-y-3">
                              <QuotationBreakdown quotation={quotation} />
                              {quotation.adminRemarks && (
                                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                  <span className="font-bold">Admin remarks:</span> {quotation.adminRemarks}
                                </p>
                              )}
                              <div className="rounded-2xl border border-line p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted">Quotation history</p>
                                <div className="mt-2 space-y-2">
                                  {(quotation.history ?? []).map((event, index) => (
                                    <div key={`${event.status}-${index}`} className="flex items-start justify-between gap-3 text-xs">
                                      <div>
                                        <span className="font-bold text-ink">{event.status.replace(/_/g, " ")}</span>{" "}
                                        <span className="text-muted">by {event.role}</span>
                                        {event.note && <p className="text-muted">{event.note}</p>}
                                      </div>
                                      <span className="shrink-0 text-muted">{formatDateTime(event.at)}</span>
                                    </div>
                                  ))}
                                </div>
                                {quotation.approvedAt && (
                                  <p className="mt-2 text-xs text-emerald-700">
                                    Approved by {entityName(quotation.approvedBy)} (admin) on {formatDateTime(quotation.approvedAt)}.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 xl:w-64">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                              {quotation.approvedAmount !== undefined ? "Approved amount" : "Proposed total"}
                            </p>
                            <p className="text-xl font-black text-ink">{money(quotation.approvedAmount ?? quotation.total)}</p>
                            <p className="text-[10px] text-muted">
                              Customer: {quotation.customerStatus.replace("_", " ").toLowerCase()}
                            </p>
                          </div>
                          {decidable ? (
                            <>
                              <Button size="sm" onClick={() => openDecision(quotation, "approve")} disabled={working}>
                                <CheckCircle2 size={14} /> Approve price
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => openDecision(quotation, "request_revision")} disabled={working}>
                                <RefreshCw size={14} /> Request revision
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => openDecision(quotation, "reject")} disabled={working}>
                                <XCircle size={14} /> Reject quotation
                              </Button>
                            </>
                          ) : (
                            <p className="rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-muted">
                              {quotation.status === "APPROVED"
                                ? "Amount locked. Customer payment can now be monitored."
                                : quotation.status === "DRAFT"
                                  ? "Worker has not submitted this quotation yet."
                                  : "No further decision is available for this quotation."}
                            </p>
                          )}
                          {payment && (
                            <Button size="sm" variant="secondary" onClick={() => void openPayment(payment)}>
                              <ShieldCheck size={14} /> Inspect payment
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "payments" && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <p className="text-xs text-muted">
                <span className="font-bold text-ink">{payments.length}</span> payment records. Only backend-verified
                signatures/webhooks settle a payment.
              </p>
              <Select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="w-52">
                {PAYMENT_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </Select>
            </div>

            {payments.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<CreditCard size={22} />}
                  title="No payments recorded"
                  message="Customer payments appear here once an approved quotation is accepted and paid."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-line bg-slate-50 text-xs font-bold uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-3">Customer / Worker</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Commission</th>
                      <th className="px-4 py-3">Worker payable</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Provider refs</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payments.map((payment) => (
                      <tr key={payment._id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-ink">{entityName(payment.customerId)}</p>
                          <p className="text-xs text-muted">Worker: {entityName(payment.workerId)}</p>
                        </td>
                        <td className="px-4 py-4 font-black text-ink">{money(payment.amount)}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-rose-700">{money(payment.commissionAmount)}</p>
                          <p className="text-xs text-muted">{payment.commissionPercent}%</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-emerald-700">{money(payment.workerPayableAmount)}</td>
                        <td className="px-4 py-4">
                          <Badge tone={paymentTone(payment.status)}>{paymentStatusLabel(payment.status)}</Badge>
                        </td>
                        <td className="px-4 py-4 text-xs text-muted">
                          <p className="font-mono">{payment.transactionRef}</p>
                          <p className="font-mono">{payment.providerPaymentId || payment.providerOrderId || "—"}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button size="sm" variant="secondary" onClick={() => void openPayment(payment)}>
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "payouts" && (
          <div>
            <div className="border-b border-line px-5 py-3 text-xs text-muted">
              Worker earnings are separate from platform commission. A payout is marked paid only with a real
              provider/payout reference.
            </div>
            {payouts.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Wallet size={22} />}
                  title="No payout records"
                  message="A payout record is created automatically when a customer payment is verified."
                />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {payouts.map((payout) => (
                  <article key={payout._id} className="flex flex-col gap-4 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            payout.status === "PAID"
                              ? "success"
                              : payout.status === "FAILED"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {payout.status}
                        </Badge>
                        <Badge tone="muted">{entityName(payout.workerId)}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">
                        Gross {money(payout.serviceAmount)} · Commission {money(payout.commissionAmount)} · Worker{" "}
                        {money(payout.workerPayableAmount)}
                      </p>
                      <p className="text-xs text-muted">
                        {payout.providerPayoutRef ? `Ref: ${payout.providerPayoutRef}` : "No payout reference yet"} ·{" "}
                        Created {formatDateTime(payout.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {payout.status === "PENDING" && (
                        <Button size="sm" variant="secondary" onClick={() => void updatePayout(payout, "PROCESSING")} disabled={working}>
                          Mark processing
                        </Button>
                      )}
                      {(payout.status === "PENDING" || payout.status === "PROCESSING") && (
                        <Button size="sm" onClick={() => void updatePayout(payout, "PAID")} disabled={working}>
                          <Landmark size={14} /> Mark paid
                        </Button>
                      )}
                      {payout.status !== "PAID" && payout.status !== "FAILED" && (
                        <Button size="sm" variant="ghost" onClick={() => void updatePayout(payout, "FAILED")} disabled={working}>
                          Mark failed
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <Scale size={14} /> Commission source
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">
            PlatformConfig · {config?.commissionPercent ?? "—"}%
          </p>
          <p className="text-xs text-muted">Configured centrally, never hardcoded per quotation.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <IndianRupee size={14} /> Separation of money
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">Payment, commission, earnings, payout</p>
          <p className="text-xs text-muted">Four distinct records; no payout is implied by a payment.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <ShieldCheck size={14} /> Audit trail
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">Every decision logged</p>
          <p className="text-xs text-muted">Approvals, rejections and refunds store your admin ID and timestamp.</p>
        </div>
      </div>

      <Modal
        open={Boolean(decisionTarget)}
        onClose={() => !working && setDecisionTarget(null)}
        title={
          decision === "approve"
            ? "Approve quotation"
            : decision === "reject"
              ? "Reject quotation"
              : "Request a price revision"
        }
      >
        <div className="space-y-4">
          {decisionTarget && (
            <div className="rounded-2xl border border-line bg-slate-50 p-4 text-sm">
              <p className="font-bold text-ink">{entityName(decisionTarget.workerId)}</p>
              <p className="text-xs text-muted">
                Proposed total {money(decisionTarget.total)} · Revision #{decisionTarget.revisionNumber}
              </p>
              <p className="mt-1 text-xs text-muted">
                Approved amount will be locked at {money(decisionTarget.total)}. The customer cannot change it.
              </p>
            </div>
          )}
          <Field
            label={decision === "approve" ? "Admin remarks (optional)" : "Remarks (required)"}
            hint={
              decision === "approve"
                ? "Leave a note for the worker/customer."
                : "Explain what needs to change. This is visible to the worker."
            }
          >
            <Textarea rows={4} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDecisionTarget(null)} disabled={working}>
              Cancel
            </Button>
            <Button
              variant={decision === "reject" ? "danger" : "primary"}
              onClick={() => void submitDecision()}
              disabled={working}
            >
              {working ? "Saving…" : decision === "approve" ? "Approve & lock amount" : decision === "reject" ? "Reject quotation" : "Request revision"}
            </Button>
          </div>
          {notice && <p className="text-xs font-semibold text-blue-700">{notice}</p>}
        </div>
      </Modal>

      <Modal
        open={Boolean(paymentTarget)}
        onClose={() => !working && setPaymentTarget(null)}
        title="Verified payment record"
        wide
      >
        <div className="space-y-4">
          {paymentDetailLoading && <p className="text-sm text-muted">Loading verified payment detail…</p>}
          {paymentDetail && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-line p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Customer paid</p>
                  <p className="mt-1 text-lg font-black text-ink">{money(paymentDetail.payment.amount)}</p>
                </div>
                <div className="rounded-2xl border border-line p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Platform commission</p>
                  <p className="mt-1 text-lg font-black text-rose-700">{money(paymentDetail.payment.commissionAmount)}</p>
                </div>
                <div className="rounded-2xl border border-line p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Worker payable</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">{money(paymentDetail.payment.workerPayableAmount)}</p>
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border border-line p-4 text-sm">
                <p>
                  <span className="font-bold text-ink">Status:</span>{" "}
                  <Badge tone={paymentTone(paymentDetail.payment.status)}>{paymentStatusLabel(paymentDetail.payment.status)}</Badge>
                </p>
                <p className="text-xs text-muted">
                  Transaction {paymentDetail.payment.transactionRef} · verified {formatDateTime(paymentDetail.payment.verifiedAt)}
                </p>
                <p className="text-xs text-muted">
                  Provider order {paymentDetail.payment.providerOrderId || "—"} · payment{" "}
                  {paymentDetail.payment.providerPaymentId || "—"} · method {paymentDetail.payment.paymentMethod || "—"}
                </p>
                <p className="text-xs text-muted">
                  Payout: {paymentDetail.payout ? `${paymentDetail.payout.status} · ${money(paymentDetail.payout.workerPayableAmount)}` : "No payout record"}
                </p>
              </div>

              <div className="rounded-2xl border border-line p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">Consistency checks</p>
                <div className="mt-2 space-y-2">
                  {paymentDetail.checks.map((check) => (
                    <div key={check.key} className="flex items-start gap-2 text-xs">
                      {check.ok ? (
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-600" />
                      )}
                      <div>
                        <p className="font-bold text-ink">{check.key.replace(/_/g, " ")}</p>
                        <p className="text-muted">{check.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Field label="Reconciliation action">
                  <Select
                    value={reconcileAction}
                    onChange={(event) => setReconcileAction(event.target.value as typeof reconcileAction)}
                  >
                    <option value="sync">Sync derived records (non-destructive)</option>
                    <option value="request_refund">Request refund</option>
                    <option value="mark_refunded">Mark refunded (only after real refund)</option>
                  </Select>
                </Field>
                <Field label="Note" hint="Required for refund actions.">
                  <Textarea rows={2} value={reconcileNote} onChange={(event) => setReconcileNote(event.target.value)} />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setPaymentTarget(null)} disabled={working}>
                    Close
                  </Button>
                  <Button onClick={() => void submitReconcile()} disabled={working}>
                    {working ? "Applying…" : "Apply reconciliation"}
                  </Button>
                </div>
              </div>
            </>
          )}
          {notice && <p className="text-xs font-semibold text-blue-700">{notice}</p>}
        </div>
      </Modal>
    </div>
  );
}
