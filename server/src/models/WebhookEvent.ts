import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IWebhookEvent extends Document<Types.ObjectId> {
  eventId: string;
  eventType: string;
  provider: string;
  processed: boolean;
  processedAt?: Date;
  payload?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    provider: { type: String, default: "razorpay" },
    processed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date },
    payload: { type: Schema.Types.Mixed },
    error: { type: String },
  },
  { timestamps: true },
);

webhookEventSchema.index({ createdAt: -1 });

export const WebhookEvent: Model<IWebhookEvent> =
  (mongoose.models.WebhookEvent as Model<IWebhookEvent>) ||
  mongoose.model<IWebhookEvent>("WebhookEvent", webhookEventSchema);

export default WebhookEvent;

