import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IPlatformConfig extends Document<Types.ObjectId> {
  key: string;
  commissionPercent: number;
  payoutTerms: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const platformConfigSchema = new Schema<IPlatformConfig>(
  {
    key: { type: String, default: "global", unique: true, index: true },
    commissionPercent: { type: Number, default: 10, min: 0, max: 100 },
    payoutTerms: { type: String, default: "Standard net-7 payout schedule upon job verification." },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const PlatformConfig: Model<IPlatformConfig> =
  (mongoose.models.PlatformConfig as Model<IPlatformConfig>) ||
  mongoose.model<IPlatformConfig>("PlatformConfig", platformConfigSchema);

export default PlatformConfig;
