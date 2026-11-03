import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Check,
  CreditCard,
  FileText,
  Heart,
  LogOut,
  MapPin,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useChat } from "../../features/chat/ChatContext";
import { FloatingChatButton } from "../../features/chat/FloatingChatButton";
import { ChatPanel } from "../../features/chat/ChatPanel";
import { useLocation as useUserLocation } from "../../context/LocationContext";
import {
  confirmEnquiryCompletion,
  createPaymentOrder,
  createReport,
  createReview,
  getMyPayments,
  listEnquiries,
  listFavorites,
  listMyReviews,
  searchWorkers,
  updateEnquiryStatus,
  verifyPayment,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Enquiry, Payment, Quotation, Review, UserRef, PublicWorker } from "../../types";
import { Avatar, Badge, Button, Field, Modal, Select, Spinner, StatusBadge, Textarea } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";
import { WorkerCard } from "../../components/worker/WorkerCard";
import { Logo } from "../../components/brand/Logo";
import { StatCard } from "../../components/dashboard/StatCard";
import { ReceiptModal } from "../../components/dashboard/ReceiptModal";
import CustomerQuotations from "../../components/dashboard/CustomerQuotations";

type FavItem = { favoriteId: string; worker: PublicWorker };

function actorName(e: Enquiry, meId: string) {
  const ref = String(e.workerId) === meId ? e.customerId : e.workerId;
  return typeof ref === "string" ? "Worker" : ref.name;
}

