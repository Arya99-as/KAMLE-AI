import {
  AlertCircle,
  Check,
  Clock,
  Play,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  getWorkerEarnings,
  listEnquiries,
  submitWorkerProfile,
  updateEnquiryStatus,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Enquiry, Payout } from "../../types";
import { Badge, Button, Field, Input, Modal, Spinner, StatusBadge, Tabs } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";

function otherParty(e: Enquiry, meId: string) {
  const ref = String(e.customerId) === meId ? e.workerId : e.customerId;
  return typeof ref === "string" ? { _id: ref, name: "Customer" } : ref;
}

export default function WorkerDashboard() {
  const { user, workerProfile } = useAuth();
  const meId = user?.id ?? "";

  const [tab, setTab] = useState("Requests");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [received, setReceived] = useState<Enquiry[]>([]);
  const [earningsStats, setEarningsStats] = useState({
    totalGrossEarnings: 0,
    totalCommissionDeducted: 0,
    netPayable: 0,
    totalPaidOut: 0,
    pendingPayouts: 0,
  });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const [completeModalEnquiry, setCompleteModalEnquiry] = useState<Enquiry | null>(null);
  const [finalAmount, setFinalAmount] = useState<number>(500);
  const [completeLoading, setCompleteLoading] = useState(false);

  const [resubmitLoading, setResubmitLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        listEnquiries("received"),
        getWorkerEarnings().catch(() => ({ success: false, stats: null, payouts: [] })),
      ]);
      setReceived(r.items);
      if (e.success && e.stats) {
        setEarningsStats(e.stats);
        setPayouts(e.payouts || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profile = workerProfile;
  const approvalStatus = profile?.approvalStatus ?? "pending";
  const isApproved = approvalStatus === "approved";
  const isRejected = approvalStatus === "rejected";
  const isPending = approvalStatus === "pending" || approvalStatus === "draft";

  async function updateStatus(id: string, next: string, note?: string, serviceAmount?: number) {
    setActionError(null);
    try {
      await updateEnquiryStatus(id, next, note, serviceAmount);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the enquiry.");
    }
  }

  async function handleMarkCompleteSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!completeModalEnquiry) return;
    setCompleteLoading(true);
    try {
      await updateEnquiryStatus(
        completeModalEnquiry._id,
        "COMPLETED",
        `Work completed. Billed amount: ₹${finalAmount}`,
        finalAmount
      );
      setCompleteModalEnquiry(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not complete request");
    } finally {
      setCompleteLoading(false);
    }
  }

  async function handleResubmitProfile() {
    setResubmitLoading(true);
    try {
      await submitWorkerProfile();
      alert("Profile submitted for verification review!");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not resubmit profile");
    } finally {
      setResubmitLoading(false);
    }
  }

  return (
    <div className="container-x py-8">
      {isRejected && (
        <div className="mb-6 rounded-card border border-red-200 bg-red-50 p-4 text-red-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Profile Verification Rejected by Admin</p>
              <p className="text-xs text-red-700 mt-0.5">
                {profile?.rejectionReason || "Please update your details and resubmit for verification."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/onboarding">
              <Button variant="secondary" size="sm" className="bg-white">
                Edit Profile
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResubmitProfile}
              disabled={resubmitLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {resubmitLoading ? "Submitting..." : "Resubmit Profile"}
            </Button>
          </div>
        </div>
      )}

      {isPending && (
        <div className="mb-6 rounded-card border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">Verification Under Review</p>
              <p className="text-xs text-amber-700">
                Your profile has been submitted and is currently being verified by an admin. Once approved, you will appear in public worker search results.
              </p>
            </div>
          </div>
          <Link to="/onboarding">
            <Button variant="secondary" size="sm" className="bg-white">
              Edit Details
            </Button>
          </Link>
        </div>
      )}

      {isApproved && (
        <div className="mb-6 rounded-card border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-600" />
            <span className="font-bold text-xs">Verified Professional Account — Public and Ready for Client Requests</span>
          </div>
          <Link to="/onboarding" className="text-xs font-semibold text-emerald-800 hover:underline">
            Manage Profile →
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Worker Dashboard</h1>
          <p className="text-sm text-muted">Manage incoming service requests, job progress, and your payouts</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => load()} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
          <Link to="/onboarding">
            <Button variant="primary" size="sm">
              Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {actionError}
        </div>
      )}

      <div className="mt-6">
        <Tabs
          tabs={["Requests", "Earnings", "Profile"]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="mt-6">
          {tab === "Requests" && (
            <div>
              {received.length === 0 ? (
                <EmptyState
                  title="No requests yet"
                  message="When clients discover your verified profile and send service enquiries, they will appear here."
                />
              ) : (
                <div className="space-y-4">
                  {received.map((e) => {
                    const st = String(e.status).toUpperCase();
                    const customer = otherParty(e, meId);
                    const isPending = st === "PENDING" || st === "SENT";
                    const isAccepted = st === "ACCEPTED";
                    const isInProgress = st === "IN_PROGRESS";
                    const isPaid = e.paymentStatus === "PAID";
                    const isDisputed = st === "DISPUTED";

                    return (
                      <div key={e._id} className="card p-5 transition hover:border-brand-200">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">{customer.name}</span>
                              <Badge tone="brand">{e.serviceCategory}</Badge>
                              <StatusBadge status={e.status} />
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                  <Check size={12} /> Paid by Client
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-ink">{e.problemDescription}</p>
                            {e.location && <p className="mt-1 text-xs text-muted">📍 Client Address: {e.location}</p>}
                            {e.serviceAmount ? (
                              <p className="mt-1 text-xs font-semibold text-brand-700">Service Fee: ₹{e.serviceAmount}</p>
                            ) : null}
                            {isDisputed && e.disputeReason && (
                              <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                                <strong>Client Dispute:</strong> {e.disputeReason}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            {isPending && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => updateStatus(e._id, "ACCEPTED")}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  <Check size={14} /> Accept Request
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => updateStatus(e._id, "REJECTED")}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <X size={14} /> Reject
                                </Button>
                              </>
                            )}

                            {isAccepted && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => updateStatus(e._id, "IN_PROGRESS", "Worker started the work")}
                              >
                                <Play size={14} /> Start Work
                              </Button>
                            )}

                            {isInProgress && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                  setCompleteModalEnquiry(e);
                                  setFinalAmount(e.serviceAmount || 500);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Check size={14} /> Mark Work Completed
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "Earnings" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="card p-4">
                  <span className="text-xs font-medium text-muted">Gross Revenue</span>
                  <p className="mt-1 text-2xl font-bold text-ink">₹{earningsStats.totalGrossEarnings}</p>
                  <span className="text-xs text-muted">Total service billings</span>
                </div>
                <div className="card p-4">
                  <span className="text-xs font-medium text-muted">Platform Fee</span>
                  <p className="mt-1 text-2xl font-bold text-muted">₹{earningsStats.totalCommissionDeducted}</p>
                  <span className="text-xs text-muted">Platform commission (10%)</span>
                </div>
                <div className="card p-4 border-brand-200 bg-brand-50/40">
                  <span className="text-xs font-medium text-brand-700">Net Worker Earnings</span>
                  <p className="mt-1 text-2xl font-bold text-brand-700">₹{earningsStats.netPayable}</p>
                  <span className="text-xs text-brand-600">Your total payable amount</span>
                </div>
                <div className="card p-4">
                  <span className="text-xs font-medium text-amber-700">Pending Payouts</span>
                  <p className="mt-1 text-2xl font-bold text-amber-700">₹{earningsStats.pendingPayouts}</p>
                  <span className="text-xs text-muted">Awaiting admin transfer</span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-ink mb-3">Payout Ledger</h3>
                {payouts.length === 0 ? (
                  <div className="card p-8 text-center text-sm text-muted">
                    No payouts recorded yet. When clients complete payments for your work, payouts are automatically tracked here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payouts.map((po) => {
                      const isPaid = po.status === "PAID";
                      const isProcessing = po.status === "PROCESSING";

                      return (
                        <div key={po._id} className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-ink text-base">₹{po.workerPayableAmount}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                  isPaid
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isProcessing
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {po.status}
                              </span>
                              <span className="text-xs text-muted">
                                Gross: ₹{po.serviceAmount} | Comm: -₹{po.commissionAmount}
                              </span>
                            </div>
                            {po.providerPayoutRef && (
                              <p className="text-xs text-muted mt-1 font-mono">Reference: {po.providerPayoutRef}</p>
                            )}
                            <p className="text-xs text-muted">
                              Created: {new Date(po.createdAt).toLocaleDateString()}
                              {po.paidAt && ` | Paid: ${new Date(po.paidAt).toLocaleDateString()}`}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-slate-500">
                              {isPaid ? "Disbursed to Bank" : "Scheduled for Net-7 Transfer"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "Profile" && (
            <div className="card p-6 space-y-4 max-w-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-ink">{user?.name}</h3>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
                  {approvalStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-ink">{profile?.professionalDescription || "No bio added yet"}</p>
              <div>
                <span className="text-xs font-semibold text-muted block mb-1">Categories:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(profile?.serviceCategories || []).map((c) => (
                    <Badge key={c} tone="brand">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted block mb-1">Skills:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(profile?.skills || []).map((s) => (
                    <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Link to="/onboarding">
                  <Button variant="primary">Edit Full Profile & Pricing</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {completeModalEnquiry && (
        <Modal
          open={Boolean(completeModalEnquiry)}
          onClose={() => !completeLoading && setCompleteModalEnquiry(null)}
          title="Mark Work Completed"
        >
          <form onSubmit={handleMarkCompleteSubmit} className="space-y-4">
            <p className="text-xs text-muted">
              Confirm that the work requested by <strong>{otherParty(completeModalEnquiry, meId).name}</strong> has been finished. Set the final billed service amount for the client to pay.
            </p>

            <Field label="Final Service Amount (₹)">
              <Input
                type="number"
                min={1}
                value={finalAmount}
                onChange={(e) => setFinalAmount(Number(e.target.value) || 0)}
                required
              />
            </Field>

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200">
              <div className="flex justify-between mb-1">
                <span>Gross Billing:</span>
                <span className="font-semibold text-ink">₹{finalAmount}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Platform Commission (10%):</span>
                <span>-₹{Math.round(finalAmount * 0.1)}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-emerald-700">
                <span>Your Payout:</span>
                <span>₹{finalAmount - Math.round(finalAmount * 0.1)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setCompleteModalEnquiry(null)} disabled={completeLoading}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={completeLoading || finalAmount <= 0}>
                {completeLoading ? "Completing..." : "Confirm & Mark Completed"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
