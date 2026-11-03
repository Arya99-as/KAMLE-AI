import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface ICategoryCommission {
  categoryName: string;
  commissionPercent: number;
}

export interface IPlatformConfig extends Document<Types.ObjectId> {
  key: string;
  commissionPercent: number;
  categoryCommissions: ICategoryCommission[];
  routeEnabled: boolean;
  payoutTerms: string;
  effectiveDate: Date;
  calculationMethod: "percentage" | "fixed_plus_percentage";
  gatewayFeeBorneBy: "platform" | "customer" | "worker";
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const categoryCommissionSchema = new Schema<ICategoryCommission>(
  {
    categoryName: { type: String, required: true, trim: true },
    commissionPercent: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false },
);

const platformConfigSchema = new Schema<IPlatformConfig>(
  {
    key: { type: String, default: "global", unique: true, index: true },
    commissionPercent: { type: Number, default: 10, min: 0, max: 100 },
    categoryCommissions: { type: [categoryCommissionSchema], default: [] },
    routeEnabled: { type: Boolean, default: false },
    payoutTerms: { type: String, default: "Standard net-7 payout schedule upon job verification." },
    effectiveDate: { type: Date, default: Date.now },
    calculationMethod: { type: String, enum: ["percentage", "fixed_plus_percentage"], default: "percentage" },
    gatewayFeeBorneBy: { type: String, enum: ["platform", "customer", "worker"], default: "platform" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PlatformConfig: Model<IPlatformConfig> =
  (mongoose.models.PlatformConfig as Model<IPlatformConfig>) ||
  mongoose.model<IPlatformConfig>("PlatformConfig", platformConfigSchema);

export default PlatformConfig;