function nativeId(ref: string | UserRef) {
  return typeof ref === "string" ? ref : ref._id;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const AI_SUGGESTION_CHIPS = [
  "Kitchen sink leaking & pipe replacement",
  "Main circuit breaker tripping",
  "Split AC filter cleaning & gas check",
  "Bathroom waterproofing & tile work",
  "Ceiling fan installation",
];

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { location: locationName } = useUserLocation();
  const { openChat } = useChat();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const [tab, setTab] = useState<"requests" | "quotations" | "payments" | "recommended" | "favorites" | "reviews">("requests");
  const [quotationRefreshKey, setQuotationRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [favorites, setFavorites] = useState<FavItem[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [recommended, setRecommended] = useState<PublicWorker[]>([]);

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);

  // AI Prompt input
  const [aiPrompt, setAiPrompt] = useState("");

  // Payment Modal state
  const [payModalEnquiry, setPayModalEnquiry] = useState<Enquiry | null>(null);
  const [payAmount, setPayAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [payLoading, setPayLoading] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  // Review Modal state
  const [reviewModalEnquiry, setReviewModalEnquiry] = useState<Enquiry | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Dispute Modal state
  const [disputeModalEnquiry, setDisputeModalEnquiry] = useState<Enquiry | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);

  // Worker report modal state (opened from a worker profile via ?report=<userId>)
  const [searchParams, setSearchParams] = useSearchParams();
  const [reportWorkerId, setReportWorkerId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const meId = user?.id ?? "";

  // WorkerProfilePage links here with ?report=<workerUserId>. Read it once and
  // clear it from the URL so a refresh does not reopen a stale report dialog.
  useEffect(() => {
    const target = searchParams.get("report");
    if (!target) return;
    setReportWorkerId(target);
    setReportReason("");
    setReportDetails("");
    const next = new URLSearchParams(searchParams);
    next.delete("report");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setRefreshing(true);
    setLoadError(null);
    try {
      const [e, p, f, r, rec] = await Promise.all([
        listEnquiries("sent"),
        getMyPayments().catch(() => ({ success: false, payments: [] })),
        listFavorites(),
        listMyReviews(),
        searchWorkers({ limit: 6 }).catch(() => ({ items: [] })),
      ]);
      setEnquiries(e.items);
      setPayments(p.payments || []);
      setFavorites(f.items);
      setMyReviews(r.items);
      setRecommended(rec.items || []);
    } catch (err) {
      if (showLoading) setLoadError(err instanceof Error ? err.message : "Could not load dashboard data.");
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

  async function handleCancelRequest(id: string) {
    if (!confirm("Are you sure you want to cancel this request?")) return;
    try {
      await updateEnquiryStatus(id, "CANCELLED", "Cancelled by customer");
      await load(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not cancel request");
    }
  }

  function handleInitiatePayment(e: Enquiry) {
    setPayModalEnquiry(e);
    setPayAmount(e.serviceAmount && e.serviceAmount > 0 ? e.serviceAmount : 0);
    setPaySuccessMsg(null);
  }

  // The payment API only needs the enquiry id; the amount is resolved on the
  // server from the approved quotation. We build a display-only enquiry view
  // from the quotation so the existing checkout modal can be reused.
  function handlePayQuotation(quotation: Quotation) {
    const enquiry = typeof quotation.enquiryId === "string" ? null : quotation.enquiryId;
    const enquiryId = enquiry?._id ?? (typeof quotation.enquiryId === "string" ? quotation.enquiryId : "");
    handleInitiatePayment({
      _id: enquiryId,
      customerId: quotation.customerId,
      workerId: quotation.workerId,
      serviceCategory: enquiry?.serviceCategory ?? "Service",
      problemDescription: enquiry?.problemDescription ?? "Approved service quotation",
      location: enquiry?.location ?? "",
      status: enquiry?.status ?? "ACCEPTED",
      serviceAmount: quotation.approvedAmount ?? quotation.total,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    } as Enquiry);
  }

  async function payWithRazorpay(order: { keyId?: string; orderId: string; amount: number; currency: string }) {
    const loaded = await loadRazorpayScript();
    if (!loaded) throw new Error("Could not load the payment gateway. Please try again.");

    return new Promise<void>((resolve, reject) => {
      const RazorpayCheckout = (window as unknown as {
        Razorpay: new (options: Record<string, unknown>) => { open: () => void };
      }).Razorpay;

      const checkout = new RazorpayCheckout({
        key: order.keyId,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: "KAMLE AI",
        description: "Service payment",
        order_id: order.orderId,
        theme: { color: "#0866F5" },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verified = await verifyPayment({
              providerOrderId: order.orderId,
              providerPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              paymentMethod: "razorpay",
            });
            if (!verified.success) throw new Error(verified.message || "Payment verification failed");
            resolve();
          } catch (err) {
            reject(err);
          }
        },
        modal: { ondismiss: () => reject(new Error("Payment was cancelled")) },
      });

      checkout.open();
    });
  }

  async function handleConfirmPayment(ev: FormEvent) {
    ev.preventDefault();
    if (!payModalEnquiry) return;
    setPayLoading(true);
    try {
      const orderRes = await createPaymentOrder(payModalEnquiry._id);
      if (!orderRes.success) throw new Error("Could not initialize payment order");
      const order = orderRes.order;

      if (order.provider === "razorpay") {
        await payWithRazorpay(order);
      } else {
        const verifyRes = await verifyPayment({
          providerOrderId: order.orderId,
          paymentMethod: paymentMethod || "simulated",
        });
        if (!verifyRes.success) throw new Error(verifyRes.message || "Payment verification failed");
      }

      setPaySuccessMsg(`Payment of ₹${order.amount} verified successfully! (Txn: ${order.transactionRef})`);
      setQuotationRefreshKey((key) => key + 1);
      setTimeout(() => {
        setPayModalEnquiry(null);
        setPaySuccessMsg(null);
        void load(false);
      }, 1600);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPayLoading(false);
    }
  }

  async function handleConfirmCompletion(e: Enquiry) {
    try {
      await confirmEnquiryCompletion(e._id);
      await load(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not confirm completion");
    }
  }

  async function handleSubmitReview(ev: FormEvent) {
    ev.preventDefault();
    if (!reviewModalEnquiry) return;
    setReviewLoading(true);
    try {
      const wId = nativeId(reviewModalEnquiry.workerId);
      await createReview({
        workerId: wId,
        enquiryId: reviewModalEnquiry._id,
        rating: reviewRating,
        comment: reviewComment,
      });
      alert("Thank you! Your review has been submitted.");
      setReviewModalEnquiry(null);
      setReviewComment("");
      void load(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleSubmitDispute(ev: FormEvent) {
    ev.preventDefault();
    if (!disputeModalEnquiry) return;
    if (!disputeReason.trim()) {
      alert("Please enter details about the issue");
      return;
    }
    setDisputeLoading(true);
    try {
      await updateEnquiryStatus(
        disputeModalEnquiry._id,
        "DISPUTED",
        "Dispute raised by customer",
        undefined,
        disputeReason
      );
      alert("Your dispute has been logged. Admin will review the case.");
      setDisputeModalEnquiry(null);
      setDisputeReason("");
      void load(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not record dispute");
    } finally {
      setDisputeLoading(false);
    }
  }

  async function handleSubmitReport(ev: FormEvent) {
    ev.preventDefault();
    if (!reportWorkerId) return;
    if (!reportReason.trim()) {
      alert("Please choose a reason for the report");
      return;
    }
    setReportLoading(true);
    try {
      await createReport({
        reportedUserId: reportWorkerId,
        reason: reportReason.trim(),
        details: reportDetails.trim(),
      });
      alert("Thanks for letting us know. Our trust & safety team will review this report.");
      setReportWorkerId(null);
      setReportReason("");
      setReportDetails("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not submit the report");
    } finally {
      setReportLoading(false);
    }
  }

  function handleAiSearchSubmit(e: FormEvent) {
    e.preventDefault();
    openChat();
  }

  const active = enquiries.filter((e) => {
    const st = String(e.status).toUpperCase();
    return st !== "CANCELLED" && st !== "REJECTED";
  });
  const pending = enquiries.filter((e) => ["PENDING", "SENT"].includes(String(e.status).toUpperCase()));
  const completed = enquiries.filter((e) => String(e.status).toUpperCase() === "COMPLETED");
  const unpaid = completed.filter((e) => e.paymentStatus !== "PAID" && (e.serviceAmount || 0) > 0);
  const totalPaidSum = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#F5F8FD]">
      {/* Customer Header & Navigation */}
      <div className="border-b border-line bg-white shadow-sm sticky top-0 z-20">
        <div className="container-x flex flex-col gap-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="KAMLE AI home" className="hover:opacity-90 transition">
              <Logo size="sm" />
            </Link>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-ink">My Service Hub</h1>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                  Customer
                </span>
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <MapPin size={12} className="text-brand-600" />
                  {locationName}
                </span>
              </div>
              <p className="text-xs text-muted hidden sm:block">
                Discover local professionals, manage bookings, and make secure payments
              </p>
            </div>
          </div>

          {/* Quick Action Navigation & Profile */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Link to="/discover">
              <Button variant="secondary" size="sm" className="gap-1.5 font-semibold text-ink">
                <Briefcase size={14} className="text-brand-600" />
                Find Workers
              </Button>
            </Link>
            <Button
              variant="ai"
              size="sm"
              onClick={() => openChat()}
              className="gap-1.5 font-bold shadow-sm"
            >
              <Sparkles size={14} />
              Ask KAMLE AI
            </Button>

            {/* Profile Avatar & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
              <div className="hidden sm:flex items-center gap-2 py-0.5 pl-1 pr-1">
                <Avatar name={user?.name || "Customer"} src={user?.avatarUrl} size={28} />
                <span className="text-xs font-bold text-slate-800">{user?.name?.split(" ")[0]}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-500 hover:text-rose-600 p-2"
                title="Log out"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-x py-6 space-y-6">
        {/* Large KAMLE AI Assistant Section */}
        <div className="overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-6 sm:p-8 text-white shadow-lg">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-wide backdrop-blur-md">
              <Sparkles size={14} className="text-amber-300" />
              <span>AI-POWERED LOCAL DISCOVERY</span>
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight text-white">
              What service do you need done today?
            </h2>
            <p className="mt-2 text-sm text-blue-100">
              Type your problem naturally or pick a common task. Our AI matches verified local workers in Kolhapur in seconds.
            </p>

            <form onSubmit={handleAiSearchSubmit} className="mt-5 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Water dripping from tap, need a plumber today..."
                  className="w-full rounded-2xl border-0 bg-white pl-11 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-md hover:bg-amber-300 transition"
              >
                <Sparkles size={16} />
                Ask KAMLE AI
              </button>
            </form>

            {/* Quick Suggestion Chips */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-blue-200">Suggestions:</span>
              {AI_SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setAiPrompt(chip);
                    openChat();
                  }}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/20 transition backdrop-blur-sm"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Statistics Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Requests"
            value={active.length}
            icon={CalendarClock}
            sub={`${pending.length} awaiting response`}
            tone="blue"
            onClick={() => setTab("requests")}
          />
          <StatCard
            title="Completed Jobs"
            value={completed.length}
            icon={Check}
            sub={unpaid.length > 0 ? `${unpaid.length} awaiting payment` : "All paid up"}
            tone="emerald"
            onClick={() => setTab("requests")}
          />
          <StatCard
            title="Total Payments"
            value={`₹${totalPaidSum.toLocaleString()}`}
            icon={CreditCard}
            sub={`${payments.length} receipts on record`}
            tone="purple"
            onClick={() => setTab("payments")}
          />
          <StatCard
            title="Saved Workers"
            value={favorites.length}
            icon={Heart}
            sub="Ready for quick re-hire"
            tone="rose"
            onClick={() => setTab("favorites")}
          />
        </div>

        {/* Dashboard Tabs & Content Area */}
        <div className="rounded-3xl border border-line bg-white shadow-sm overflow-hidden">
          {/* Navigation Bar inside Card */}
          <div className="flex border-b border-line bg-slate-50/50 px-4 pt-2 overflow-x-auto">
            <button
              onClick={() => setTab("requests")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
                tab === "requests"
                  ? "border-brand-600 text-brand-600 bg-white rounded-t-xl"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <CalendarClock size={16} />
              Recent Requests
              {active.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-bold">
                  {active.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setTab("quotations")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
                tab === "quotations"
                  ? "border-brand-600 text-brand-600 bg-white rounded-t-xl"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <FileText size={16} />
              Service Quotations
            </button>

            <button
              onClick={() => setTab("payments")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
                tab === "payments"
                  ? "border-brand-600 text-brand-600 bg-white rounded-t-xl"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Receipt size={16} />
              Payment History
              {payments.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-bold">
                  {payments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setTab("recommended")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
                tab === "recommended"
                  ? "border-brand-600 text-brand-600 bg-white rounded-t-xl"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Users size={16} />
              Recommended Pros
            </button>

            <button
              onClick={() => setTab("favorites")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
                tab === "favorites"
                  ? "border-brand-600 text-brand-600 bg-white rounded-t-xl"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Heart size={16} />
              Saved ({favorites.length})
            </button>

            <button
              onClick={() => setTab("reviews")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
                tab === "reviews"
                  ? "border-brand-600 text-brand-600 bg-white rounded-t-xl"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Star size={16} />
              My Reviews ({myReviews.length})
            </button>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-20 text-center">
                <Spinner />
                <p className="mt-3 text-sm text-muted">Loading your requests and activity...</p>
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
                {loadError}
              </div>
            ) : (
              <>
                {/* 1. REQUESTS TAB */}
                {tab === "requests" && (
                  <div>
                    {enquiries.length === 0 ? (
                      <EmptyState
                        title="No service requests yet"
                        message="You haven't sent any service enquiries yet. Find a local verified professional or ask KAMLE AI to get started."
                        action={
                          <Link to="/discover">
                            <Button variant="primary">
                              <Briefcase size={14} className="mr-1.5" /> Find a Worker
                            </Button>
                          </Link>
                        }
                      />
                    ) : (
                      <div className="space-y-4">
                        {enquiries.map((e) => {
                          const st = String(e.status).toUpperCase();
                          const isCompleted = st === "COMPLETED";
                          const isPaid = e.paymentStatus === "PAID";
                          const isDisputed = st === "DISPUTED";
                          const isPending = st === "PENDING" || st === "SENT";
                          const isAccepted = st === "ACCEPTED";
                          const hasBilledAmount = (e.serviceAmount || 0) > 0;

                          return (
                            <div
                              key={e._id}
                              className="rounded-2xl border border-line bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                {/* Left Info */}
                                <div className="space-y-2 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-base text-ink">{actorName(e, meId)}</span>
                                    <Badge tone="brand">{e.serviceCategory}</Badge>
                                    <StatusBadge status={e.status} />

                                    {/* Payment status badge */}
                                    {isPaid ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                                        <Check size={12} /> Paid ₹{e.serviceAmount}
                                      </span>
                                    ) : hasBilledAmount && isCompleted ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                                        Payment Due: ₹{e.serviceAmount}
                                      </span>
                                    ) : null}

                                    {isCompleted && e.clientConfirmedAt && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                                        <Check size={12} /> Completion Confirmed
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                    {e.problemDescription}
                                  </p>

                                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
                                    {e.location && <span>📍 {e.location}</span>}
                                    <span>📅 {new Date(e.createdAt).toLocaleDateString()}</span>
                                    {hasBilledAmount && (
                                      <span className="font-bold text-slate-900">
                                        Quotation / Final Amount: ₹{e.serviceAmount}
                                      </span>
                                    )}
                                  </div>

                                  {isDisputed && e.disputeReason && (
                                    <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                                      <strong>Dispute Note:</strong> {e.disputeReason}
                                    </div>
                                  )}
                                </div>

                                {/* Right Actions */}
                                <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end shrink-0">
                                  {/* CRITICAL: Payment action ONLY appears when completed, unpaid, and amount exists */}
                                  {isCompleted && !isPaid && hasBilledAmount && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleInitiatePayment(e)}
                                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                                    >
                                      <CreditCard size={14} /> Pay Now (₹{e.serviceAmount})
                                    </Button>
                                  )}

                                  {isCompleted && !e.clientConfirmedAt && !isDisputed && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleConfirmCompletion(e)}
                                      className="gap-1.5"
                                    >
                                      <Check size={14} className="text-blue-600" /> Confirm Completion
                                    </Button>
                                  )}

                                  {isCompleted && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => setReviewModalEnquiry(e)}
                                      className="gap-1.5"
                                    >
                                      <Star size={14} className="text-amber-500 fill-amber-500" /> Rate & Review
                                    </Button>
                                  )}

                                  {isCompleted && !isDisputed && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDisputeModalEnquiry(e)}
                                      className="gap-1.5 text-rose-600 hover:bg-rose-50"
                                    >
                                      <AlertTriangle size={13} /> Report Problem
                                    </Button>
                                  )}

                                  {(isPending || isAccepted) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCancelRequest(e._id)}
                                      className="gap-1 text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs"
                                    >
                                      <X size={13} /> Cancel Request
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

                {/* 2. SERVICE QUOTATIONS TAB */}
                {tab === "quotations" && (
                  <CustomerQuotations
                    onPay={handlePayQuotation}
                    refreshKey={quotationRefreshKey}
                    onOpenPayments={() => setTab("payments")}
                  />
                )}

                {/* 3. PAYMENTS TAB */}
                {tab === "payments" && (
                  <div>
                    {payments.length === 0 ? (
                      <EmptyState
                        title="No payment history yet"
                        message="When you complete service requests and pay through KAMLE AI, your verified Razorpay receipts will appear here."
                      />
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-line">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-line text-xs font-bold uppercase tracking-wider text-muted">
                            <tr>
                              <th className="px-5 py-3.5">Amount</th>
                              <th className="px-5 py-3.5">Status</th>
                              <th className="px-5 py-3.5">Payment Method</th>
                              <th className="px-5 py-3.5">Transaction ID</th>
                              <th className="px-5 py-3.5">Date</th>
                              <th className="px-5 py-3.5 text-right">Receipt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {payments.map((p) => (
                              <tr key={p._id} className="hover:bg-slate-50/70 transition">
                                <td className="px-5 py-4 font-black text-ink text-base">₹{p.amount}</td>
                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                      p.status === "COMPLETED"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border border-amber-200"
                                    }`}
                                  >
                                    {p.status}
                                  </span>
                                </td>
                                <td className="px-5 py-4 font-semibold text-slate-700 uppercase">
                                  {p.paymentMethod || "Razorpay / UPI"}
                                </td>
                                <td className="px-5 py-4 font-mono text-xs text-muted">
                                  {p.transactionRef || p._id}
                                </td>
                                <td className="px-5 py-4 text-xs text-muted">
                                  {new Date(p.createdAt).toLocaleString()}
                                </td>
                                <td className="px-5 py-4 text-right">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setSelectedReceipt(p)}
                                    className="gap-1.5 text-xs font-semibold"
                                  >
                                    <FileText size={13} className="text-blue-600" /> View Receipt
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

                {/* 3. RECOMMENDED WORKERS TAB */}
                {tab === "recommended" && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-ink">Verified Local Professionals</h3>
                        <p className="text-xs text-muted">High-rated service providers ready to take on tasks in your area</p>
                      </div>
                      <Link to="/discover">
                        <Button variant="secondary" size="sm" className="text-xs font-bold">
                          Explore All Workers →
                        </Button>
                      </Link>
                    </div>

                    {recommended.length === 0 ? (
                      <EmptyState
                        title="Finding recommendations..."
                        message="Visit the Discover page to browse all available workers in your neighborhood."
                      />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {recommended.map((w) => (
                          <WorkerCard key={w.workerId} worker={w} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. FAVORITES TAB */}
                {tab === "favorites" && (
                  <div>
                    {favorites.length === 0 ? (
                      <EmptyState
                        title="No saved workers"
                        message="Click the heart icon on any worker's profile to bookmark them for easy access later."
                        action={
                          <Link to="/discover">
                            <Button variant="primary">Browse Workers</Button>
                          </Link>
                        }
                      />
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {favorites.map((f) => (
                          <WorkerCard key={f.favoriteId} worker={f.worker} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. REVIEWS TAB */}
                {tab === "reviews" && (
                  <div>
                    {myReviews.length === 0 ? (
                      <EmptyState
                        title="No reviews submitted yet"
                        message="Once a service request is completed, leave feedback to help other clients make informed decisions."
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        {myReviews.map((r, i) => (
                          <div key={r._id || i} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-amber-500">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                  <Star
                                    key={idx}
                                    size={16}
                                    fill={idx < r.rating ? "currentColor" : "none"}
                                  />
                                ))}
                                <span className="ml-2 text-xs font-bold text-ink">{r.rating}.0 / 5</span>
                              </div>
                              <span className="text-xs text-muted">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-slate-800 leading-relaxed font-medium">
                              "{r.comment || "Service was completed as requested."}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Pay Modal */}
      {payModalEnquiry && (
        <Modal
          open={Boolean(payModalEnquiry)}
          onClose={() => !payLoading && setPayModalEnquiry(null)}
          title="Complete Service Payment"
        >
          <form onSubmit={handleConfirmPayment} className="space-y-4">
            <div className="rounded-2xl bg-blue-50/60 p-4 border border-blue-100">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted">Professional</div>
                  <div className="text-sm font-bold text-ink">{actorName(payModalEnquiry, meId)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Category</div>
                  <Badge tone="brand">{payModalEnquiry.serviceCategory}</Badge>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-line p-4 space-y-2 text-xs text-slate-600">
              <div className="flex justify-between font-semibold">
                <span>Quoted Service Amount</span>
                <span className="text-ink font-bold">₹{payModalEnquiry.serviceAmount || payAmount}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Security & Guarantee</span>
                <span className="text-emerald-600 font-bold">Included</span>
              </div>
              <div className="border-t border-line pt-2 flex justify-between text-sm font-black text-ink">
                <span>Total Amount Due</span>
                <span className="text-base text-brand-600">₹{payModalEnquiry.serviceAmount || payAmount}</span>
              </div>
            </div>

            <Field label="Payment Method">
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="upi">Instant UPI (GPay, PhonePe, Paytm)</option>
                <option value="card">Debit / Credit Card</option>
                <option value="netbanking">Net Banking</option>
              </Select>
            </Field>

            {paySuccessMsg && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 font-bold border border-emerald-200">
                {paySuccessMsg}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setPayModalEnquiry(null)}
                disabled={payLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={payLoading || (payModalEnquiry.serviceAmount || payAmount) <= 0}
                className="bg-blue-600 hover:bg-blue-700 font-bold"
              >
                {payLoading ? "Processing Payment..." : `Pay ₹${payModalEnquiry.serviceAmount || payAmount}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Review Modal */}
      {reviewModalEnquiry && (
        <Modal
          open={Boolean(reviewModalEnquiry)}
          onClose={() => !reviewLoading && setReviewModalEnquiry(null)}
          title="Rate & Review Professional"
        >
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <p className="text-xs text-muted">
              Share your experience with <strong>{actorName(reviewModalEnquiry, meId)}</strong> to help other clients hire with confidence.
            </p>

            <Field label="Your Rating">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 text-amber-500 transition hover:scale-110"
                  >
                    <Star
                      size={24}
                      fill={star <= reviewRating ? "currentColor" : "none"}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm font-bold text-ink">{reviewRating} / 5</span>
              </div>
            </Field>

            <Field label="Review Comments">
              <Textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Describe the punctuality, quality of work, and professional behavior..."
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setReviewModalEnquiry(null)}
                disabled={reviewLoading}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={reviewLoading}>
                {reviewLoading ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Dispute Modal */}
      {disputeModalEnquiry && (
        <Modal
          open={Boolean(disputeModalEnquiry)}
          onClose={() => !disputeLoading && setDisputeModalEnquiry(null)}
          title="Report a Problem"
        >
          <form onSubmit={handleSubmitDispute} className="space-y-4">
            <p className="text-xs text-muted">
              Did something go wrong with this job? Describe the issue and our admin operations team will review it.
            </p>

            <Field label="Problem Details">
              <Textarea
                rows={4}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Explain the problem (e.g. work not finished, overcharged, etc.)..."
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setDisputeModalEnquiry(null)}
                disabled={disputeLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="submit"
                disabled={disputeLoading || !disputeReason.trim()}
              >
                {disputeLoading ? "Filing Report..." : "Submit Dispute"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Report a Worker (from worker profile ?report= link) */}
      {reportWorkerId && (
        <Modal
          open={Boolean(reportWorkerId)}
          onClose={() => !reportLoading && setReportWorkerId(null)}
          title="Report this worker"
        >
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <p className="text-xs text-muted">
              Reports are private and reviewed by our trust &amp; safety team. Use this for
              unprofessional behaviour, safety concerns, or suspected fraud.
            </p>

            <Field label="Reason">
              <Select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                required
              >
                <option value="">Select a reason…</option>
                <option value="Unprofessional behaviour">Unprofessional behaviour</option>
                <option value="Safety concern">Safety concern</option>
                <option value="Fraud or scam">Fraud or scam</option>
                <option value="Harassment">Harassment</option>
                <option value="Fake profile or documents">Fake profile or documents</option>
                <option value="Other">Other</option>
              </Select>
            </Field>

            <Field label="Additional details (optional)">
              <Textarea
                rows={4}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Add anything that will help us investigate…"
                maxLength={1500}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setReportWorkerId(null)}
                disabled={reportLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="submit"
                disabled={reportLoading || !reportReason.trim()}
              >
                {reportLoading ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Receipt Modal */}
      <ReceiptModal
        payment={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      {/* Floating AI Assistant for Customer */}
      <FloatingChatButton />
      <ChatPanel />
    </div>
  );
}
