import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface IReport extends Document<Types.ObjectId> {
  reporterId: Types.ObjectId;
  reportedUserId: Types.ObjectId;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, required: true, maxlength: 200 },
    details: { type: String, default: "", maxlength: 1500 },
    status: {
      type: String,
      enum: ["open", "reviewing", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });

export const Report: Model<IReport> =
  (mongoose.models.Report as Model<IReport>) || mongoose.model<IReport>("Report", reportSchema);

export default Report;
