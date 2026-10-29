import {
  Check,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminDashboard,
  adminEnquiries,
  adminGetConfig,
  adminPayments,
  adminPayouts,
  adminResolveDispute,
  adminUpdateConfig,
  adminUpdatePayoutStatus,
  adminUsers,
  adminWorkers,
  setAccountStatus,
  setApproval,
} from "../../services/api";
import type {
  Enquiry,
  Payment,
  Payout,
  PlatformConfig,
  User,
  WorkerProfile,
} from "../../types";
import { Badge, Button, Field, Input, Modal, Select, Spinner, StatusBadge, Tabs, Textarea } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";
import { AiControlCenter } from "../../features/ai-admin/AiControlCenter";

type AppRow = WorkerProfile & { userId: User & { _id?: string } };

export default function AdminDashboard() {
  const [tab, setTab] = useState("AI Control Center");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});

  const [pendingWorkers, setPendingWorkers] = useState<AppRow[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [allEnquiries, setAllEnquiries] = useState<Enquiry[]>([]);
  const [disputeModalId, setDisputeModalId] = useState<string | null>(null);
  const [disputeNote, setDisputeNote] = useState("");

  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allPayouts, setAllPayouts] = useState<Payout[]>([]);
  const [payoutModalId, setPayoutModalId] = useState<string | null>(null);
  const [payoutStatusChoice, setPayoutStatusChoice] = useState<"PROCESSING" | "PAID" | "FAILED">("PAID");
  const [payoutRefInput, setPayoutRefInput] = useState("");

  const [, setPlatformConfig] = useState<PlatformConfig>({
    key: "global",
    commissionPercent: 10,
    payoutTerms: "Standard net-7 payout schedule",
  });
  const [commissionInput, setCommissionInput] = useState(10);
  const [configSuccess, setConfigSuccess] = useState(false);

  const [usersList, setUsersList] = useState<User[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, w, e, p, po, c, u] = await Promise.all([
        adminDashboard(),
        adminWorkers("pending"),
        adminEnquiries(),
        adminPayments(),
        adminPayouts(),
        adminGetConfig(),
        adminUsers(),
      ]);
      setStats(s.stats);
      setPendingWorkers(w.items);
      setAllEnquiries(e.items);
      setAllPayments(p.items);
      setAllPayouts(po.items);
      if (c.config) {
        setPlatformConfig(c.config);
        setCommissionInput(c.config.commissionPercent);
      }
      setUsersList(u.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleApprove(id: string) {
    try {
      await setApproval(id, "approved");
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error approving worker");
    }
  }

  async function handleRejectConfirm() {
    if (!rejectId) return;
    try {
      await setApproval(rejectId, "rejected", rejectReason);
      setRejectId(null);
      setRejectReason("");
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error rejecting worker");
    }
  }

  async function handleUpdatePayout(ev: FormEvent) {
    ev.preventDefault();
    if (!payoutModalId) return;
    try {
      await adminUpdatePayoutStatus(payoutModalId, payoutStatusChoice, payoutRefInput);
      setPayoutModalId(null);
      setPayoutRefInput("");
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating payout");
    }
  }

  async function handleResolveDispute(resolution: "COMPLETED" | "CANCELLED") {
    if (!disputeModalId) return;
    try {
      await adminResolveDispute(disputeModalId, resolution, disputeNote);
      setDisputeModalId(null);
      setDisputeNote("");
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error resolving dispute");
    }
  }

  async function handleSaveConfig(ev: FormEvent) {
    ev.preventDefault();
    try {
      await adminUpdateConfig({ commissionPercent: commissionInput });
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 2000);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving config");
    }
  }

  async function handleToggleUserStatus(u: User) {
    const next = u.accountStatus === "active" ? "suspended" : "active";
    try {
      await setAccountStatus(u.id, next);
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update user");
    }
  }

  return (
    <div className="container-x py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Admin Control Center</h1>
          <p className="text-sm text-muted">Platform governance, worker verifications, transactions, and dispute management</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => loadAll()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Data
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Total Users</span>
          <p className="text-xl font-bold text-ink mt-1">{stats.totalUsers ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Approved Pros</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.approvedWorkers ?? 0}</p>
        </div>
        <div className="card p-3.5 bg-amber-50/50 border-amber-200">
          <span className="text-xs font-semibold text-amber-800">Pending Review</span>
          <p className="text-xl font-bold text-amber-700 mt-1">{stats.pendingApplications ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Total Requests</span>
          <p className="text-xl font-bold text-ink mt-1">{stats.totalEnquiries ?? 0}</p>
        </div>
        <div className="card p-3.5 bg-blue-50/50 border-blue-200">
          <span className="text-xs font-semibold text-blue-800">Total Volume</span>
          <p className="text-xl font-bold text-blue-700 mt-1">₹{stats.totalVolume ?? 0}</p>
        </div>
        <div className="card p-3.5 bg-emerald-50/50 border-emerald-200">
          <span className="text-xs font-semibold text-emerald-800">Platform Comm.</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">₹{stats.totalCommission ?? 0}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Customers</span>
          <p className="text-xl font-bold text-ink mt-1">{stats.totalCustomers ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Rejected Pros</span>
          <p className="text-xl font-bold text-red-600 mt-1">{stats.rejectedWorkers ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Pending Requests</span>
          <p className="text-xl font-bold text-amber-700 mt-1">{stats.pendingRequests ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">In Progress</span>
          <p className="text-xl font-bold text-blue-700 mt-1">{stats.inProgressRequests ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Completed</span>
          <p className="text-xl font-bold text-emerald-600 mt-1">{stats.completedRequests ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Disputed</span>
          <p className="text-xl font-bold text-red-700 mt-1">{stats.disputedRequests ?? 0}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Payments Received</span>
          <p className="text-xl font-bold text-ink mt-1">{stats.paymentsReceived ?? 0}</p>
          <p className="text-[11px] text-muted mt-0.5">
            {stats.failedPayments ?? 0} failed · {stats.refundedPayments ?? 0} refunded
          </p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Worker Payouts Paid</span>
          <p className="text-xl font-bold text-emerald-700 mt-1">₹{stats.totalPayoutsPaid ?? 0}</p>
        </div>
        <div className="card p-3.5">
          <span className="text-xs font-semibold text-muted">Pending Payouts</span>
          <p className="text-xl font-bold text-amber-700 mt-1">₹{stats.pendingPayoutsTotal ?? 0}</p>
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          tabs={[
            "AI Control Center",
            "Verifications",
            "Requests",
            "Payments",
            "Payouts",
            "Commission",
            "Users",
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {loading && tab !== "AI Control Center" ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : (
        <div className="mt-6">
          {tab === "AI Control Center" && <AiControlCenter />}

          {tab === "Verifications" && (
            <div>
              {pendingWorkers.length === 0 ? (
                <EmptyState
                  title="No pending worker applications"
                  message="All skilled worker profiles have been reviewed and decided on."
                />
              ) : (
                <div className="space-y-4">
                  {pendingWorkers.map((pw) => (
                    <div key={pw._id} className="card p-5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-ink">{pw.userId?.name || "Worker"}</span>
                            <span className="text-xs text-muted">Phone: {pw.userId?.phone}</span>
                            <Badge tone="brand">{pw.approvalStatus.toUpperCase()}</Badge>
                          </div>
                          <p className="text-sm text-ink mt-1">{pw.professionalDescription}</p>
                          <p className="text-xs text-muted mt-1">
                            Experience: {pw.experienceYears} years | Areas: {(pw.serviceAreas || []).join(", ") || "Local"}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(pw.serviceCategories || []).map((c) => (
                              <Badge key={c} tone="brand">
                                {c}
                              </Badge>
                            ))}
                            {(pw.skills || []).map((s) => (
                              <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleApprove(pw._id)}
                          >
                            <Check size={14} /> Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setRejectId(pw._id)}
                          >
                            <X size={14} /> Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "Requests" && (
            <div>
              {allEnquiries.length === 0 ? (
                <EmptyState title="No service requests recorded" message="Service requests created by clients will appear here." />
              ) : (
                <div className="space-y-3">
                  {allEnquiries.map((e) => {
                    const st = String(e.status).toUpperCase();
                    const isDisputed = st === "DISPUTED";
                    const isPaid = e.paymentStatus === "PAID";

                    return (
                      <div
                        key={e._id}
                        className={`card p-4 transition ${
                          isDisputed ? "border-amber-300 bg-amber-50/20" : ""
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">
                                Client: {(typeof e.customerId === "object" ? e.customerId?.name : "User")} → Worker:{" "}
                                {(typeof e.workerId === "object" ? e.workerId?.name : "Worker")}
                              </span>
                              <Badge tone="brand">{e.serviceCategory}</Badge>
                              <StatusBadge status={e.status} />
                              {isPaid && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                  Paid
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-ink mt-1.5">{e.problemDescription}</p>
                            {e.serviceAmount ? (
                              <p className="text-xs font-semibold text-brand-700 mt-1">Amount: ₹{e.serviceAmount}</p>
                            ) : null}
                            {isDisputed && e.disputeReason && (
                              <div className="mt-2 rounded-lg bg-amber-100 p-2.5 text-xs text-amber-900 border border-amber-300">
                                <strong>Dispute Alert:</strong> {e.disputeReason}
                              </div>
                            )}
                          </div>

                          {isDisputed && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                              onClick={() => setDisputeModalId(e._id)}
                            >
                              <ShieldAlert size={14} /> Resolve Dispute
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "Payments" && (
            <div>
              {allPayments.length === 0 ? (
                <EmptyState title="No transactions recorded" message="All client payments will be listed here with transaction IDs." />
              ) : (
                <div className="space-y-3">
                  {allPayments.map((p) => (
                    <div key={p._id} className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-base">₹{p.amount}</span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                            {p.status}
                          </span>
                          <span className="text-xs text-muted">via {p.paymentMethod?.toUpperCase()}</span>
                        </div>
                        <p className="text-xs font-mono text-muted mt-1">Txn ID: {p.transactionRef}</p>
                        <p className="text-xs text-muted">
                          Client: {typeof p.customerId === "object" ? p.customerId?.name : "Client"} | Worker:{" "}
                          {typeof p.workerId === "object" ? p.workerId?.name : "Worker"}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-semibold text-emerald-700">Platform Comm: +₹{p.commissionAmount} ({p.commissionPercent}%)</p>
                        <p className="text-slate-600">Worker Share: ₹{p.workerPayableAmount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "Payouts" && (
            <div>
              {allPayouts.length === 0 ? (
                <EmptyState title="No worker payouts logged" message="Worker payouts automatically appear here when clients pay." />
              ) : (
                <div className="space-y-3">
                  {allPayouts.map((po) => {
                    const isPaid = po.status === "PAID";
                    return (
                      <div key={po._id} className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-ink">₹{po.workerPayableAmount}</span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800"
                                  : po.status === "PROCESSING"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {po.status}
                            </span>
                            <span className="text-xs text-muted">
                              Worker: {typeof po.workerId === "object" ? po.workerId?.name : "Worker"}
                            </span>
                          </div>
                          {po.providerPayoutRef && (
                            <p className="text-xs font-mono text-muted mt-1">Payout Ref: {po.providerPayoutRef}</p>
                          )}
                          <p className="text-xs text-muted">
                            Created: {new Date(po.createdAt).toLocaleDateString()}
                            {po.paidAt && ` | Paid: ${new Date(po.paidAt).toLocaleDateString()}`}
                          </p>
                        </div>

                        {!isPaid && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setPayoutModalId(po._id);
                              setPayoutStatusChoice("PAID");
                              setPayoutRefInput(`PO_REF_${Date.now().toString().slice(-6)}`);
                            }}
                          >
                            Update Payout Status
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "Commission" && (
            <div className="card p-6 max-w-xl space-y-4">
              <h3 className="font-bold text-lg text-ink">Platform Commission Settings</h3>
              <p className="text-xs text-muted">
                Configure the percentage deducted on every verified client payment prior to scheduling worker payouts.
              </p>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <Field label="Platform Commission Percentage (%)">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(Number(e.target.value) || 0)}
                    required
                  />
                </Field>

                <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs text-slate-700 space-y-1">
                  <p className="font-semibold text-ink">Sample Calculation for a ₹1,000 Service:</p>
                  <p>• Platform Commission ({commissionInput}%): <strong>₹{(1000 * commissionInput) / 100}</strong></p>
                  <p>• Worker Payable Payout: <strong>₹{1000 - (1000 * commissionInput) / 100}</strong></p>
                </div>

                {configSuccess && (
                  <p className="text-xs font-bold text-emerald-600">Configuration saved successfully!</p>
                )}

                <Button variant="primary" type="submit">
                  Save Commission Rate
                </Button>
              </form>
            </div>
          )}

          {tab === "Users" && (
            <div className="space-y-3">
              {usersList.map((u) => (
                <div key={u.id} className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{u.name}</span>
                      <Badge tone="brand">{u.role.toUpperCase()}</Badge>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          u.accountStatus === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {u.accountStatus}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">Phone: {u.phone} | Email: {u.email || "N/A"}</p>
                  </div>
                  <div>
                    {u.role !== "admin" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleUserStatus(u)}
                        className={u.accountStatus === "active" ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}
                      >
                        {u.accountStatus === "active" ? "Suspend Account" : "Activate Account"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rejectId && (
        <Modal open={Boolean(rejectId)} onClose={() => setRejectId(null)} title="Reject Worker Application">
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Specify the reason for rejection. The worker will see this feedback on their dashboard and can update their profile to resubmit.
            </p>
            <Field label="Rejection Reason (min 5 characters)">
              <Textarea
                placeholder="e.g., Unclear identity proof document, please re-upload clear photo."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                required
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setRejectId(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleRejectConfirm}
                disabled={rejectReason.trim().length < 5}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {disputeModalId && (
        <Modal open={Boolean(disputeModalId)} onClose={() => setDisputeModalId(null)} title="Resolve Customer Dispute">
          <div className="space-y-4">
            <p className="text-xs text-muted">Select the administrative resolution for this dispute.</p>
            <Field label="Resolution Notes / Audit Message">
              <Textarea
                placeholder="Resolution details..."
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                rows={3}
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => handleResolveDispute("CANCELLED")} className="text-red-600">
                Cancel Request & Refund
              </Button>
              <Button variant="primary" onClick={() => handleResolveDispute("COMPLETED")} className="bg-emerald-600 hover:bg-emerald-700">
                Uphold & Complete Work
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {payoutModalId && (
        <Modal open={Boolean(payoutModalId)} onClose={() => setPayoutModalId(null)} title="Process Worker Payout">
          <form onSubmit={handleUpdatePayout} className="space-y-4">
            <Field label="Target Payout Status">
              <Select value={payoutStatusChoice} onChange={(e) => setPayoutStatusChoice(e.target.value as any)}>
                <option value="PROCESSING">PROCESSING (Transfer Initiated)</option>
                <option value="PAID">PAID (Disbursed to Bank)</option>
                <option value="FAILED">FAILED (Transfer Declined)</option>
              </Select>
            </Field>
            <Field label="Provider Payout Reference / Bank UTR">
              <Input
                value={payoutRefInput}
                onChange={(e) => setPayoutRefInput(e.target.value)}
                placeholder="e.g., UTR_202610198823"
                required
              />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setPayoutModalId(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Confirm Status Update
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
