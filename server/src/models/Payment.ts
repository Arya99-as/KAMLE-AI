import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export interface IPayment extends Document<Types.ObjectId> {
  enquiryId: Types.ObjectId;
  customerId: Types.ObjectId;
  workerId: Types.ObjectId;
  amount: number;
  currency: string;
  commissionPercent: number;
  commissionAmount: number;
  workerPayableAmount: number;
  status: PaymentStatus;
  provider: string;
  transactionRef: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paymentMethod?: string;
  verifiedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    commissionPercent: { type: Number, required: true, min: 0, max: 100, default: 10 },
    commissionAmount: { type: Number, required: true, min: 0 },
    workerPayableAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    provider: { type: String, default: "mock" },
    transactionRef: { type: String, required: true, unique: true, index: true },
    providerOrderId: { type: String, index: true },
    providerPaymentId: { type: String, index: true },
    paymentMethod: { type: String, default: "upi" },
    verifiedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ workerId: 1, createdAt: -1 });
paymentSchema.index({ enquiryId: 1, status: 1 });

export const Payment: Model<IPayment> =
  (mongoose.models.Payment as Model<IPayment>) || mongoose.model<IPayment>("Payment", paymentSchema);

export default Payment;
