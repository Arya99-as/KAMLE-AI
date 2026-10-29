import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IModelPricing {
  model: string;
  provider: string;
  inputPer1M: number;
  outputPer1M: number;
  effectiveDate: Date;
}

export interface IFeatureConfig {
  enabled: boolean;
  provider?: string;
  model?: string;
  description: string;
}

export interface IAiConfig extends Document<Types.ObjectId> {
  key: string;
  defaultProvider: string;
  defaultModel: string;
  fallbackModels: string[];
  timeoutMs: number;
  retryLimit: number;
  fallbackEnabled: boolean;
  budgets: {
    dailyLimitUsd: number;
    monthlyLimitUsd: number;
    warningThresholdPercent: number;
    actionOnLimit: "warn" | "rate_limit" | "disable_noncritical";
  };
  logging: {
    logMetadata: boolean;
    retentionDays: number;
    retentionLevel: "metadata_only" | "sanitized" | "full";
  };
  features: Record<string, IFeatureConfig>;
  pricing: IModelPricing[];
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const modelPricingSchema = new Schema<IModelPricing>(
  {
    model: { type: String, required: true },
    provider: { type: String, required: true },
    inputPer1M: { type: Number, required: true, default: 0 },
    outputPer1M: { type: Number, required: true, default: 0 },
    effectiveDate: { type: Date, default: Date.now },
  },
  { _id: false },
);

const featureConfigSchema = new Schema<IFeatureConfig>(
  {
    enabled: { type: Boolean, default: true },
    provider: { type: String },
    model: { type: String },
    description: { type: String, default: "" },
  },
  { _id: false },
);

const aiConfigSchema = new Schema<IAiConfig>(
  {
    key: { type: String, default: "global", unique: true, index: true },
    defaultProvider: { type: String, default: "gemini" },
    defaultModel: { type: String, default: "gemini-3.5-flash-lite" },
    fallbackModels: { type: [String], default: ["gemini-flash-lite-latest", "gemini-3.6-flash"] },
    timeoutMs: { type: Number, default: 8000, min: 1000, max: 60000 },
    retryLimit: { type: Number, default: 2, min: 0, max: 5 },
    fallbackEnabled: { type: Boolean, default: true },
    budgets: {
      dailyLimitUsd: { type: Number, default: 10.0, min: 0 },
      monthlyLimitUsd: { type: Number, default: 150.0, min: 0 },
      warningThresholdPercent: { type: Number, default: 80, min: 1, max: 100 },
      actionOnLimit: {
        type: String,
        enum: ["warn", "rate_limit", "disable_noncritical"],
        default: "warn",
      },
    },
    logging: {
      logMetadata: { type: Boolean, default: true },
      retentionDays: { type: Number, default: 30, min: 1, max: 365 },
      retentionLevel: {
        type: String,
        enum: ["metadata_only", "sanitized", "full"],
        default: "sanitized",
      },
    },
    features: {
      type: Map,
      of: featureConfigSchema,
      default: () => ({
        problem_understanding: {
          enabled: true,
          description: "Requirement extraction & problem interpretation from customer chat",
        },
        worker_matching: {
          enabled: true,
          description: "Multi-factor scoring & ranking of available professionals",
        },
        ai_search: {
          enabled: true,
          description: "Smart query parsing & skill mapping for marketplace search",
        },
      }),
    },
    pricing: {
      type: [modelPricingSchema],
      default: () => [
        { model: "gemini-3.5-flash-lite", provider: "gemini", inputPer1M: 0.075, outputPer1M: 0.3, effectiveDate: new Date("2026-01-01") },
        { model: "gemini-flash-lite-latest", provider: "gemini", inputPer1M: 0.075, outputPer1M: 0.3, effectiveDate: new Date("2026-01-01") },
        { model: "gemini-3.6-flash", provider: "gemini", inputPer1M: 0.075, outputPer1M: 0.3, effectiveDate: new Date("2026-01-01") },
        { model: "gpt-4o-mini", provider: "openai", inputPer1M: 0.15, outputPer1M: 0.6, effectiveDate: new Date("2026-01-01") },
        { model: "llama-3.3-70b-versatile", provider: "groq", inputPer1M: 0.59, outputPer1M: 0.79, effectiveDate: new Date("2026-01-01") },
        { model: "llama3.2", provider: "ollama", inputPer1M: 0, outputPer1M: 0, effectiveDate: new Date("2026-01-01") },
        { model: "heuristic", provider: "heuristic", inputPer1M: 0, outputPer1M: 0, effectiveDate: new Date("2026-01-01") },
      ],
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const AiConfig: Model<IAiConfig> =
  (mongoose.models.AiConfig as Model<IAiConfig>) ||
  mongoose.model<IAiConfig>("AiConfig", aiConfigSchema);

export default AiConfig;
