import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type PricingType = "fixed" | "hourly" | "quote";
export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface IPricing {
  type: PricingType;
  amount?: number;
  currency: string;
  note?: string;
}

export interface IAvailability {
  availableNow: boolean;
  days: string[];
  note?: string;
}

export interface IVerificationDoc {
  label: string;
  url: string;
}

export interface IWorkerProfile extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  professionalDescription: string;
  serviceCategories: string[];
  skills: string[];
  experienceYears: number;
  experienceSummary: string;
  serviceAreas: string[];
  pricing: IPricing;
  availability: IAvailability;
  portfolioImages: string[];
  verificationDocuments: IVerificationDoc[];
  verificationStatus: VerificationStatus;
  approvalStatus: ApprovalStatus;
  rejectionReason?: string;
  ratingAverage: number;
  ratingCount: number;
  completedEnquiries: number;
  createdAt: Date;
  updatedAt: Date;
}

const pricingSchema = new Schema<IPricing>(
  {
    type: { type: String, enum: ["fixed", "hourly", "quote"], default: "quote" },
    amount: { type: Number, min: 0 },
    currency: { type: String, default: "INR" },
    note: { type: String, maxlength: 300, default: "" },
  },
  { _id: false },
);

const availabilitySchema = new Schema<IAvailability>(
  {
    availableNow: { type: Boolean, default: true },
    days: { type: [String], default: [] },
    note: { type: String, maxlength: 200, default: "" },
  },
  { _id: false },
);

const verificationDocSchema = new Schema<IVerificationDoc>(
  { label: { type: String, required: true }, url: { type: String, required: true } },
  { _id: false },
);

const workerProfileSchema = new Schema<IWorkerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    professionalDescription: { type: String, default: "", trim: true, maxlength: 1200 },
    serviceCategories: { type: [String], default: [], index: true },
    skills: { type: [String], default: [], index: true },
    experienceYears: { type: Number, default: 0, min: 0, max: 70 },
    experienceSummary: { type: String, default: "", maxlength: 1500 },
    serviceAreas: { type: [String], default: [], index: true },
    pricing: { type: pricingSchema, default: () => ({ type: "quote", currency: "INR" }) },
    availability: {
      type: availabilitySchema,
      default: () => ({ availableNow: true, days: [] }),
    },
    portfolioImages: { type: [String], default: [] },
    verificationDocuments: { type: [verificationDocSchema], default: [] },
    verificationStatus: {
      type: String,
      enum: ["unverified", "pending", "verified", "rejected"],
      default: "unverified",
    },
    approvalStatus: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    rejectionReason: { type: String, default: "", maxlength: 500 },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    completedEnquiries: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Main public-search indexes: approved workers by category and by area.
// Kept as separate compound indexes: MongoDB cannot index two arrays together.
workerProfileSchema.index({ approvalStatus: 1, serviceCategories: 1 });
workerProfileSchema.index({ approvalStatus: 1, serviceAreas: 1 });
workerProfileSchema.index({ approvalStatus: 1, skills: 1 });
workerProfileSchema.index({ professionalDescription: "text", skills: "text", serviceCategories: "text" });

export const WorkerProfile: Model<IWorkerProfile> =
  (mongoose.models.WorkerProfile as Model<IWorkerProfile>) ||
  mongoose.model<IWorkerProfile>("WorkerProfile", workerProfileSchema);

export default WorkerProfile;
