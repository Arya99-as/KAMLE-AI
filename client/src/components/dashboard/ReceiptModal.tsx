import { CheckCircle2, Download, Printer, X } from "lucide-react";
import type { Payment } from "../../types";
import { Button } from "../ui/primitives";

interface ReceiptModalProps {
  payment: Payment | null;
  onClose: () => void;
}

export function ReceiptModal({ payment, onClose }: ReceiptModalProps) {
  if (!payment) return null;
  const p = payment;

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    const receiptContent = `
========================================
             KAMLE AI RECEIPT
========================================
Transaction ID : ${p.transactionRef || p._id}
Order ID       : ${p.providerOrderId || "N/A"}
Payment ID     : ${p.providerPaymentId || "N/A"}
Date           : ${new Date(p.createdAt).toLocaleString()}
Status         : ${p.status}
Payment Method : ${(p.paymentMethod || "UPI / Card").toUpperCase()}
----------------------------------------
Service Amount : ₹${p.amount}
Platform Fee   : ₹${p.commissionAmount || 0}
Net Settlement : ₹${p.workerPayableAmount || p.amount}
----------------------------------------
Thank you for using KAMLE AI!
Support: support@kamle.ai | www.kamle.ai
========================================
`;
    const blob = new Blob([receiptContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `receipt-${p.transactionRef || p._id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-line">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-muted hover:bg-slate-100 hover:text-ink transition"
        >
          <X size={18} />
        </button>

        {/* Brand header */}
        <div className="text-center pb-5 border-b border-line">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
            <CheckCircle2 size={28} />
          </div>
          <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Payment Completed
          </span>
          <h3 className="mt-2 text-2xl font-black text-ink">₹{p.amount}</h3>
          <p className="text-xs text-muted mt-1">Official Payment Receipt & Voucher</p>
        </div>

        {/* Details List */}
        <div className="py-5 space-y-3 text-sm">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-muted">Transaction ID</span>
            <span className="font-mono font-semibold text-ink">{p.transactionRef || p._id}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-muted">Payment Method</span>
            <span className="font-semibold text-ink uppercase">{p.paymentMethod || "UPI / Card"}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-muted">Status</span>
            <span className="font-bold text-emerald-600">{p.status}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-muted">Date & Time</span>
            <span className="font-medium text-ink">{new Date(p.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-muted">Order ID</span>
            <span className="font-mono text-xs text-slate-600">{p.providerOrderId || "N/A"}</span>
          </div>
          <div className="flex justify-between py-1 pt-2">
            <span className="font-semibold text-ink">Total Amount Paid</span>
            <span className="font-black text-ink text-base">₹{p.amount}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-line">
          <Button variant="secondary" className="flex-1 gap-2" onClick={handleDownload}>
            <Download size={15} /> Download Text Receipt
          </Button>
          <Button variant="primary" className="flex-1 gap-2" onClick={handlePrint}>
            <Printer size={15} /> Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
