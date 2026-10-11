import { Activity, AlertTriangle, Check, ClipboardList, Cpu, FolderOpen, RefreshCw, ScrollText, ShieldBan, Star, Users, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminAiHealth, adminAnalytics, adminAuditLogs, adminCategories, adminDashboard, adminReports, adminReviews, adminUsers, adminWorkers, createCategory, deleteCategory, moderateReview, setAccountStatus, setApproval, setReportStatus, updateCategory } from "../../services/api";
import type { AiHealth } from "../../services/api";
import type { Review as ReviewType, ServiceCategory, User, WorkerProfile } from "../../types";
import { Badge, Button, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Tabs, Textarea } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";
import { formatRelative as timeAgo } from "../../lib/utils";
import type { UserRef } from "../../types";

type AppRow = WorkerProfile & { userId: User & { _id?: string } };
type ReportRow = {
  _id: string;
  reporterId: UserRef | string;
  reportedUserId: UserRef | string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
};
type ReviewRow = ReviewType & { customerId?: UserRef | string; workerId?: UserRef | string };
type AuditRow = { _id: string; action: string; targetType: string; targetId: string; metadata: Record<string, unknown>; createdAt: string; adminId: { name: string } };

function refName(ref: UserRef | string | undefined) {
  if (!ref) return "—";
  return typeof ref === "string" ? "User" : ref.name;
}

