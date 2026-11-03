import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  getCustomerPendingPaymentRequests,
  createPaymentOrder,
  verifyPayment,
  type PaymentRequest,
} from "../../services/api";
import { Button, Modal, Spinner } from "../ui/primitives";

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

interface Props {
  onPaymentSuccess?: () => void;
}

export default function CustomerPendingPayments({ onPaymentSuccess }: Props) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<{
    request: PaymentRequest;
    paymentId: string;
    orderId: string;
    amount: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await getCustomerPendingPaymentRequests();
      setRequests(res.requests || []);
    } catch (err: unknown) {
      console.error("Failed to load customer pending payments", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handlePayNow = async (req: PaymentRequest) => {
    const enquiryId = typeof req.enquiryId === "object" ? req.enquiryId._id : req.enquiryId;
    if (!enquiryId) return;

    try {
      setPayingId(req._id);
      setErrorMsg(null);

      // 1. Load Razorpay SDK
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        throw new Error("Failed to load Razorpay payment gateway. Please check your internet connection.");
      }

      // 2. Create Order on Backend
      const orderRes = await createPaymentOrder(enquiryId);
      const order = orderRes.order;

      // 3. Launch Razorpay Checkout
      const options = {
        key: order.keyId || "rzp_test_mock",
        amount: Math.round(order.amount * 100),
        currency: order.currency || "INR",
        name: "KAMLE AI Services",
        description: `Payment for booking #${enquiryId.substring(0, 8)}`,
        order_id: order.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 4. Verify signature on backend
            await verifyPayment({
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              transactionRef: order.transactionRef,
              paymentMethod: "razorpay_checkout",
            });

            setSuccessReceipt({
              request: req,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: order.amount,
            });

            loadRequests();
            if (onPaymentSuccess) onPaymentSuccess();
          } catch (verifyErr: unknown) {
            const msg = verifyErr instanceof Error ? verifyErr.message : "Payment verification failed";
            setErrorMsg(msg);
          }
        },
        theme: {
          color: "#2563eb",
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.on("payment.failed", (resp: any) => {
        setErrorMsg(`Payment failed: ${resp.error?.description || "Transaction declined"}`);
      });
      razorpay.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to initiate payment";
      setErrorMsg(msg);
    } finally {
      setPayingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-line">
        <Spinner />
        <p className="text-xs text-muted mt-2">Checking for pending payments...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return null; // When no pending payments, don't show an intrusive block
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-blue-500/30 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
            </span>
            <h3 className="font-black text-ink text-base flex items-center gap-2">
              <CreditCard className="text-blue-600" size={18} />
              Pending Payment Requests From Admin ({requests.length})
            </h3>
          </div>
          <Button variant="secondary" size="sm" onClick={loadRequests}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        <p className="text-xs text-slate-600 mb-4">
          The service worker has marked work as complete and Admin has reviewed and authorized the quotation amount. Please review and complete your payment via Razorpay.
        </p>

        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((req) => {
            const worker = typeof req.workerId === "object" ? req.workerId : { name: "Assigned Worker" };
            const enquiry = typeof req.enquiryId === "object" ? req.enquiryId : null;
            const isPaying = payingId === req._id;

            return (
              <div
                key={req._id}
                className="bg-white rounded-xl p-4 border border-blue-200 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink text-sm">
                      {enquiry?.serviceCategory || "Completed Service"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      Payment Requested
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <div>
                      Worker: <span className="font-semibold text-ink">{worker.name}</span>
                    </div>
                    {req.completionNotes && (
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-line text-[11px] text-slate-700">
                        <span className="font-bold block text-slate-900">Worker Notes:</span>
                        {req.completionNotes}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-line flex items-baseline justify-between">
                    <span className="text-xs text-muted">Approved Total:</span>
                    <span className="text-xl font-black text-ink">
                      ₹{req.agreedAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-2">
                  <Button
                    onClick={() => handlePayNow(req)}
                    disabled={isPaying}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    {isPaying ? <Spinner /> : <Zap size={14} />}
                    PAY NOW ₹{req.agreedAmount}
                  </Button>
                  <p className="text-[10px] text-center text-muted mt-1.5 flex items-center justify-center gap-1">
                    <Lock size={10} /> Secure checkout via Razorpay • 100% payment protection
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Success Receipt Modal */}
      <Modal
        open={!!successReceipt}
        onClose={() => setSuccessReceipt(null)}
        title="Payment Successful!"
      >
        {successReceipt && (
          <div className="space-y-4 text-xs text-center py-2">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={28} />
            </div>

            <div>
              <h4 className="text-base font-black text-ink">₹{successReceipt.amount.toLocaleString("en-IN")}</h4>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">Verified & Paid Successfully</p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-line rounded-xl text-left space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">Payment ID:</span>
                <span className="font-bold text-slate-800">{successReceipt.paymentId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Order ID:</span>
                <span className="text-slate-800">{successReceipt.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Booking:</span>
                <span className="text-slate-800">
                  {typeof successReceipt.request.enquiryId === "object"
                    ? successReceipt.request.enquiryId._id
                    : successReceipt.request.enquiryId}
                </span>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <Button
                variant="primary"
                onClick={() => setSuccessReceipt(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
