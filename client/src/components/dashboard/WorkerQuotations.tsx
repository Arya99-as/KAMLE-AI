import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import type { Enquiry, Quotation, QuotationAdditionalCharge } from "../../types";
import { Badge, Button, Field, Input, Modal, Textarea } from "../ui/primitives";
import { EmptyState } from "../ui/states";
import { createQuotation, getMyQuotations, getWorkerEarnings, submitQuotation, updateQuotation } from "../../services/api";
import { QuotationBreakdown, QuotationStatusBadge, entityName, formatDateTime, formatValidUntil, money } from "./quotationUi";

const EDITABLE = new Set(["DRAFT", "REVISION_REQUESTED", "REJECTED", "EXPIRED"]);
const QUOTABLE_ENQUIRY_STATUSES = new Set(["PENDING", "SENT", "ACCEPTED", "IN_PROGRESS"]);

interface ChargeRow extends QuotationAdditionalCharge {
  key: string;
}

interface QuoteForm {
  labourCharges: string;
  materialCharges: string;
  additionalCharges: ChargeRow[];
  estimatedCompletionTime: string;
  validUntil: string;
  notes: string;
}

const emptyForm = (): QuoteForm => ({
  labourCharges: "",
  materialCharges: "",
  additionalCharges: [],
  estimatedCompletionTime: "",
  validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  notes: "",
});

function formFromQuotation(quotation: Quotation): QuoteForm {
  return {
    labourCharges: String(quotation.labourCharges || ""),
    materialCharges: String(quotation.materialCharges || ""),
    additionalCharges: (quotation.additionalCharges ?? []).map((charge, index) => ({
      ...charge,
      key: `existing-${index}`,
    })),
    estimatedCompletionTime: quotation.estimatedCompletionTime || "",
    validUntil: new Date(quotation.validUntil).toISOString().slice(0, 10),
    notes: quotation.notes || "",
  };
}

function enquiryIdOf(quotation: Quotation): string {
  return typeof quotation.enquiryId === "string" ? quotation.enquiryId : quotation.enquiryId._id;
}