function workerName(u: unknown): string {
  if (typeof u === "object" && u !== null) {
    const name = (u as { name?: string }).name;
    if (typeof name === "string" && name) return name;
  }
  return "Worker";
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 truncate text-xs font-medium text-muted">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-bold">{value}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});

  const loadStats = useCallback(async () => {
    try {
      const res = await adminDashboard();
      setStats(res.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin stats.");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  const statCards = [
    { label: "Total users", value: stats.totalUsers ?? 0, icon: <Users size={20} /> },
    { label: "Worker applications pending", value: stats.pendingApplications ?? 0, icon: <ClipboardList size={20} /> },
    { label: "Approved workers", value: stats.approvedWorkers ?? 0, icon: <Check size={20} /> },
    { label: "Enquiries", value: stats.totalEnquiries ?? 0, icon: <Activity size={20} /> },
    { label: "Open reports", value: stats.openReports ?? 0, icon: <AlertTriangle size={20} /> },
    { label: "Reviews to moderate", value: stats.pendingReviews ?? 0, icon: <Star size={20} /> },
  ];

  return (
    <div className="container-x py-8">
      <PageHeader title="Admin console" subtitle="Approve workers, moderate content, and monitor the marketplace." />

      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <Tabs
        tabs={["Overview", "Applications", "Users", "Categories", "Reports", "Reviews", "Analytics", "AI status", "Audit log"]}
        active={tab}
        onChange={setTab}
      />

      {tab === "Overview" && (
        <div className="mt-6">
          {loading ? (
            <Spinner className="mt-10" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {statCards.map((s) => (
                  <div key={s.label} className="card flex items-center gap-4 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{s.icon}</span>
                    <div>
                      <div className="text-2xl font-bold leading-none">{s.value}</div>
                      <div className="mt-1 text-xs text-muted">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <button onClick={() => setTab("Applications")} className="card flex items-center justify-between p-5 text-left hover:shadow-lift">
                  <div>
                    <div className="font-bold">Review applications</div>
                    <div className="mt-1 text-xs text-muted">{stats.pendingApplications ?? 0} waiting</div>
                  </div>
                  <ClipboardList size={22} className="text-brand-600" />
                </button>
                <button onClick={() => setTab("Reports")} className="card flex items-center justify-between p-5 text-left hover:shadow-lift">
                  <div>
                    <div className="font-bold">Open reports</div>
                    <div className="mt-1 text-xs text-muted">{stats.openReports ?? 0} to resolve</div>
                  </div>
                  <AlertTriangle size={22} className="text-warning" />
                </button>
                <button onClick={() => setTab("Reviews")} className="card flex items-center justify-between p-5 text-left hover:shadow-lift">
                  <div>
                    <div className="font-bold">Moderate reviews</div>
                    <div className="mt-1 text-xs text-muted">{stats.pendingReviews ?? 0} pending</div>
                  </div>
                  <Star size={22} className="text-amber-400" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "Applications" && <ApplicationsTab />}
      {tab === "Users" && <UsersTab />}
      {tab === "Categories" && <CategoriesTab />}
      {tab === "Reports" && <ReportsTab />}
      {tab === "Reviews" && <ReviewsTab />}
      {tab === "Analytics" && <AnalyticsTab />}
      {tab === "AI status" && <AiStatusTab />}
      {tab === "Audit log" && <AuditTab />}
    </div>
  );
}

/* ------------------------------ Applications ------------------------------ */

function ApplicationsTab() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ row: AppRow; decision: "approved" | "rejected" } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminWorkers(status);
      setRows(res.items as AppRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    if (!open) return;
    await setApproval(open.row._id, open.decision, open.decision === "rejected" ? reason : undefined);
    setOpen(null);
    setReason("");
    await load();
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-2">
        {["pending", "approved", "rejected", "draft"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${status === s ? "bg-brand-600 text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}>
            {s}
          </button>
        ))}
      </div>
      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? (
        <Spinner className="mt-10" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ClipboardList size={28} />} title="No applications here" message="Worker applications will show up here once submitted for review." />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row._id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{row.userId?.name ?? "Worker"}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {row.userId?.phone} {row.userId?.email ? `· ${row.userId.email}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.serviceCategories.slice(0, 3).map((c) => (
                      <Badge key={c} tone="brand">{c}</Badge>
                    ))}
                    {row.skills.slice(0, 3).map((s) => (
                      <Badge key={s}>{s}</Badge>
                    ))}
                  </div>
                </div>
                <StatusBadge status={row.approvalStatus} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{row.professionalDescription}</p>
              {row.rejectionReason && <p className="mt-2 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">Rejected: {row.rejectionReason}</p>}
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => setOpen({ row, decision: "approved" })}>
                  <Check size={14} /> Approve
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setOpen({ row, decision: "rejected" })}>
                  <X size={14} /> Reject
                </Button>
                {row.portfolioImages && row.portfolioImages.length > 0 && (
                  <span className="ml-auto text-xs text-muted">{row.portfolioImages.length} portfolio image{row.portfolioImages.length > 1 ? "s" : ""}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.decision === "approved" ? "Approve worker" : "Reject worker"}>
        <div className="space-y-4">
          {open?.decision === "approved" ? (
            <p className="text-sm text-muted">
              Approve <span className="font-semibold">{open.row.userId?.name}</span>? They will appear in public search and the AI matching results immediately.
            </p>
          ) : (
            <Field label="Reason for rejection" hint="Shared with the worker so they can fix and resubmit.">
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Missing portfolio images, incomplete skills..." />
            </Field>
          )}
          <Button variant={open?.decision === "approved" ? "primary" : "danger"} className="w-full" onClick={() => void confirm()}>
            {open?.decision === "approved" ? "Approve" : "Reject application"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* --------------------------------- Users ---------------------------------- */

function UsersTab() {
  const [role, setRole] = useState("");
  const [acctStatus, setAcctStatus] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminUsers({ role: role || undefined, status: acctStatus || undefined, q: q || undefined });
      setRows(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [role, acctStatus, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyStatus(next: string) {
    if (!target) return;
    await setAccountStatus(target.id, next, next === "suspended" ? suspendReason : undefined);
    setTarget(null);
    setSuspendReason("");
    await load();
  }

  return (
    <div className="mt-6">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          <option value="customer">Customer</option>
          <option value="worker">Worker</option>
          <option value="admin">Admin</option>
        </Select>
        <Select value={acctStatus} onChange={(e) => setAcctStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
        </Select>
        <Button variant="secondary" onClick={() => void load()}>Apply</Button>
      </div>
      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? (
        <Spinner className="mt-10" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={28} />} title="No users match" message="Try clearing your filters or search query." />
      ) : (
        <ul className="space-y-2">
          {rows.map((u) => (
            <li key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{u.name[0]?.toUpperCase()}</span>
                <div>
                  <p className="text-sm font-semibold">{u.name} <Badge tone={u.role === "admin" ? "ai" : u.role === "worker" ? "brand" : "muted"}>{u.role}</Badge></p>
                  <p className="text-xs text-muted">{u.phone} {u.email ? `· ${u.email}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={u.accountStatus} />
                {u.role !== "admin" && (
                  <Button variant="secondary" size="sm" onClick={() => setTarget(u)}>
                    {u.accountStatus === "active" ? <><ShieldBan size={14} /> Suspend</> : <><Check size={14} /> Activate</>}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title={target?.accountStatus === "active" ? "Suspend account" : "Activate account"}>
        <div className="space-y-4 text-sm">
          {target?.accountStatus === "active" ? (
            <>
              <p className="text-muted">
                Suspending <span className="font-semibold">{target.name}</span> blocks them from logging in and hides their content.
              </p>
              <Field label="Reason">
                <Input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Optional context" />
              </Field>
              <Button variant="danger" className="w-full" onClick={() => void applyStatus("suspended")}>
                <ShieldBan size={15} /> Suspend account
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted">Activate <span className="font-semibold">{target?.name}</span> back to an active account?</p>
              <Button className="w-full" onClick={() => void applyStatus("active")}>
                <Check size={15} /> Activate
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------- Categories ------------------------------- */

interface CatRow extends ServiceCategory {
  isActive: boolean;
  sortOrder: number;
}

function CategoriesTab() {
  const [rows, setRows] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminCategories();
      setRows(res.categories as CatRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    await deleteCategory(id);
    await load();
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Categories power the AI parser and worker skill groups.</p>
        <Button onClick={() => setEditing({ _id: "", name: "", slug: "", description: "", icon: "wrench", isActive: true, sortOrder: rows.length + 1 })}>
          <FolderOpen size={15} /> New category
        </Button>
      </div>
      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? (
        <Spinner className="mt-10" />
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c._id} className="card flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{c.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{c.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={c.isActive ? "active" : "deactivated"} />
                <Button variant="secondary" size="sm" onClick={() => setEditing(c)}>Edit</Button>
                {c.isActive && (
                  <Button variant="secondary" size="sm" onClick={() => void remove(c._id)}>Deactivate</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CategoryModal row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
    </div>
  );
}

function CategoryModal({ row, onClose, onSaved }: { row: CatRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [description, setDescription] = useState(row?.description ?? "");
  const [icon, setIcon] = useState(row?.icon ?? "wrench");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(row?.name ?? "");
    setDescription(row?.description ?? "");
    setIcon(row?.icon ?? "wrench");
    setError(null);
  }, [row]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!row || !name.trim()) return;
    setError(null);
    try {
      if (row._id) await updateCategory(row._id, { name, description, icon });
      else await createCategory({ name, description, icon });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save category.");
    }
  }

  return (
    <Modal open={Boolean(row)} onClose={onClose} title={row?._id ? "Edit category" : "New category"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plumbing" required minLength={2} />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
        </Field>
        <Field label="Icon">
          <Select value={icon} onChange={(e) => setIcon(e.target.value)}>
            {["wrench", "plug", "droplet", "home", "hammer", "paintbucket", "smartphone", "car", "zap", "scissors"].map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </Select>
        </Field>
        {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={!name.trim()}>Save category</Button>
      </form>
    </Modal>
  );
}

/* --------------------------------- Reports -------------------------------- */

function ReportsTab() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminReports(status || undefined);
      setRows(res.items as ReportRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function transition(id: string, next: string) {
    await setReportStatus(id, next);
    await load();
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-2">
        {["", "open", "reviewing", "resolved", "dismissed"].map((s) => (
          <button key={s || "all"} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${status === s ? "bg-brand-600 text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}>
            {s || "all"}
          </button>
        ))}
      </div>
      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? (
        <Spinner className="mt-10" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={28} />} title="No reports here" message="Customer reports will appear here for review." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r._id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    Report on <span className="text-brand-700">{refName(r.reportedUserId)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    by {refName(r.reporterId)} · {timeAgo(r.createdAt)} · {r.reason}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.details && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-muted">{r.details}</p>}
              <div className="mt-4 flex gap-2">
                {(r.status === "open" || r.status === "reviewing") && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => void transition(r._id, "reviewing")}>Start review</Button>
                    <Button variant="danger" size="sm" onClick={() => void transition(r._id, "resolved")}>Resolve</Button>
                    <Button variant="secondary" size="sm" onClick={() => void transition(r._id, "dismissed")}>Dismiss</Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------- Reviews -------------------------------- */

function ReviewsTab() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminReviews(status);
      setRows(res.items as ReviewRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderate(id: string, next: string) {
    await moderateReview(id, next);
    await load();
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize transition ${status === s ? "bg-brand-600 text-white" : "bg-slate-100 text-muted hover:bg-slate-200"}`}>
            {s}
          </button>
        ))}
      </div>
      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
      {loading ? (
        <Spinner className="mt-10" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Star size={28} />} title="No reviews here" message="Reviews that need moderation will appear here." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r._id ?? r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    <span className="text-brand-700">{refName(r.customerId)}</span> → {refName(r.workerId)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={13} className={i <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                    ))}{" "}
                    {timeAgo(r.createdAt)}
                  </p>
                </div>
                <StatusBadge status={r.moderationStatus ?? "pending"} />
              </div>
              {r.comment && <p className="mt-3 text-sm text-muted">{r.comment}</p>}
              {(r.moderationStatus === "pending" || r.moderationStatus === "rejected") && (
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => void moderate(r._id ?? r.id ?? "", "approved")}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void moderate(r._id ?? r.id ?? "", "rejected")}>
                    <X size={14} /> Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------- Analytics ------------------------------- */

function AnalyticsTab() {
  const [data, setData] = useState<null | {
    enquiriesByStatus: { _id: string; count: number }[];
    enquiriesByCategory: { _id: string; count: number }[];
    workersByCategory: { _id: string; count: number }[];
    enquiriesByDay: { _id: string; count: number }[];
    topWorkers: { _id: string; userId: unknown; completedEnquiries: number; ratingAverage: number; ratingCount: number }[];
  }>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminAnalytics();
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load analytics.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="mt-6"><Spinner className="mt-10" /></div>;
  if (error || !data) return <p className="mt-6 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>;

  const maxStatus = Math.max(1, ...data.enquiriesByStatus.map((d) => d.count));
  const maxCat = Math.max(1, ...data.enquiriesByCategory.map((d) => d.count));
  const maxDay = Math.max(1, ...data.enquiriesByDay.map((d) => d.count));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card p-5">
        <h2 className="mb-4 font-bold">Enquiries by status</h2>
        <div className="space-y-3">{data.enquiriesByStatus.map((d) => <MiniBar key={d._id} label={d._id} value={d.count} max={maxStatus} />)}</div>
      </div>
      <div className="card p-5">
        <h2 className="mb-4 font-bold">Enquiries by category</h2>
        <div className="space-y-3">{data.enquiriesByCategory.map((d) => <MiniBar key={d._id} label={d._id} value={d.count} max={maxCat} />)}</div>
      </div>
      <div className="card p-5 lg:col-span-2">
        <h2 className="mb-4 font-bold">Enquiries · last 14 days</h2>
        <div className="flex h-36 items-end gap-1">
          {data.enquiriesByDay.map((d) => (
            <div key={d._id} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-brand-600" style={{ height: `${Math.max(3, (d.count / maxDay) * 100)}%` }} title={`${d.count}`} />
              <span className="text-[10px] text-muted">{d._id.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5">
        <h2 className="mb-4 font-bold">Workers by category</h2>
        <div className="space-y-3">{data.workersByCategory.map((d) => <MiniBar key={d._id} label={d._id} value={d.count} max={maxCat} />)}</div>
      </div>
      <div className="card p-5">
        <h2 className="mb-4 font-bold">Top workers</h2>
        <ol className="space-y-2">
          {data.topWorkers.map((w, i) => (
            <li key={w._id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="w-5 text-muted">{i + 1}.</span>
                <span className="font-semibold">{workerName(w.userId)}</span>
              </span>
              <span className="text-xs text-muted">
                {w.completedEnquiries} jobs · {w.ratingAverage.toFixed(1)}★
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------- AI status -------------------------------- */

function AiStatusTab() {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAiHealth();
      setHealth(res.health);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the AI provider.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = health
    ? [
        { label: "Provider", value: health.provider },
        { label: "Model", value: health.model ?? "—" },
        { label: "Base URL", value: health.baseUrl ?? "—" },
        { label: "API key set", value: health.apiKeySet ? "Yes" : "No" },
        { label: "Latency", value: health.latencyMs !== null ? `${health.latencyMs} ms` : "—" },
      ]
    : [];

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Cpu size={16} /> Live status of the configurable AI provider powering request parsing.
        </p>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      {loading && !health ? (
        <Spinner className="mt-10" />
      ) : health ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-1">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Connectivity</h2>
              <Badge tone={health.reachable ? "success" : health.configured ? "danger" : "muted"}>
                {health.reachable ? "Reachable" : health.configured ? "Unreachable" : "Not configured"}
              </Badge>
            </div>
            <dl className="mt-4 space-y-3">
              {rows.map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-4">
                  <dt className="text-xs font-medium text-muted">{r.label}</dt>
                  <dd className="break-all text-right text-sm font-semibold">{r.value}</dd>
                </div>
              ))}
            </dl>
            {health.error && <p className="mt-4 rounded-lg bg-danger-light px-3 py-2 text-xs text-danger">{health.error}</p>}
            {!health.configured && (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
                No provider key configured — the deterministic <span className="font-semibold">heuristic</span> parser is in use
                (fully offline, zero cost). Set <span className="font-mono">AI_PROVIDER</span> and <span className="font-mono">AI_API_KEY</span> in
                <span className="font-mono"> server/.env</span> to enable an LLM.
              </p>
            )}
          </div>

          <div className="card p-5 lg:col-span-2">
            <h2 className="font-bold">Available models</h2>
            <p className="mt-0.5 text-xs text-muted">Reported by the provider's model-list endpoint (no tokens consumed).</p>
            {health.models.length === 0 ? (
              <EmptyState icon={<Cpu size={28} />} title="No models listed" message="The provider did not return a model list." />
            ) : (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {health.models.map((m) => (
                  <Badge key={m} tone={m === health.model ? "ai" : "muted"}>{m}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------- Audit log ------------------------------- */

function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminAuditLogs();
        setRows(res.items as AuditRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load audit logs.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="mt-6"><Spinner className="mt-10" /></div>;
  if (error) return <p className="mt-6 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>;

  return (
    <div className="mt-6">
      <p className="mb-4 flex items-center gap-2 text-sm text-muted">
        <ScrollText size={16} /> Every admin action is recorded for accountability and transparency.
      </p>
      {rows.length === 0 ? (
        <EmptyState icon={<ScrollText size={28} />} title="No actions recorded yet" message="Admin actions will be logged here over time." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r._id} className="card flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-muted"><Activity size={16} /></span>
                <div>
                  <p className="text-sm font-semibold">{r.action}</p>
                  <p className="text-xs text-muted">{r.adminId?.name ?? "Admin"} · {r.targetType} {r.targetId}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted">{timeAgo(r.createdAt)}</p>
                {r.metadata && Object.keys(r.metadata).length > 0 && <p className="text-xs text-muted">{JSON.stringify(r.metadata)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}