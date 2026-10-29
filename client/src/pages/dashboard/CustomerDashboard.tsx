import {
  AlertTriangle,
  Check,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  confirmEnquiryCompletion,
  createPaymentOrder,
  createReview,
  getMyPayments,
  listEnquiries,
  listFavorites,
  listMyReviews,
  updateEnquiryStatus,
  verifyPayment,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Enquiry, Payment, Review, UserRef } from "../../types";
import { Badge, Button, Field, Modal, Select, Spinner, StatusBadge, Tabs, Textarea } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";
import { WorkerCard } from "../../components/worker/WorkerCard";
import type { PublicWorker } from "../../types";

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

export default function CustomerDashboard() {
  const { user } = useAuth();

  const [tab, setTab] = useState("Requests");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [favorites, setFavorites] = useState<FavItem[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);

  // Modals
  const [payModalEnquiry, setPayModalEnquiry] = useState<Enquiry | null>(null);
  const [payAmount, setPayAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [payLoading, setPayLoading] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  const [reviewModalEnquiry, setReviewModalEnquiry] = useState<Enquiry | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  const [disputeModalEnquiry, setDisputeModalEnquiry] = useState<Enquiry | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeLoading, setDisputeLoading] = useState(false);

  const meId = user?.id ?? "";

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setRefreshing(true);
    setLoadError(null);
    try {
      const [e, p, f, r] = await Promise.all([
        listEnquiries("sent"),
        getMyPayments().catch(() => ({ success: false, payments: [] })),
        listFavorites(),
        listMyReviews(),
      ]);
      setEnquiries(e.items);
      setPayments(p.payments || []);
      setFavorites(f.items);
      setMyReviews(r.items);
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
        theme: { color: "#2563eb" },
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
      setTimeout(() => {
        setPayModalEnquiry(null);
        setPaySuccessMsg(null);
        void load(false);
      }, 1800);
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

  return (
    <div className="container-x py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Client Dashboard</h1>
          <p className="text-sm text-muted">Manage your service requests, payments, and reviews</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /> Refresh
          </Button>
                    <Link to="/discover">
            <Button variant="primary" size="sm">
              Find Workers
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          tabs={["Requests", "Payments", "Reviews", "Favorites"]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Spinner />
        </div>
      ) : loadError ? (
        <div className="mt-6 rounded-card border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {loadError}
        </div>
      ) : (
        <div className="mt-6">
          {tab === "Requests" && (
            <div>
              {enquiries.length === 0 ? (
                <EmptyState
                  title="No service requests yet"
                  message="When you reach out to a local professional, your request and job progress will show up here."
                  action={
          <Link to="/discover">
                      <Button variant="primary">Find a Worker</Button>
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

                    return (
                      <div key={e._id} className="card p-5 transition hover:border-brand-200">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ink">{actorName(e, meId)}</span>
                              <Badge tone="brand">{e.serviceCategory}</Badge>
                              <StatusBadge status={e.status} />
                              {isPaid && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                  <Check size={12} /> Paid
                                </span>
                              )}
                              {isCompleted && e.clientConfirmedAt && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                                  <Check size={12} /> Completion Confirmed
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-ink">{e.problemDescription}</p>
                            {e.location && <p className="mt-1 text-xs text-muted">📍 {e.location}</p>}
                            {e.serviceAmount ? (
                              <p className="mt-2 text-xs font-semibold text-brand-700">
                                Service Quote / Fee: ₹{e.serviceAmount}
                              </p>
                            ) : null}
                            {isDisputed && e.disputeReason && (
                              <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
                                <strong>Dispute Reason:</strong> {e.disputeReason}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                            {isCompleted && !isPaid && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleInitiatePayment(e)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <CreditCard size={14} /> Pay Now (₹{e.serviceAmount || 0})
                              </Button>
                            )}

                            {isCompleted && !e.clientConfirmedAt && !isDisputed && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleConfirmCompletion(e)}
                              >
                                <Check size={14} /> Confirm Completion
                              </Button>
                            )}

                            {isCompleted && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setReviewModalEnquiry(e)}
                              >
                                <Star size={14} className="text-amber-500" /> Rate & Review
                              </Button>
                            )}

                            {isCompleted && !isDisputed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDisputeModalEnquiry(e)}
                                className="text-xs text-amber-700 hover:bg-amber-50"
                              >
                                <AlertTriangle size={13} /> Report Problem
                              </Button>
                            )}

                            {(isPending || isAccepted) && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCancelRequest(e._id)}
                                className="text-red-600 hover:bg-red-50 hover:border-red-200"
                              >
                                <X size={14} /> Cancel
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

          {tab === "Payments" && (
            <div>
              {payments.length === 0 ? (
                <EmptyState
                  title="No payment history"
                  message="When you complete service requests and pay through the platform, your invoices and receipts will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {payments.map((p) => (
                    <div key={p._id} className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink text-base">₹{p.amount}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            {p.status}
                          </span>
                          <span className="text-xs text-muted">via {p.paymentMethod?.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-muted mt-1 font-mono">Txn Ref: {p.transactionRef}</p>
                        <p className="text-xs text-muted">
                          Date: {new Date(p.createdAt).toLocaleDateString()} at {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs text-brand-700 font-medium">
                          <ShieldCheck size={14} /> Verified Platform Payment
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "Reviews" && (
            <div>
              {myReviews.length === 0 ? (
                <EmptyState
                  title="No reviews submitted"
                  message="After a completed service request, you can leave ratings and feedback to help other clients."
                />
              ) : (
                <div className="space-y-4">
                  {myReviews.map((r, i) => (
                    <div key={r._id || i} className="card p-4">
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star key={idx} size={16} fill={idx < r.rating ? "currentColor" : "none"} />
                        ))}
                        <span className="ml-2 text-xs font-semibold text-ink">{r.rating}.0</span>
                      </div>
                      <p className="mt-2 text-sm text-ink">{r.comment || "(No comment provided)"}</p>
                      <p className="mt-2 text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "Favorites" && (
            <div>
              {favorites.length === 0 ? (
                <EmptyState
                  title="No saved workers"
                  message="Click the heart icon on any worker card to save them for quick access later."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {favorites.map((f) => (
                    <WorkerCard key={f.favoriteId} worker={f.worker} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {payModalEnquiry && (
        <Modal
          open={Boolean(payModalEnquiry)}
          onClose={() => !payLoading && setPayModalEnquiry(null)}
          title="Secure Platform Checkout"
        >
          {paySuccessMsg ? (
            <div className="py-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <Check size={28} />
              </div>
              <h3 className="text-lg font-bold text-ink">Payment Complete!</h3>
              <p className="text-sm text-muted mt-1">{paySuccessMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex justify-between text-sm text-muted mb-1">
                  <span>Professional:</span>
                  <span className="font-semibold text-ink">{actorName(payModalEnquiry, meId)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted mb-1">
                  <span>Service Category:</span>
                  <span className="font-semibold text-ink">{payModalEnquiry.serviceCategory}</span>
                </div>
                <div className="flex justify-between text-sm text-muted mb-2">
                  <span>Platform Commission:</span>
                  <span className="text-xs text-muted">Applied by the server</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-base text-ink">
                  <span>Total Amount:</span>
                  <span className="text-brand-700">₹{payAmount}</span>
                </div>
              </div>

              <Field label="Payment Method">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="upi">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="netbanking">Net Banking</option>
                </Select>
              </Field>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2 border border-blue-200">
                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-blue-600" />
                <span>
                  The amount is fixed by the worker&apos;s completed job total and verified on the server. In development, a clearly-labelled simulated provider is used; production uses the configured payment gateway and webhook verification.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setPayModalEnquiry(null)} disabled={payLoading}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={payLoading || payAmount <= 0}>
                  {payLoading ? "Verifying Payment..." : `Pay ₹${payAmount}`}
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {reviewModalEnquiry && (
        <Modal
          open={Boolean(reviewModalEnquiry)}
          onClose={() => !reviewLoading && setReviewModalEnquiry(null)}
          title={`Review ${actorName(reviewModalEnquiry, meId)}`}
        >
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <Field label="Your Rating">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className="p-1 focus:outline-none transition hover:scale-110"
                  >
                    <Star
                      size={28}
                      className={star <= reviewRating ? "text-amber-500 fill-amber-500" : "text-slate-300"}
                    />
                  </button>
                ))}
                <span className="ml-2 font-bold text-sm text-ink">{reviewRating} of 5 Stars</span>
              </div>
            </Field>

            <Field label="Your Feedback / Comment (Optional)">
              <Textarea
                placeholder="How was the quality of work, punctuality, and professionalism?"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setReviewModalEnquiry(null)} disabled={reviewLoading}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={reviewLoading}>
                {reviewLoading ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {disputeModalEnquiry && (
        <Modal
          open={Boolean(disputeModalEnquiry)}
          onClose={() => !disputeLoading && setDisputeModalEnquiry(null)}
          title="Report a Problem / Open Dispute"
        >
          <form onSubmit={handleSubmitDispute} className="space-y-4">
            <p className="text-xs text-muted">
              If the completed work was unsatisfactory or unfinished, describe what went wrong. The platform admin will review your report and coordinate resolution.
            </p>

            <Field label="Reason / Issue Details">
              <Textarea
                placeholder="Explain the issue with the work or service..."
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={4}
                required
              />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDisputeModalEnquiry(null)} disabled={disputeLoading}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={disputeLoading}>
                {disputeLoading ? "Recording..." : "Log Dispute"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
