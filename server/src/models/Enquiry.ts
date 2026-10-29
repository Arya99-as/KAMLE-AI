import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type EnquiryStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTED"
  | "sent"
  | "declined";

export type PaymentStatus = "UNPAID" | "PAID" | "REFUNDED";

export interface IStatusEvent {
  status: EnquiryStatus;
  at: Date;
  by: Types.ObjectId;
  note?: string;
}

export interface IEnquiry extends Document<Types.ObjectId> {
  customerId: Types.ObjectId;
  workerId: Types.ObjectId;
  serviceCategory: string;
  problemDescription: string;
  location: string;
  status: EnquiryStatus;
  serviceAmount?: number;
  paymentStatus: PaymentStatus;
  clientConfirmedAt?: Date;
  disputeReason?: string;
  disputeResolvedAt?: Date;
  scheduledDate?: Date;
  statusHistory: IStatusEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const statusEventSchema = new Schema<IStatusEvent>(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "", maxlength: 500 },
  },
  { _id: false },
);

const enquirySchema = new Schema<IEnquiry>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    serviceCategory: { type: String, required: true, trim: true },
    problemDescription: { type: String, required: true, trim: true, maxlength: 2000 },
    location: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
        "sent",
        "declined",
      ],
      default: "PENDING",
      index: true,
    },
    serviceAmount: { type: Number, min: 0, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PAID", "REFUNDED"],
      default: "UNPAID",
      index: true,
    },
    disputeReason: { type: String, default: "", maxlength: 1000 },
    clientConfirmedAt: { type: Date },
    disputeResolvedAt: { type: Date },
    scheduledDate: { type: Date },
    statusHistory: { type: [statusEventSchema], default: [] },
  },
  { timestamps: true },
);

enquirySchema.index({ customerId: 1, workerId: 1, status: 1 });
enquirySchema.index({ workerId: 1, status: 1, createdAt: -1 });
enquirySchema.index({ status: 1, createdAt: -1 });

export const Enquiry: Model<IEnquiry> =
  (mongoose.models.Enquiry as Model<IEnquiry>) || mongoose.model<IEnquiry>("Enquiry", enquirySchema);

export default Enquiry;
