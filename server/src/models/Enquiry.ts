import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type EnquiryStatus = "sent" | "accepted" | "declined" | "completed" | "cancelled";

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
  statusHistory: IStatusEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const statusEventSchema = new Schema<IStatusEvent>(
  {
    status: {
      type: String,
      enum: ["sent", "accepted", "declined", "completed", "cancelled"],
      required: true,
    },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "", maxlength: 300 },
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
      enum: ["sent", "accepted", "declined", "completed", "cancelled"],
      default: "sent",
      index: true,
    },
    statusHistory: { type: [statusEventSchema], default: [] },
  },
  { timestamps: true },
);

// Prevent accidental spam: one open enquiry per customer/worker pair.
enquirySchema.index({ customerId: 1, workerId: 1, status: 1 });
enquirySchema.index({ workerId: 1, status: 1, createdAt: -1 });

export const Enquiry: Model<IEnquiry> =
  (mongoose.models.Enquiry as Model<IEnquiry>) || mongoose.model<IEnquiry>("Enquiry", enquirySchema);

export default Enquiry;
