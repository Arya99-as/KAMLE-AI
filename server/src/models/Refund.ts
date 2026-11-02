import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type RefundStatus = "PENDING" | "PROCESSED" | "FAILED";

export interface IRefund extends Document<Types.ObjectId> {
  paymentId: Types.ObjectId;
  enquiryId: Types.ObjectId;
  customerId: Types.ObjectId;
  workerId: Types.ObjectId;
  amount: number;
  currency: string;
  reason: string;
  razorpayRefundId?: string;
  status: RefundStatus;
  processedBy: Types.ObjectId;
  processedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: "INR" },
    reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    razorpayRefundId: { type: String, index: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    processedAt: { type: Date },
    failureReason: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

refundSchema.index({ customerId: 1, createdAt: -1 });
refundSchema.index({ paymentId: 1, status: 1 });

export const Refund: Model<IRefund> =
  (mongoose.models.Refund as Model<IRefund>) || mongoose.model<IRefund>("Refund", refundSchema);

export default Refund;

