import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type QuotationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "REVISION_REQUESTED"
  | "EXPIRED";

export type QuotationCustomerStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type QuotationActorRole = "worker" | "customer" | "admin" | "system";

export interface IAdditionalCharge {
  description: string;
  amount: number;
}

export interface IQuotationHistoryEvent {
  status: QuotationStatus;
  at: Date;
  by?: Types.ObjectId;
  role: QuotationActorRole;
  note?: string;
}

export interface IQuotation extends Document<Types.ObjectId> {
  enquiryId: Types.ObjectId;
  customerId: Types.ObjectId;
  workerId: Types.ObjectId;
  status: QuotationStatus;

  labourCharges: number;
  materialCharges: number;
  additionalCharges: IAdditionalCharge[];
  /** labour + material + additional charges, always recomputed on the server. */
  subtotal: number;
  /** Approved amount once an admin approves; equals subtotal until then. */
  total: number;

  estimatedCompletionTime: string;
  validUntil: Date;
  notes: string;

  revisionNumber: number;
  history: IQuotationHistoryEvent[];

  approvedAmount?: number;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  adminRemarks: string;
  decidedAt?: Date;

  customerStatus: QuotationCustomerStatus;
  respondedAt?: Date;

  paidAt?: Date;
  paymentId?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const additionalChargeSchema = new Schema<IAdditionalCharge>(
  {
    description: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const historyEventSchema = new Schema<IQuotationHistoryEvent>(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["worker", "customer", "admin", "system"], required: true },
    note: { type: String, default: "", maxlength: 1000 },
  },
  { _id: false },
);

const quotationSchema = new Schema<IQuotation>(
  {
    // One quotation document per enquiry. Revisions update this document and
    // increment revisionNumber, so the approval history stays in one place.
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry", required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REVISION_REQUESTED", "EXPIRED"],
      default: "DRAFT",
      index: true,
    },
    labourCharges: { type: Number, default: 0, min: 0 },
    materialCharges: { type: Number, default: 0, min: 0 },
    additionalCharges: { type: [additionalChargeSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    estimatedCompletionTime: { type: String, default: "", trim: true, maxlength: 120 },
    validUntil: { type: Date, required: true, index: true },
    notes: { type: String, default: "", maxlength: 1000 },
    revisionNumber: { type: Number, default: 1, min: 1 },
    history: { type: [historyEventSchema], default: [] },
    approvedAmount: { type: Number, min: 0 },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    adminRemarks: { type: String, default: "", maxlength: 1000 },
    decidedAt: { type: Date },
    customerStatus: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    respondedAt: { type: Date },
    paidAt: { type: Date },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
  },
  { timestamps: true },
);

quotationSchema.index({ workerId: 1, status: 1, createdAt: -1 });
quotationSchema.index({ customerId: 1, status: 1, createdAt: -1 });
quotationSchema.index({ status: 1, createdAt: -1 });

export const Quotation: Model<IQuotation> =
  (mongoose.models.Quotation as Model<IQuotation>) ||
  mongoose.model<IQuotation>("Quotation", quotationSchema);

export default Quotation;
