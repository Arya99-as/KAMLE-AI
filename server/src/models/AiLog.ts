import mongoose, { Schema, type Model, type Types } from "mongoose";

export type AiStatus = "SUCCESS" | "FAILED" | "FALLBACK";

export interface IAiLog {
  _id: Types.ObjectId;
  requestId: string;
  correlationId: string;
  feature: string;
  provider: string;
  model: string;
  operation: string;
  status: AiStatus;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensEstimated: boolean;
  estimatedCost: number;
  retryCount: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  errorCategory?: string;
  errorCode?: string;
  errorMessage?: string;
  userId?: Types.ObjectId;
  userRole?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const aiLogSchema = new Schema<IAiLog>(
  {
    requestId: { type: String, required: true, index: true },
    correlationId: { type: String, required: true, index: true },
    feature: { type: String, required: true, index: true },
    provider: { type: String, required: true, index: true },
    model: { type: String, required: true, index: true },
    operation: { type: String, required: true, default: "parse_request" },
    status: { type: String, enum: ["SUCCESS", "FAILED", "FALLBACK"], required: true, index: true },
    durationMs: { type: Number, required: true, min: 0 },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    tokensEstimated: { type: Boolean, default: false },
    estimatedCost: { type: Number, default: 0 },
    retryCount: { type: Number, default: 0 },
    fallbackUsed: { type: Boolean, default: false },
    fallbackReason: { type: String },
    errorCategory: { type: String, index: true },
    errorCode: { type: String },
    errorMessage: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    userRole: { type: String, default: "anonymous" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiLogSchema.index({ createdAt: -1 });
aiLogSchema.index({ feature: 1, createdAt: -1 });
aiLogSchema.index({ status: 1, createdAt: -1 });
aiLogSchema.index({ provider: 1, model: 1 });

export const AiLog: Model<IAiLog> =
  (mongoose.models.AiLog as Model<IAiLog>) ||
  mongoose.model<IAiLog>("AiLog", aiLogSchema);

export default AiLog;
