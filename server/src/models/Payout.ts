import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type PayoutStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED";

export interface IPayout extends Document<Types.ObjectId> {
  workerId: Types.ObjectId;
  enquiryId: Types.ObjectId;
  paymentId: Types.ObjectId;
  serviceAmount: number;
  commissionAmount: number;
  workerPayableAmount: number;
  status: PayoutStatus;
  providerPayoutRef?: string;
  paidAt?: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry", required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment", required: true, index: true, unique: true },
    serviceAmount: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, required: true, min: 0 },
    workerPayableAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "PAID", "FAILED"],
      default: "PENDING",
      index: true,
    },
    providerPayoutRef: { type: String, default: "" },
    paidAt: { type: Date },
    note: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true },
);

payoutSchema.index({ workerId: 1, status: 1, createdAt: -1 });

export const Payout: Model<IPayout> =
  (mongoose.models.Payout as Model<IPayout>) || mongoose.model<IPayout>("Payout", payoutSchema);

export default Payout;
