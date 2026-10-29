import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IEvaluationFailedCase {
  prompt: string;
  expectedCategory?: string;
  actualCategory?: string;
  expectedSkills?: string[];
  actualSkills?: string[];
  error?: string;
}

export interface IAiEvaluation {
  _id: Types.ObjectId;
  evaluationId: string;
  datasetName: string;
  datasetVersion: string;
  feature: string;
  provider: string;
  model: string;
  totalCases: number;
  passedCases: number;
  accuracyPercent: number;
  avgDurationMs: number;
  validJsonRatePercent: number;
  failedCases: IEvaluationFailedCase[];
  runBy?: Types.ObjectId;
  createdAt: Date;
}

const failedCaseSchema = new Schema<IEvaluationFailedCase>(
  {
    prompt: { type: String, required: true },
    expectedCategory: { type: String },
    actualCategory: { type: String },
    expectedSkills: { type: [String], default: [] },
    actualSkills: { type: [String], default: [] },
    error: { type: String },
  },
  { _id: false },
);

const aiEvaluationSchema = new Schema<IAiEvaluation>(
  {
    evaluationId: { type: String, required: true, unique: true, index: true },
    datasetName: { type: String, required: true },
    datasetVersion: { type: String, required: true, default: "v1.0" },
    feature: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    totalCases: { type: Number, required: true },
    passedCases: { type: Number, required: true },
    accuracyPercent: { type: Number, required: true },
    avgDurationMs: { type: Number, required: true },
    validJsonRatePercent: { type: Number, required: true, default: 100 },
    failedCases: { type: [failedCaseSchema], default: [] },
    runBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

aiEvaluationSchema.index({ createdAt: -1 });

export const AiEvaluation: Model<IAiEvaluation> =
  (mongoose.models.AiEvaluation as Model<IAiEvaluation>) ||
  mongoose.model<IAiEvaluation>("AiEvaluation", aiEvaluationSchema);

export default AiEvaluation;
