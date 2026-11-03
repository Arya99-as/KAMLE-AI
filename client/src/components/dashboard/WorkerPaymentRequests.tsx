import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
  XCircle,
  ExternalLink,
} from "lucide-react";
import {
  getMyWorkerPaymentRequests,
  createPaymentRequest,
  type PaymentRequest,
} from "../../services/api";
import { Button, Field, Input, Modal, Spinner, Textarea } from "../ui/primitives";
import { EmptyState } from "../ui/states";
import type { Enquiry } from "../../types";

interface Props {
  activeJobs: Enquiry[];
  onRefresh?: () => void;
}

export default function WorkerPaymentRequests({ activeJobs, onRefresh }: Props) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);

  // Modal for submitting a new payment request
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Enquiry | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyWorkerPaymentRequests();
      setRequests(res.items || []);
    } catch (err: unknown) {
      console.error("Failed to load worker payment requests", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleOpenSubmitModal = (job: Enquiry) => {
    setSelectedJob(job);
    setCompletionNotes("");
    setEvidenceUrl("");
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitModalOpen(true);
  };

  const handleSubmitPaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    if (!completionNotes.trim() || completionNotes.trim().length < 5) {
      setErrorMsg("Please provide clear completion notes (at least 5 characters).");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await createPaymentRequest({
        enquiryId: selectedJob._id,
        completionNotes: completionNotes.trim(),
        completionEvidence: evidenceUrl.trim() ? [evidenceUrl.trim()] : [],
      });
      setSuccessMsg("Payment request submitted successfully to Admin!");
      setTimeout(() => {
        setIsSubmitModalOpen(false);
        loadRequests();
        if (onRefresh) onRefresh();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit payment request";
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
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
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">Revision Requested</span>;
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
      case "PROCESSING":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200"><RefreshCw size={12} className="animate-spin" /> Processing</span>;
      case "FAILED":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200"><XCircle size={12} /> Failed</span>;
      default:
        return <span className="text-xs text-muted font-medium">{status.replace("_", " ")}</span>;
    }
  };

  const getPayoutBadge = (status: PaymentRequest["payoutStatus"]) => {
    switch (status) {
      case "PAID":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><Wallet size={12} /> Transferred</span>;
      case "PENDING_ADMIN_APPROVAL":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200"><Clock size={12} /> Awaiting Admin Approval</span>;
      case "APPROVED":
      case "PROCESSING":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200"><RefreshCw size={12} className="animate-spin" /> Processing</span>;
      case "ELIGIBLE":
        return <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">Eligible</span>;
      default:
        return <span className="text-xs text-muted font-medium">{status.replace(/_/g, " ")}</span>;
    }
  };

  // Completed or in-progress jobs that don't have a pending payment request yet
  const eligibleJobs = activeJobs.filter((job) => {
    const hasRequest = requests.some(
      (r) => (typeof r.enquiryId === "string" ? r.enquiryId : r.enquiryId._id) === job._id
    );
    return !hasRequest;
  });

  return (
    <div className="space-y-6">
      {/* Header with Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <ShieldCheck className="text-blue-300" />
            My Completed Work & Payment Requests
          </h2>
          <p className="text-sm text-blue-100 mt-1">
            Submit completion proof for finished jobs and track admin review, customer payment, and bank payouts.
          </p>
        </div>
        <Button
          onClick={loadRequests}
          variant="secondary"
          size="sm"
          className="bg-white/10 hover:bg-white/20 text-white border-white/20 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Eligible Jobs Banner */}
      {eligibleJobs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-amber-900 flex items-center gap-2 text-sm">
              <FileCheck size={16} className="text-amber-600" />
              Finished Jobs Ready for Payment Request ({eligibleJobs.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {eligibleJobs.map((job) => (
              <div
                key={job._id}
                className="bg-white rounded-xl p-4 border border-amber-200/80 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-muted mb-1">
                    <span className="font-semibold text-ink">{job.serviceCategory}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{job.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                    {job.problemDescription}
                  </p>
                </div>
                <Button
                  onClick={() => handleOpenSubmitModal(job)}
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
                >
                  <Send size={13} />
                  Request Payment From Admin
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Requests Table / List */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-bold text-ink">Payment Requests History</h3>
            <p className="text-xs text-muted">All work completion submissions and payout statuses</p>
          </div>
          <span className="text-xs font-semibold text-muted bg-slate-100 px-3 py-1 rounded-full">
            {requests.length} Requests
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Spinner />
            <p className="text-xs text-muted mt-2">Loading payment requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            title="No payment requests yet"
            message="When you finish a job, click 'Request Payment From Admin' on the assigned booking to submit your completion proof."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-line text-xs font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Booking / Service</th>
                  <th className="px-5 py-3.5">Agreed Amount</th>
                  <th className="px-5 py-3.5">Request Status</th>
                  <th className="px-5 py-3.5">Customer Payment</th>
                  <th className="px-5 py-3.5">Commission</th>
                  <th className="px-5 py-3.5">Your Net Earnings</th>
                  <th className="px-5 py-3.5">Payout Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y border-line">
                {requests.map((req) => {
                  const customer = typeof req.customerId === "object" ? req.customerId : { name: "Customer" };
                  const enquiry = typeof req.enquiryId === "object" ? req.enquiryId : null;

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4">
                        <div className="font-bold text-ink text-sm">
                          {enquiry?.serviceCategory || "Service Booking"}
                        </div>
                        <div className="text-xs text-muted">
                          Customer: <span className="font-medium text-slate-700">{customer.name}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          ID: {req._id.substring(0, 10)}...
                        </div>
                      </td>
                      <td className="px-5 py-4 font-black text-ink text-base">
                        ₹{req.agreedAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4">
                        {getStatusBadge(req.status)}
                      </td>
                      <td className="px-5 py-4">
                        {getPaymentBadge(req.customerPaymentStatus)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-semibold text-rose-600">
                          - ₹{req.commissionAmount.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-muted font-medium">
                          ({req.commissionPercent}%)
                        </div>
                      </td>
                      <td className="px-5 py-4 font-black text-emerald-600 text-base">
                        ₹{req.workerPayableAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-4">
                        {getPayoutBadge(req.payoutStatus)}
                        {req.providerPayoutRef && (
                          <div className="font-mono text-[10px] text-slate-500 mt-1">
                            Ref: {req.providerPayoutRef}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedRequest(req)}
                          className="text-xs"
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Submit Payment Request */}
      <Modal
        open={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Request Payment From Admin"
      >
        {selectedJob && (
          <form onSubmit={handleSubmitPaymentRequest} className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-line rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-800 text-sm">
                Service: {selectedJob.serviceCategory}
              </div>
              <div className="text-slate-600">
                Booking ID: <span className="font-mono">{selectedJob._id}</span>
              </div>
              <div className="text-slate-600">
                Agreed Quotation Amount: <span className="font-bold text-ink">Strictly locked from approved quotation</span>
              </div>
            </div>

            <Field label="Work Completion Notes *">
              <Textarea
                rows={3}
                required
                placeholder="Describe work completed, parts replaced, and customer satisfaction details..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </Field>

            <Field label="Photo Evidence URL (Optional)">
              <Input
                type="url"
                placeholder="https://example.com/completion-photo.jpg"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
              />
              <span className="text-[11px] text-muted">
                Provide a hosted image link of the completed work to expedite Admin review.
              </span>
            </Field>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsSubmitModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {submitting ? <Spinner /> : <Send size={14} />}
                Submit Payment Request
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Request Details & Audit Trail */}
      <Modal
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Payment Request Details"
      >
        {selectedRequest && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-line rounded-xl">
              <div>
                <span className="text-muted block">Request ID</span>
                <span className="font-mono font-bold text-ink">{selectedRequest._id}</span>
              </div>
              <div>
                <span className="text-muted block">Request Status</span>
                {getStatusBadge(selectedRequest.status)}
              </div>
              <div>
                <span className="text-muted block">Agreed Quotation</span>
                <span className="font-bold text-ink text-sm">₹{selectedRequest.agreedAmount}</span>
              </div>
              <div>
                <span className="text-muted block">Net Worker Payable</span>
                <span className="font-bold text-emerald-600 text-sm">₹{selectedRequest.workerPayableAmount}</span>
              </div>
              <div>
                <span className="text-muted block">Platform Commission</span>
                <span className="font-semibold text-rose-600">
                  ₹{selectedRequest.commissionAmount} ({selectedRequest.commissionPercent}%)
                </span>
              </div>
              <div>
                <span className="text-muted block">Customer Payment Status</span>
                {getPaymentBadge(selectedRequest.customerPaymentStatus)}
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-700 block mb-1">Worker Completion Notes:</span>
              <p className="p-3 bg-white border border-line rounded-xl text-slate-700">
                {selectedRequest.completionNotes}
              </p>
            </div>

            {selectedRequest.completionEvidence && selectedRequest.completionEvidence.length > 0 && (
              <div>
                <span className="font-bold text-slate-700 block mb-1">Completion Evidence:</span>
                <div className="space-y-1">
                  {selectedRequest.completionEvidence.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Evidence link #{idx + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedRequest.adminRemarks && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <span className="font-bold text-blue-900 block mb-0.5">Admin Remarks:</span>
                <p className="text-blue-800">{selectedRequest.adminRemarks}</p>
              </div>
            )}

            {selectedRequest.history && selectedRequest.history.length > 0 && (
              <div>
                <span className="font-bold text-slate-700 block mb-2">Audit History:</span>
                <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                  {selectedRequest.history.map((h, i) => (
                    <div key={i} className="text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-800">
                        {h.status} {h.remarks ? `— ${h.remarks}` : ""}
                      </div>
                      <div className="text-slate-400">
                        By {h.actorRole} at {new Date(h.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
