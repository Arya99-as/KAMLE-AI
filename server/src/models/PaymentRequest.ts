import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type PaymentRequestStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED"
  | "CUSTOMER_PAYMENT_REQUESTED";

export type CustomerPaymentLifecycleStatus =
  | "NOT_INITIATED"
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "DISPUTED";

export type WorkerPayoutLifecycleStatus =
  | "NOT_ELIGIBLE"
  | "ELIGIBLE"
  | "PENDING_ADMIN_APPROVAL"
  | "APPROVED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REVERSED";

export interface IPaymentRequestHistory {
  status: string;
  at: Date;
  by: Types.ObjectId;
  role: "worker" | "customer" | "admin" | "system";
  note?: string;
}

export interface IPaymentRequest extends Document<Types.ObjectId> {
  enquiryId: Types.ObjectId;
  quotationId?: Types.ObjectId;
  workerId: Types.ObjectId;
  customerId: Types.ObjectId;
  serviceCategory: string;

  /** Agreed quotation amount (or agreed completed amount). Strictly immutable by worker. */
  amount: number;
  agreedAmount: number;
  currency: string;

  /** Worker submission details */
  completionNotes: string;
  completionEvidence: string[]; // URLs or paths to uploaded work photographs

  /** Admin review workflow */
  status: PaymentRequestStatus;
  adminRemarks?: string;
  decidedBy?: Types.ObjectId;
  decidedAt?: Date;

  /** Customer payment tracking */
  customerPaymentStatus: CustomerPaymentLifecycleStatus;
  paymentId?: Types.ObjectId;
  paidAt?: Date;

  /** Commission and payout breakdown */
  commissionPercent: number;
  commissionAmount: number;
  workerPayableAmount: number;

  /** Worker payout tracking */
  payoutStatus: WorkerPayoutLifecycleStatus;
  payoutId?: Types.ObjectId;
  payoutApprovedBy?: Types.ObjectId;
  payoutApprovedAt?: Date;
  payoutPaidAt?: Date;
  providerPayoutRef?: string;

  history: IPaymentRequestHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const historySchema = new Schema<IPaymentRequestHistory>(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["worker", "customer", "admin", "system"], required: true },
    note: { type: String, default: "", maxlength: 1000 },
  },
  { _id: false },
);

const paymentRequestSchema = new Schema<IPaymentRequest>(
  {
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry", required: true, index: true },
    quotationId: { type: Schema.Types.ObjectId, ref: "Quotation", index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    serviceCategory: { type: String, required: true, trim: true },

    amount: { type: Number, required: true, min: 1 },
    agreedAmount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },

    completionNotes: { type: String, default: "", trim: true, maxlength: 2000 },
    completionEvidence: { type: [String], default: [] },

    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "REVISION_REQUESTED",
        "CUSTOMER_PAYMENT_REQUESTED",
      ],
      default: "SUBMITTED",
      index: true,
    },
    adminRemarks: { type: String, default: "", maxlength: 1000 },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User" },
    decidedAt: { type: Date },

    customerPaymentStatus: {
      type: String,
      enum: [
        "NOT_INITIATED",
        "PENDING",
        "PROCESSING",
        "PAID",
        "FAILED",
        "REFUND_PENDING",
        "REFUNDED",
        "DISPUTED",
      ],
      default: "NOT_INITIATED",
      index: true,
    },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    paidAt: { type: Date },

    commissionPercent: { type: Number, required: true, min: 0, max: 100, default: 10 },
    commissionAmount: { type: Number, required: true, min: 0 },
    workerPayableAmount: { type: Number, required: true, min: 0 },

    payoutStatus: {
      type: String,
      enum: [
        "NOT_ELIGIBLE",
        "ELIGIBLE",
        "PENDING_ADMIN_APPROVAL",
        "APPROVED",
        "PROCESSING",
        "PAID",
        "FAILED",
        "REVERSED",
      ],
      default: "NOT_ELIGIBLE",
      index: true,
    },
    payoutId: { type: Schema.Types.ObjectId, ref: "Payout" },
    payoutApprovedBy: { type: Schema.Types.ObjectId, ref: "User" },
    payoutApprovedAt: { type: Date },
    payoutPaidAt: { type: Date },
    providerPayoutRef: { type: String, default: "" },

    history: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

paymentRequestSchema.index({ workerId: 1, status: 1, createdAt: -1 });
paymentRequestSchema.index({ customerId: 1, customerPaymentStatus: 1, createdAt: -1 });
paymentRequestSchema.index({ status: 1, createdAt: -1 });

export const PaymentRequest: Model<IPaymentRequest> =
  (mongoose.models.PaymentRequest as Model<IPaymentRequest>) ||
  mongoose.model<IPaymentRequest>("PaymentRequest", paymentRequestSchema);

export default PaymentRequest;
