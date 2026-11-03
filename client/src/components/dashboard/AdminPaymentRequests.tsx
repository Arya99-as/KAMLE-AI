import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  getAdminPaymentRequests,
  adminDecidePaymentRequest,
  adminAuthorizeWorkerPayout,
  type PaymentRequest,
} from "../../services/api";
import { Button, Field, Input, Modal, Spinner, Textarea } from "../ui/primitives";
import { EmptyState } from "../ui/states";

export default function AdminPaymentRequests() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);

  // Decision Modal State
  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [targetRequest, setTargetRequest] = useState<PaymentRequest | null>(null);
  const [decisionAction, setDecisionAction] = useState<"approve" | "reject" | "request_evidence" | "send_to_customer">("send_to_customer");
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authorize Payout Modal State
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState<PaymentRequest | null>(null);
  const [payoutRef, setPayoutRef] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminPaymentRequests(filterStatus || undefined);
      setRequests(res.items || []);
    } catch (err) {
      console.error("Failed to load admin payment requests", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleOpenDecision = (req: PaymentRequest, action: "approve" | "reject" | "request_evidence" | "send_to_customer") => {
    setTargetRequest(req);
    setDecisionAction(action);
    setDecisionRemarks("");
    setErrorMsg(null);
    setIsDecisionModalOpen(true);
  };

  const handleExecuteDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRequest) return;

    try {
      setDecisionLoading(true);
      setErrorMsg(null);
      await adminDecidePaymentRequest(targetRequest._id, decisionAction, decisionRemarks.trim() || undefined);
      setIsDecisionModalOpen(false);
      loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Decision failed";
      setErrorMsg(msg);
    } finally {
      setDecisionLoading(false);
    }
  };

  const handleOpenPayout = (req: PaymentRequest) => {
    setPayoutTarget(req);
    setPayoutRef(`pout_${Date.now()}`);
    setPayoutNote("Admin authorized payout via gateway settlement");
    setErrorMsg(null);
    setIsPayoutModalOpen(true);
  };

  const handleExecutePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutTarget) return;

    const payoutId = typeof payoutTarget.payoutId === "object" ? payoutTarget.payoutId?._id : payoutTarget.payoutId;
    if (!payoutId) {
      setErrorMsg("No payout record found for this request. Ensure customer payment is verified first.");
      return;
    }

    try {
      setPayoutLoading(true);
      setErrorMsg(null);
      await adminAuthorizeWorkerPayout(payoutId, payoutRef.trim(), payoutNote.trim());
      setIsPayoutModalOpen(false);
      loadRequests();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Payout authorization failed";
      setErrorMsg(msg);
    } finally {
      setPayoutLoading(false);
    }
  };

  const getStatusBadge = (status: PaymentRequest["status"]) => {
    switch (status) {
      case "SUBMITTED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Submitted</span>;
      case "UNDER_REVIEW":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Under Review</span>;
      case "CUSTOMER_PAYMENT_REQUESTED":
      case "APPROVED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Customer Payment Requested</span>;
      case "REVISION_REQUESTED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">Evidence Requested</span>;
      case "REJECTED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Rejected</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const getPaymentBadge = (status: PaymentRequest["customerPaymentStatus"]) => {
    switch (status) {
      case "PAID":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><CheckCircle2 size={12} /> Paid</span>;
      case "PENDING":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"><Clock size={12} /> Pending</span>;
      default:
        return <span className="text-xs text-muted font-medium">{status.replace("_", " ")}</span>;
    }
  };

  const getPayoutBadge = (status: PaymentRequest["payoutStatus"]) => {
    switch (status) {
      case "PAID":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><Wallet size={12} /> Paid to Worker</span>;
      case "PENDING_ADMIN_APPROVAL":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200"><Clock size={12} /> Requires Payout Approval</span>;
      case "APPROVED":
      case "PROCESSING":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200"><RefreshCw size={12} className="animate-spin" /> Processing</span>;
      default:
        return <span className="text-xs text-muted font-medium">{status.replace(/_/g, " ")}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-line shadow-sm">
        <div>
          <h2 className="text-xl font-black text-ink flex items-center gap-2">
            <FileCheck className="text-blue-600" />
            Payment Request Management
          </h2>
          <p className="text-sm text-muted mt-1">
            Review worker completion requests, forward payment requests to customers, and authorize worker payouts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-xs font-semibold px-3 py-2 border border-line rounded-xl bg-white"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="CUSTOMER_PAYMENT_REQUESTED">Customer Payment Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="REVISION_REQUESTED">Revision Requested</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <Button onClick={loadRequests} variant="secondary" size="sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Spinner />
            <p className="text-xs text-muted mt-2">Loading payment requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No payment requests found"
            message="No worker payment requests have been submitted under the selected filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-line text-xs font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Booking / Service</th>
                  <th className="px-5 py-3.5">Worker</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Amount & Commission</th>
                  <th className="px-5 py-3.5">Request Status</th>
                  <th className="px-5 py-3.5">Customer Payment</th>
                  <th className="px-5 py-3.5">Payout Status</th>
                  <th className="px-5 py-3.5 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-line">
                {requests.map((req) => {
                  const worker = (typeof req.workerId === "object" ? req.workerId : { name: "Worker" }) as any;
                  const customer = (typeof req.customerId === "object" ? req.customerId : { name: "Customer" }) as any;
                  const enquiry = typeof req.enquiryId === "object" ? req.enquiryId : null;

                  const canAuthorizePayout =
                    req.customerPaymentStatus === "PAID" &&
                    (req.payoutStatus === "PENDING_ADMIN_APPROVAL" || req.payoutStatus === "ELIGIBLE");

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4">
                        <div className="font-bold text-ink text-sm">
                          {enquiry?.serviceCategory || "Service Booking"}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          Req: {req._id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800 text-xs">{worker.name}</div>
                        <div className="text-[11px] text-muted">{worker.phone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-800 text-xs">{customer.name}</div>
                        <div className="text-[11px] text-muted">{customer.phone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-black text-ink text-sm">
                          Gross: ₹{req.agreedAmount.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-rose-600 font-semibold">
                          Fee: ₹{req.commissionAmount} ({req.commissionPercent}%)
                        </div>
                        <div className="text-[11px] text-emerald-600 font-bold">
                          Worker Net: ₹{req.workerPayableAmount}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {getStatusBadge(req.status)}
                      </td>
                      <td className="px-5 py-4">
                        {getPaymentBadge(req.customerPaymentStatus)}
                      </td>
                      <td className="px-5 py-4">
                        {getPayoutBadge(req.payoutStatus)}
                      </td>
                      <td className="px-5 py-4 text-right space-x-1 whitespace-nowrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedRequest(req)}
                          className="text-xs"
                        >
                          Review
                        </Button>

                        {/* If awaiting customer payment request */}
                        {["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"].includes(req.status) && (
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                            onClick={() => handleOpenDecision(req, "send_to_customer")}
                          >
                            Send to Customer
                          </Button>
                        )}

                        {/* Authorize Payout if customer paid */}
                        {canAuthorizePayout && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                            onClick={() => handleOpenPayout(req)}
                          >
                            Authorize Payout
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Review & Audit Detail */}
      <Modal
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Review Worker Completion Request"
      >
        {selectedRequest && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-line rounded-xl">
              <div>
                <span className="text-muted block">Worker</span>
                <span className="font-bold text-ink">
                  {typeof selectedRequest.workerId === "object" ? selectedRequest.workerId.name : "Worker"}
                </span>
              </div>
              <div>
                <span className="text-muted block">Customer</span>
                <span className="font-bold text-ink">
                  {typeof selectedRequest.customerId === "object" ? selectedRequest.customerId.name : "Customer"}
                </span>
              </div>
              <div>
                <span className="text-muted block">Agreed Amount (Immutable)</span>
                <span className="font-black text-ink text-base">₹{selectedRequest.agreedAmount}</span>
              </div>
              <div>
                <span className="text-muted block">Calculated Commission</span>
                <span className="font-bold text-rose-600">
                  ₹{selectedRequest.commissionAmount} ({selectedRequest.commissionPercent}%)
                </span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1">Worker's Completion Notes:</span>
              <p className="p-3 bg-white border border-line rounded-xl text-slate-700">
                {selectedRequest.completionNotes || "No notes provided."}
              </p>
            </div>

            {selectedRequest.completionEvidence && selectedRequest.completionEvidence.length > 0 && (
              <div>
                <span className="font-bold text-slate-800 block mb-1">Completion Evidence:</span>
                <div className="space-y-1">
                  {selectedRequest.completionEvidence.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Evidence link #{i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedRequest.history && selectedRequest.history.length > 0 && (
              <div>
                <span className="font-bold text-slate-800 block mb-2">Audit History:</span>
                <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                  {selectedRequest.history.map((h, i) => (
                    <div key={i} className="text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-800">{h.status}</span>
                      {h.remarks ? ` — ${h.remarks}` : ""}
                      <span className="text-slate-400 block">
                        by {h.actorRole} at {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-line">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                  onClick={() => {
                    setSelectedRequest(null);
                    handleOpenDecision(selectedRequest, "request_evidence");
                  }}
                >
                  Request Clarification
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-rose-700 border-rose-300 hover:bg-rose-50 text-xs"
                  onClick={() => {
                    setSelectedRequest(null);
                    handleOpenDecision(selectedRequest, "reject");
                  }}
                >
                  Reject
                </Button>
              </div>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                onClick={() => {
                  setSelectedRequest(null);
                  handleOpenDecision(selectedRequest, "send_to_customer");
                }}
              >
                Approve & Request Customer Payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Admin Decision Action */}
      <Modal
        open={isDecisionModalOpen}
        onClose={() => setIsDecisionModalOpen(false)}
        title="Admin Payment Decision"
      >
        {targetRequest && (
          <form onSubmit={handleExecuteDecision} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-line text-xs">
              <span className="font-bold text-ink block mb-1">
                Action: <span className="uppercase text-blue-600">{decisionAction.replace(/_/g, " ")}</span>
              </span>
              <p className="text-slate-600">
                {decisionAction === "send_to_customer" && "This marks the payment request as approved by Admin and triggers a payment request notification to the Customer."}
                {decisionAction === "request_evidence" && "This requests additional photographs or details from the worker before customer payment is triggered."}
                {decisionAction === "reject" && "This rejects the completion request. Please specify the reason below."}
              </p>
            </div>

            <Field label="Admin Remarks / Reason">
              <Textarea
                rows={3}
                placeholder="Enter remarks or instructions for the worker or customer..."
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
              />
            </Field>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsDecisionModalOpen(false)} disabled={decisionLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={decisionLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {decisionLoading ? <Spinner /> : <CheckCircle2 size={14} />}
                Confirm Decision
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Authorize Payout */}
      <Modal
        open={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        title="Authorize Worker Payout"
      >
        {payoutTarget && (
          <form onSubmit={handleExecutePayout} className="space-y-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-emerald-900 text-sm">
                Payable Amount: ₹{payoutTarget.workerPayableAmount.toLocaleString("en-IN")}
              </div>
              <div className="text-emerald-700">
                Customer payment of ₹{payoutTarget.agreedAmount} is verified. Platform commission (₹{payoutTarget.commissionAmount}) has been deducted.
              </div>
            </div>

            <Field label="Provider Payout Reference / Transaction ID *">
              <Input
                required
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder="pout_12345678"
              />
              <span className="text-[11px] text-muted">
                Reference ID from RazorpayX Payouts or bank gateway transfer.
              </span>
            </Field>

            <Field label="Admin Note">
              <Input
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder="Disbursement note..."
              />
            </Field>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsPayoutModalOpen(false)} disabled={payoutLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={payoutLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {payoutLoading ? <Spinner /> : <Wallet size={14} />}
                Authorize & Mark Paid
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
