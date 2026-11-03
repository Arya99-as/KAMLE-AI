import {
  AlertCircle,
  Briefcase,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getCommissionRate,
  getMyWorkerProfile,
  getWorkerEarnings,
  listEnquiries,
  updateEnquiryStatus,
  updateWorkerProfile,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Enquiry, Payout, WorkerProfile } from "../../types";
import { Badge, Button, Field, Input, Modal, Spinner, StatusBadge } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";
import { StatCard } from "../../components/dashboard/StatCard";
import WorkerQuotations from "../../components/dashboard/WorkerQuotations";
import WorkerPaymentRequests from "../../components/dashboard/WorkerPaymentRequests";

function otherParty(e: Enquiry, meId: string) {
  const ref = String(e.customerId) === meId ? e.workerId : e.customerId;
  return typeof ref === "string" ? { _id: ref, name: "Customer" } : ref;
}

export default function WorkerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Navigation State
  const [navSection, setNavSection] = useState<
    "overview" | "new_requests" | "active_jobs" | "completed_jobs" | "payment_requests" | "quotations" | "earnings" | "reviews" | "profile" | "settings"
  >("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [received, setReceived] = useState<Enquiry[]>([]);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [earningsStats, setEarningsStats] = useState({
    totalGrossEarnings: 0,
    totalCommissionDeducted: 0,
    netPayable: 0,
    totalPaidOut: 0,
    pendingPayouts: 0,
  });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [commissionPercent, setCommissionPercent] = useState<number | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Availability Toggle State (local state synced)
  const [isAvailable, setIsAvailable] = useState(true);

  // Job Completion Modal State
  const [completeModalEnquiry, setCompleteModalEnquiry] = useState<Enquiry | null>(null);
  const [finalAmount, setFinalAmount] = useState<number>(500);
  const [completeLoading, setCompleteLoading] = useState(false);

  // Bank Account Modal / Edit State
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifsc: "",
    upiId: "",
  });
  const [bankSaving, setBankSaving] = useState(false);

  const meId = user?.id ?? "";

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setRefreshing(true);
    try {
      const [r, e, profRes, rateRes] = await Promise.all([
        listEnquiries("received"),
        getWorkerEarnings().catch(() => ({ success: false, stats: null, payouts: [] })),
        getMyWorkerProfile().catch(() => ({ workerProfile: null })),
        getCommissionRate().catch(() => null),
      ]);

      setReceived(r.items);

      if (rateRes?.success) setCommissionPercent(rateRes.commissionPercent);

      if (e && e.stats) {
        setEarningsStats(e.stats);
        setPayouts(e.payouts || []);
      }

      if (profRes && profRes.workerProfile) {
        setProfile(profRes.workerProfile);
        if (profRes.workerProfile.availability) {
          setIsAvailable(profRes.workerProfile.availability.availableNow ?? true);
        }
      }
    } catch (err) {
      console.error("WorkerDashboard load failed", err);
    } finally {
      if (showLoading) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, next: string, note?: string, serviceAmount?: number) {
    try {
      await updateEnquiryStatus(id, next, note, serviceAmount);
      await load(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not update enquiry status.");
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
        `Work completed. Final billed amount: ₹${finalAmount}`,
        finalAmount
      );
      setCompleteModalEnquiry(null);
      await load(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not complete request");
    } finally {
      setCompleteLoading(false);
    }
  }

  async function handleToggleAvailability() {
    const nextState = !isAvailable;
    setIsAvailable(nextState);
    try {
      await updateWorkerProfile({
        availability: {
          availableNow: nextState,
          days: profile?.availability?.days || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
          note: profile?.availability?.note || "Standard working hours",
        },
      });
    } catch (err) {
      console.error("Failed to update availability", err);
    }
  }

  async function handleSaveBankDetails(e: FormEvent) {
    e.preventDefault();
    setBankSaving(true);
    try {
      await updateWorkerProfile({
        payoutAccount: {
          ...bankForm,
          status: "pending",
          isVerified: false,
        },
      } as any);
      setBankModalOpen(false);
      await load(false);
      alert("Bank & UPI details submitted for verification.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save bank details");
    } finally {
      setBankSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // Segmenting Enquiries cleanly (no duplication!)
  const newRequests = received.filter((e) => {
    const st = String(e.status).toUpperCase();
    return st === "PENDING" || st === "SENT";
  });

  const activeJobs = received.filter((e) => {
    const st = String(e.status).toUpperCase();
    return st === "ACCEPTED" || st === "IN_PROGRESS";
  });

  const completedJobs = received.filter((e) => {
    const st = String(e.status).toUpperCase();
    return st === "COMPLETED";
  });

  // Calculate Profile Completion %
  let completionScore = 30;
  if (profile?.professionalDescription) completionScore += 20;
  if ((profile?.skills || []).length > 0) completionScore += 15;
  if ((profile?.serviceCategories || []).length > 0) completionScore += 15;
  if (profile?.payoutAccount?.accountNumber || profile?.payoutAccount?.upiId) completionScore += 20;

  // Filtered requests by search
  function filterBySearch(list: Enquiry[]) {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        otherParty(e, meId).name.toLowerCase().includes(q) ||
        (e.serviceCategory || "").toLowerCase().includes(q) ||
        (e.problemDescription || "").toLowerCase().includes(q) ||
        (e.location || "").toLowerCase().includes(q)
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F8FD]">
      {/* 1. COLLAPSIBLE LEFT WORKSPACE SIDEBAR */}
      <aside
        className={`bg-white border-r border-line flex flex-col shrink-0 transition-all duration-300 z-30 ${
          sidebarCollapsed ? "w-20" : "w-64"
        } hidden md:flex`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <Link to="/" className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <Briefcase size={18} className="text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="text-base font-black text-ink leading-tight">KAMLE AI</div>
                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Worker Workspace
                </div>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-muted hover:bg-slate-100 hover:text-ink transition"
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <button
            onClick={() => setNavSection("overview")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "overview"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <LayoutDashboard size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Overview</span>}
          </button>

          <button
            onClick={() => setNavSection("new_requests")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "new_requests"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Inbox size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>New Requests</span>}
            </div>
            {!sidebarCollapsed && newRequests.length > 0 && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                {newRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setNavSection("active_jobs")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "active_jobs"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock size={18} className="shrink-0" />
              {!sidebarCollapsed && <span>Active Jobs</span>}
            </div>
            {!sidebarCollapsed && activeJobs.length > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                {activeJobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setNavSection("completed_jobs")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "completed_jobs"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <CheckSquare size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Completed Jobs</span>}
          </button>

          <button
            onClick={() => setNavSection("payment_requests")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "payment_requests"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <ShieldCheck size={18} className="shrink-0 text-blue-600" />
            {!sidebarCollapsed && <span>Payment Requests</span>}
          </button>

          <button
            onClick={() => setNavSection("quotations")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "quotations"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <FileText size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Service Pricing / Quotations</span>}
          </button>

          <button
            onClick={() => setNavSection("earnings")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "earnings"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <DollarSign size={18} className="shrink-0 text-emerald-600" />
            {!sidebarCollapsed && <span>Earnings & Payouts</span>}
          </button>

          <button
            onClick={() => setNavSection("reviews")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              navSection === "reviews"
                ? "bg-blue-50 text-blue-700 font-extrabold shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Star size={18} className="shrink-0 text-amber-500" />
            {!sidebarCollapsed && <span>Ratings & Reviews</span>}
          </button>

          <div className="pt-4 pb-1">
            <div className="border-t border-line my-2" />
          </div>

          <Link
            to="/worker/onboarding"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <User size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Profile & Skills</span>}
          </Link>

          <Link
            to="/support"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
          >
            <HelpCircle size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Support & Guidelines</span>}
          </Link>
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-3 border-t border-line">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut size={18} className="shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE VIEW */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace Top Header */}
        <header className="h-16 border-b border-line bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 z-20">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu size={20} />
            </button>

            {/* Live Search */}
            <div className="relative w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs, client names, locations..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-xs font-medium text-ink focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Availability Toggle */}
            <button
              onClick={handleToggleAvailability}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition border ${
                isAvailable
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
              title="Click to toggle availability"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isAvailable ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              <span className="hidden sm:inline">
                {isAvailable ? "Online & Available" : "Offline / Busy"}
              </span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              title="Refresh Data"
            >
              <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>

            {/* Profile Avatar Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-line">
              <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                {user?.name?.[0]?.toUpperCase() ?? "W"}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-ink leading-tight">{user?.name}</div>
                <div className="text-[10px] text-muted leading-tight">Pro Worker</div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {loading ? (
            <div className="py-24 text-center">
              <Spinner />
              <p className="mt-3 text-sm text-muted">Loading your work workspace...</p>
            </div>
          ) : (
            <>
              {/* A. WELCOME & STATUS SECTION */}
              <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-black text-ink">Welcome back, {user?.name}!</h1>
                      {profile?.verificationStatus === "verified" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} /> Verified Pro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                          <AlertCircle size={13} /> Verification Under Review
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      Manage client requests, update job milestones, and track your Razorpay earnings.
                    </p>
                  </div>

                  {/* Profile Completion Meter */}
                  <div className="rounded-2xl bg-slate-50 p-3.5 border border-line min-w-[220px]">
                    <div className="flex justify-between text-xs font-bold text-ink mb-1.5">
                      <span>Profile Strength</span>
                      <span className="text-blue-600">{completionScore}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${completionScore}%` }}
                      />
                    </div>
                    {completionScore < 100 && (
                      <button
                        onClick={() => setBankModalOpen(true)}
                        className="mt-2 text-[11px] font-semibold text-blue-600 hover:underline block text-left"
                      >
                        + Add bank details to reach 100%
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* B. 4 STATISTICS KPI CARDS */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="New Requests"
                  value={newRequests.length}
                  icon={Inbox}
                  sub="Awaiting your response"
                  tone="blue"
                  onClick={() => setNavSection("new_requests")}
                />
                <StatCard
                  title="Active Jobs"
                  value={activeJobs.length}
                  icon={Clock}
                  sub="Work in progress"
                  tone="amber"
                  onClick={() => setNavSection("active_jobs")}
                />
                <StatCard
                  title="Completed Jobs"
                  value={completedJobs.length}
                  icon={CheckCircle2}
                  sub="Successfully finished"
                  tone="emerald"
                  onClick={() => setNavSection("completed_jobs")}
                />
                <StatCard
                  title="Net Earnings"
                  value={`₹${earningsStats.netPayable.toLocaleString()}`}
                  icon={DollarSign}
                  sub={`₹${earningsStats.pendingPayouts} awaiting admin transfer`}
                  tone="purple"
                  onClick={() => setNavSection("earnings")}
                />
              </div>

              {/* C. JOB MANAGEMENT SECTION (Filterable views) */}
              {(navSection === "overview" ||
                navSection === "new_requests" ||
                navSection === "active_jobs" ||
                navSection === "completed_jobs") && (
                <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden">
                  {/* Job Segment Tabs */}
                  <div className="flex border-b border-line bg-slate-50/50 px-4 pt-2 overflow-x-auto">
                    <button
                      onClick={() => setNavSection("overview")}
                      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
                        navSection === "overview"
                          ? "border-blue-600 text-blue-600 bg-white rounded-t-xl"
                          : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      All Requests ({received.length})
                    </button>

                    <button
                      onClick={() => setNavSection("new_requests")}
                      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
                        navSection === "new_requests"
                          ? "border-blue-600 text-blue-600 bg-white rounded-t-xl"
                          : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      New Requests
                      {newRequests.length > 0 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700 font-extrabold">
                          {newRequests.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setNavSection("active_jobs")}
                      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
                        navSection === "active_jobs"
                          ? "border-blue-600 text-blue-600 bg-white rounded-t-xl"
                          : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      Active Jobs
                      {activeJobs.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 font-extrabold">
                          {activeJobs.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setNavSection("completed_jobs")}
                      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold transition whitespace-nowrap ${
                        navSection === "completed_jobs"
                          ? "border-blue-600 text-blue-600 bg-white rounded-t-xl"
                          : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      Completed Jobs ({completedJobs.length})
                    </button>
                  </div>

                  {/* Job List Content */}
                  <div className="p-6">
                    {(() => {
                      const displayedList =
                        navSection === "new_requests"
                          ? filterBySearch(newRequests)
                          : navSection === "active_jobs"
                          ? filterBySearch(activeJobs)
                          : navSection === "completed_jobs"
                          ? filterBySearch(completedJobs)
                          : filterBySearch(received);

                      if (displayedList.length === 0) {
                        return (
                          <EmptyState
                            title="No enquiries in this section"
                            message="When customers in your area request service quotes, they will appear here with contact details."
                          />
                        );
                      }

                      return (
                        <div className="space-y-4">
                          {displayedList.map((e) => {
                            const st = String(e.status).toUpperCase();
                            const customer = otherParty(e, meId);
                            const isPending = st === "PENDING" || st === "SENT";
                            const isAccepted = st === "ACCEPTED";
                            const isInProgress = st === "IN_PROGRESS";
                            const isCompleted = st === "COMPLETED";

                            return (
                              <div
                                key={e._id}
                                className="rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                              >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                  {/* Left Customer Info */}
                                  <div className="space-y-2 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-base text-ink">{customer.name}</span>
                                      <Badge tone="brand">{e.serviceCategory}</Badge>
                                      <StatusBadge status={e.status} />

                                      {isCompleted && e.paymentStatus === "PAID" && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                          <Check size={12} /> Customer Paid ₹{e.serviceAmount}
                                        </span>
                                      )}
                                      {isCompleted && e.paymentStatus !== "PAID" && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                                          Awaiting Customer Payment (₹{e.serviceAmount})
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                      {e.problemDescription}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                                      {e.location && <span>📍 Client Address: {e.location}</span>}
                                      <span>📅 {new Date(e.createdAt).toLocaleDateString()}</span>
                                      {e.serviceAmount && (
                                        <span className="font-bold text-slate-900">
                                          Billed Amount: ₹{e.serviceAmount}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right Worker Action Buttons */}
                                  <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end shrink-0">
                                    {/* Action for New Pending Requests */}
                                    {isPending && (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="primary"
                                          size="sm"
                                          onClick={() => updateStatus(e._id, "ACCEPTED", "Accepted by professional")}
                                          className="bg-blue-600 hover:bg-blue-700 font-bold"
                                        >
                                          Accept Job
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => updateStatus(e._id, "REJECTED", "Worker unavailable")}
                                          className="text-rose-600 hover:bg-rose-50 text-xs"
                                        >
                                          Decline
                                        </Button>
                                      </div>
                                    )}

                                    {/* Action for Accepted Jobs */}
                                    {isAccepted && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => updateStatus(e._id, "IN_PROGRESS", "Started work")}
                                        className="font-bold text-xs"
                                      >
                                        Start Work
                                      </Button>
                                    )}

                                    {/* Action for Ongoing Work */}
                                    {(isAccepted || isInProgress) && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => {
                                          setCompleteModalEnquiry(e);
                                          setFinalAmount(e.serviceAmount || 500);
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-sm"
                                      >
                                        <CheckCircle2 size={14} className="mr-1" /> Mark Completed
                                      </Button>
                                    )}

                                    {isCompleted && (
                                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                        Job Closed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* D. SERVICE PRICING / QUOTATIONS SECTION */}
              {navSection === "quotations" && <WorkerQuotations enquiries={received} />}

              {/* PAYMENT REQUESTS SECTION */}
              {navSection === "payment_requests" && (
                <WorkerPaymentRequests
                  activeJobs={received.filter((e) =>
                    ["ACCEPTED", "IN_PROGRESS", "COMPLETED"].includes(String(e.status).toUpperCase())
                  )}
                  onRefresh={load}
                />
              )}

              {/* D. EARNINGS & PAYOUTS SECTION */}
              {navSection === "earnings" && (
                <div className="space-y-6">
                  {/* Earnings Breakdown Cards */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted">
                        Gross Earnings
                      </div>
                      <div className="mt-2 text-2xl font-black text-ink">
                        ₹{earningsStats.totalGrossEarnings.toLocaleString()}
                      </div>
                      <p className="mt-1 text-xs text-muted">Total value of completed jobs</p>
                    </div>

                    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                      <div className="text-xs font-bold uppercase tracking-wider text-muted">
                        Platform Commission{commissionPercent !== null ? ` (${commissionPercent}%)` : ""}
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-700">
                        ₹{earningsStats.totalCommissionDeducted.toLocaleString()}
                      </div>
                      <p className="mt-1 text-xs text-muted">Retained for marketplace & payments</p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Net Payable Share
                      </div>
                      <div className="mt-2 text-2xl font-black text-emerald-700">
                        ₹{earningsStats.netPayable.toLocaleString()}
                      </div>
                      <p className="mt-1 text-xs text-emerald-600">Your net share after platform commission</p>
                    </div>
                  </div>

                  {/* Bank / Payout Account Card */}
                  <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
                      <div>
                        <h3 className="text-base font-bold text-ink">Bank & UPI Payout Account</h3>
                        <p className="text-xs text-muted">
                          Funds from completed jobs are disbursed directly to your verified bank account or UPI ID.
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setBankModalOpen(true)}
                        className="text-xs font-bold"
                      >
                        {profile?.payoutAccount?.accountNumber ? "Update Bank Details" : "+ Add Bank Account"}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                      <div className="rounded-xl bg-slate-50 p-3.5 border border-line">
                        <span className="text-muted block font-medium">Account Holder</span>
                        <span className="font-bold text-ink text-sm">
                          {profile?.payoutAccount?.accountHolderName || user?.name || "Not provided"}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3.5 border border-line">
                        <span className="text-muted block font-medium">Bank Name</span>
                        <span className="font-bold text-ink text-sm">
                          {profile?.payoutAccount?.bankName || "Not provided"}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3.5 border border-line">
                        <span className="text-muted block font-medium">Account Number</span>
                        <span className="font-mono font-bold text-ink text-sm">
                          {profile?.payoutAccount?.accountNumber
                            ? `•••• ${profile.payoutAccount.accountNumber.slice(-4)}`
                            : "Not provided"}
                        </span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3.5 border border-line">
                        <span className="text-muted block font-medium">UPI ID</span>
                        <span className="font-mono font-bold text-blue-600 text-sm">
                          {profile?.payoutAccount?.upiId || "Not provided"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payout History Ledger */}
                  <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-line">
                      <h3 className="text-base font-bold text-ink">Payout Settlement Ledger</h3>
                      <p className="text-xs text-muted">History of transfers processed by KAMLE AI</p>
                    </div>

                    {payouts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted">
                        No payout disbursements recorded yet. Payouts are queued automatically once customer payments settle.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-line font-bold uppercase tracking-wider text-muted">
                            <tr>
                              <th className="px-6 py-3.5">Disbursement Amount</th>
                              <th className="px-6 py-3.5">Status</th>
                              <th className="px-6 py-3.5">Payout Method</th>
                              <th className="px-6 py-3.5">Reference ID</th>
                              <th className="px-6 py-3.5">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {payouts.map((po) => (
                              <tr key={po._id} className="hover:bg-slate-50/70 transition">
                                <td className="px-6 py-4 font-black text-ink text-sm">
                                  ₹{po.workerPayableAmount}
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                      po.status === "PAID"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}
                                  >
                                    {po.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 uppercase font-semibold text-slate-700">
                                  {po.method || "Manual NEFT/UPI"}
                                </td>
                                <td className="px-6 py-4 font-mono text-muted">
                                  {po.providerPayoutRef || po._id}
                                </td>
                                <td className="px-6 py-4 text-muted">
                                  {new Date(po.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* E. RATINGS & REVIEWS SECTION */}
              {navSection === "reviews" && (
                <div className="rounded-3xl border border-line bg-white p-6 shadow-sm space-y-4">
                  <div className="border-b border-line pb-4">
                    <h3 className="text-base font-bold text-ink">Client Ratings & Feedback</h3>
                    <p className="text-xs text-muted">Public reviews submitted by clients upon job completion</p>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                    <div className="text-3xl font-black text-amber-600">
                      {profile?.ratingAverage?.toFixed(1) || "5.0"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={18} fill="currentColor" />
                        ))}
                      </div>
                      <p className="text-xs text-muted mt-1">
                        Based on {profile?.ratingCount || 0} customer reviews in Kolhapur
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* MODAL: Mark Work Completed */}
      {completeModalEnquiry && (
        <Modal
          open={Boolean(completeModalEnquiry)}
          onClose={() => !completeLoading && setCompleteModalEnquiry(null)}
          title="Mark Job Completed"
        >
          <form onSubmit={handleMarkCompleteSubmit} className="space-y-4">
            <p className="text-xs text-muted">
              Confirm that the service requested by{" "}
              <strong>{otherParty(completeModalEnquiry, meId).name}</strong> has been finished. Set the
              final billed service amount for the client to pay via Razorpay.
            </p>

            <Field label="Final Billed Amount (₹)">
              <Input
                type="number"
                min={1}
                value={finalAmount}
                onChange={(e) => setFinalAmount(Number(e.target.value))}
                required
              />
            </Field>

            <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900 border border-blue-100">
              <span className="font-bold">Transparent Split:</span>
              <div className="mt-1 flex justify-between">
                <span>Worker Share (90%): ₹{Math.round(finalAmount * 0.9)}</span>
                <span>Platform Fee (10%): ₹{Math.round(finalAmount * 0.1)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setCompleteModalEnquiry(null)}
                disabled={completeLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={completeLoading || finalAmount <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white"
              >
                {completeLoading ? "Submitting..." : `Confirm Completion (₹${finalAmount})`}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Bank Account Setup */}
      {bankModalOpen && (
        <Modal
          open={bankModalOpen}
          onClose={() => !bankSaving && setBankModalOpen(false)}
          title="Setup Bank / UPI Payout Account"
        >
          <form onSubmit={handleSaveBankDetails} className="space-y-4">
            <p className="text-xs text-muted">
              Provide your bank account or UPI details for automated or admin-authorized payout disbursements.
            </p>

            <Field label="Account Holder Name">
              <Input
                value={bankForm.accountHolderName}
                onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
                placeholder="e.g. Ramesh Patil"
                required
              />
            </Field>

            <Field label="Bank Name">
              <Input
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                placeholder="e.g. State Bank of India"
              />
            </Field>

            <Field label="Bank Account Number">
              <Input
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                placeholder="e.g. 123456789012"
              />
            </Field>

            <Field label="IFSC Code">
              <Input
                value={bankForm.ifsc}
                onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value })}
                placeholder="e.g. SBIN0001234"
              />
            </Field>

            <Field label="UPI ID (VPA)">
              <Input
                value={bankForm.upiId}
                onChange={(e) => setBankForm({ ...bankForm, upiId: e.target.value })}
                placeholder="e.g. ramesh@okaxis"
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setBankModalOpen(false)}
                disabled={bankSaving}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={bankSaving}>
                {bankSaving ? "Saving..." : "Save Details"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