export default function WorkerQuotations({ enquiries }: { enquiries: Enquiry[] }) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<{ netPayable: number; pendingPayouts: number; totalPaidOut: number } | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [formEnquiryId, setFormEnquiryId] = useState("");
  const [form, setForm] = useState<QuoteForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Quotation | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [quotes, earn] = await Promise.all([
        getMyQuotations(),
        getWorkerEarnings().catch(() => null),
      ]);
      setQuotations(quotes.items ?? []);
      if (earn) setEarnings(earn.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load quotations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const quotationsByEnquiry = useMemo(() => {
    const map = new Map<string, Quotation>();
    for (const quotation of quotations) map.set(enquiryIdOf(quotation), quotation);
    return map;
  }, [quotations]);

  const totals = useMemo(() => {
    return quotations.reduce(
      (acc, quotation) => {
        if (quotation.status === "APPROVED" && quotation.customerStatus === "ACCEPTED" && !quotation.paidAt) {
          acc.awaitingPayment += quotation.approvedAmount ?? quotation.total;
        }
        if (quotation.paidAt) acc.paid += quotation.approvedAmount ?? quotation.total;
        if (["SUBMITTED", "UNDER_REVIEW"].includes(quotation.status)) acc.underReview += 1;
        if (quotation.status === "REVISION_REQUESTED") acc.revision += 1;
        return acc;
      },
      { awaitingPayment: 0, paid: 0, underReview: 0, revision: 0 },
    );
  }, [quotations]);

  function openEditor(enquiry: Enquiry) {
    const existing = quotationsByEnquiry.get(enquiry._id) ?? null;
    setEditingQuotation(existing);
    setFormEnquiryId(enquiry._id);
    setForm(existing ? formFromQuotation(existing) : emptyForm());
    setEditorOpen(true);
    setNotice(null);
  }

  function updateCharge(key: string, patch: Partial<ChargeRow>) {
    setForm((prev) => ({
      ...prev,
      additionalCharges: prev.additionalCharges.map((charge) => (charge.key === key ? { ...charge, ...patch } : charge)),
    }));
  }

  function addCharge() {
    setForm((prev) => ({
      ...prev,
      additionalCharges: [
        ...prev.additionalCharges,
        { key: `new-${Date.now()}-${prev.additionalCharges.length}`, description: "", amount: 0 },
      ],
    }));
  }

  function removeCharge(key: string) {
    setForm((prev) => ({
      ...prev,
      additionalCharges: prev.additionalCharges.filter((charge) => charge.key !== key),
    }));
  }

  const previewTotal =
    Number(form.labourCharges || 0) +
    Number(form.materialCharges || 0) +
    form.additionalCharges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);

  async function persistDraft(): Promise<Quotation | null> {
    if (!formEnquiryId) return null;
    if (previewTotal <= 0) {
      setNotice("Add at least one charge greater than zero before saving.");
      return null;
    }
    if (!form.estimatedCompletionTime.trim()) {
      setNotice("Add an estimated completion time.");
      return null;
    }
    if (!form.validUntil || new Date(form.validUntil).getTime() <= Date.now()) {
      setNotice("Choose a quotation validity date in the future.");
      return null;
    }
    const payload = {
      enquiryId: formEnquiryId,
      labourCharges: Number(form.labourCharges || 0),
      materialCharges: Number(form.materialCharges || 0),
      additionalCharges: form.additionalCharges.map((charge) => ({
        description: charge.description.trim(),
        amount: Number(charge.amount || 0),
      })),
      estimatedCompletionTime: form.estimatedCompletionTime.trim(),
      validUntil: new Date(`${form.validUntil}T23:59:59`).toISOString(),
      notes: form.notes.trim(),
    };

    const response = editingQuotation
      ? await updateQuotation(editingQuotation._id, payload)
      : await createQuotation(payload);
    return response.quotation;
  }

  async function handleSaveDraft() {
    setSaving(true);
    setNotice(null);
    try {
      const saved = await persistDraft();
      if (!saved) return;
      setEditingQuotation(saved);
      setNotice("Draft saved. Submit it to the admin when you are ready.");
      await load(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save the quotation.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    setNotice(null);
    try {
      const saved = await persistDraft();
      if (!saved) return;
      await submitQuotation(saved._id);
      setEditorOpen(false);
      setEditingQuotation(null);
      setNotice("Quotation submitted for admin approval.");
      await load(false);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not submit the quotation.");
    } finally {
      setSaving(false);
    }
  }

  const pendingEnquiries = enquiries.filter((enquiry) => {
    if (!QUOTABLE_ENQUIRY_STATUSES.has(String(enquiry.status).toUpperCase())) return false;
    const existing = quotationsByEnquiry.get(enquiry._id);
    if (!existing) return true;
    return EDITABLE.has(existing.status) || existing.status === "REJECTED";
  });

  if (loading) {
    return (
      <div className="rounded-3xl border border-line bg-white p-10 text-center text-sm text-muted shadow-sm">
        Loading your pricing workspace…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Service Pricing / Quotations</p>
            <h2 className="mt-2 text-2xl font-black">Quote your assigned jobs</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-300">
              Price the work, submit it for admin approval, and track the approval and payment status. Only an
              admin-approved quotation can be paid by the customer.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Awaiting review</p>
              <p className="mt-1 text-xl font-black">{totals.underReview}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Revisions</p>
              <p className="mt-1 text-xl font-black">{totals.revision}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Approved, unpaid</p>
              <p className="mt-1 text-xl font-black">{money(totals.awaitingPayment)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Net earnings</p>
              <p className="mt-1 text-xl font-black">{money(earnings?.netPayable ?? 0)}</p>
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
            <h3 className="text-lg font-black text-ink">My Enquiries &amp; Pricing</h3>
            <p className="text-xs text-muted">Only enquiries assigned to you appear here. {pendingEnquiries.length} need a price.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void load(false)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {enquiries.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<IndianRupee size={22} />}
              title="No assigned enquiries"
              message="When a customer sends you a service enquiry, you can price it here."
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {enquiries.map((enquiry) => {
              const quotation = quotationsByEnquiry.get(enquiry._id);
              const quotable = QUOTABLE_ENQUIRY_STATUSES.has(String(enquiry.status).toUpperCase());
              const editable = quotable && (!quotation || EDITABLE.has(quotation.status));
              return (
                <article key={enquiry._id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{enquiry.serviceCategory}</Badge>
                        <Badge tone="muted">{String(enquiry.status).replace(/_/g, " ")}</Badge>
                        {quotation && <QuotationStatusBadge status={quotation.status} />}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">{enquiry.problemDescription}</p>
                      <p className="mt-1 text-xs text-muted">
                        {enquiry.location || "Location not specified"} · Customer: {entityName(enquiry.customerId)}
                        {quotation ? ` · Submitted ${formatDateTime(quotation.updatedAt)}` : ""}
                      </p>
                      {quotation && quotation.adminRemarks && (
                        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <span className="font-bold">Admin remarks:</span> {quotation.adminRemarks}
                        </p>
                      )}
                      {quotation && (
                        <button
                          onClick={() => setDetail(detail?._id === quotation._id ? null : quotation)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                        >
                          {detail?._id === quotation._id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {detail?._id === quotation._id ? "Hide breakdown" : "View breakdown & approval status"}
                        </button>
                      )}
                      {detail?._id === quotation?._id && quotation && (
                        <div className="mt-3">
                          <QuotationBreakdown quotation={quotation} />
                          <div className="mt-3 rounded-2xl border border-line p-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted">Approval status</p>
                            <div className="mt-2 space-y-2">
                              {(quotation.history ?? []).map((event, index) => (
                                <div key={`${event.status}-${index}`} className="flex items-start justify-between gap-3 text-xs">
                                  <div>
                                    <span className="font-bold text-ink">{event.status.replace(/_/g, " ")}</span>
                                    <span className="text-muted"> by {event.role}</span>
                                    {event.note && <p className="text-muted">{event.note}</p>}
                                  </div>
                                  <span className="shrink-0 text-muted">{formatDateTime(event.at)}</span>
                                </div>
                              ))}
                              {quotation.approvedAt && (
                                <p className="text-xs text-emerald-700">
                                  Approved by admin {entityName(quotation.approvedBy)} on {formatDateTime(quotation.approvedAt)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row lg:flex-col">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          {quotation?.approvedAmount !== undefined ? "Approved amount" : "Quoted total"}
                        </p>
                        <p className="text-xl font-black text-ink">
                          {quotation ? money(quotation.approvedAmount ?? quotation.total) : "Not set"}
                        </p>
                        {quotation && (
                          <p className="text-[10px] text-muted">Valid until {formatValidUntil(quotation.validUntil)}</p>
                        )}
                      </div>
                      {editable ? (
                        <Button size="sm" onClick={() => openEditor(enquiry)}>
                          {quotation ? <Pencil size={14} /> : <Plus size={14} />}
                          {quotation ? (quotation.status === "DRAFT" ? "Edit draft" : "Revise quote") : "Set price"}
                        </Button>
                      ) : quotation ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setDetail(quotation);
                            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                          }}
                        >
                          Approval status
                        </Button>
                      ) : (
                        <p className="rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-muted">
                          This request is closed. Quotations can only be set for active enquiries.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-ink">Earnings after approval</h3>
            <p className="text-xs text-muted">Commission is set by the platform admin and shown on each settled payment.</p>
          </div>
          <Wallet size={22} className="text-emerald-600" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Net payable</p>
            <p className="mt-1 text-2xl font-black text-ink">{money(earnings?.netPayable ?? 0)}</p>
            <p className="text-xs text-muted">After platform commission</p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Pending payouts</p>
            <p className="mt-1 text-2xl font-black text-amber-600">{money(earnings?.pendingPayouts ?? 0)}</p>
            <p className="text-xs text-muted">Awaiting admin transfer</p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Paid out</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{money(earnings?.totalPaidOut ?? 0)}</p>
            <p className="text-xs text-muted">Confirmed transfers</p>
          </div>
        </div>
      </section>

      <Modal
        open={editorOpen}
        onClose={() => !saving && setEditorOpen(false)}
        title={editingQuotation ? "Revise quotation" : "Set your price"}
        wide
      >
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Price the job for the customer. The total is calculated on the server from your breakdown — you cannot
            approve your own quotation.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Labour charges (₹)">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.labourCharges}
                onChange={(event) => setForm({ ...form, labourCharges: event.target.value })}
                placeholder="2500"
              />
            </Field>
            <Field label="Material charges (₹)" hint="Leave blank if no material is required.">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.materialCharges}
                onChange={(event) => setForm({ ...form, materialCharges: event.target.value })}
                placeholder="0"
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink">Additional charges</p>
              <Button type="button" size="sm" variant="secondary" onClick={addCharge}>
                <Plus size={13} /> Add charge
              </Button>
            </div>
            {form.additionalCharges.length === 0 ? (
              <p className="mt-1 text-xs text-muted">Optional — add a description and amount for each extra charge.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {form.additionalCharges.map((charge) => (
                  <div key={charge.key} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row">
                    <Input
                      value={charge.description}
                      onChange={(event) => updateCharge(charge.key, { description: event.target.value })}
                      placeholder="Description (e.g. replacement pipe)"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="sm:w-36"
                      value={charge.amount || ""}
                      onChange={(event) => updateCharge(charge.key, { amount: Number(event.target.value) })}
                      placeholder="Amount"
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeCharge(charge.key)} aria-label="Remove charge">
                      <Trash2 size={14} className="text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estimated completion time">
              <Input
                value={form.estimatedCompletionTime}
                onChange={(event) => setForm({ ...form, estimatedCompletionTime: event.target.value })}
                placeholder="e.g. 2 working days"
              />
            </Field>
            <Field label="Quotation valid until">
              <Input
                type="date"
                value={form.validUntil}
                onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes to the customer / admin" hint="Optional context about the scope of work.">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Explain what is included in this price…"
            />
          </Field>

          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Server-calculated total</p>
              <p className="text-xs text-muted">Labour + material + additional charges</p>
            </div>
            <p className="text-2xl font-black text-ink">{money(previewTotal)}</p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void handleSaveDraft()} disabled={saving}>
              Save draft
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={saving}>
              <Send size={14} /> {saving ? "Submitting…" : "Submit for approval"}
            </Button>
          </div>
          {notice && <p className="text-xs font-semibold text-blue-700">{notice}</p>}
        </div>
      </Modal>
    </div>
  );
}
