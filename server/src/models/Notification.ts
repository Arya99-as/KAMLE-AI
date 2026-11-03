import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type NotificationType =
  | "ENQUIRY"
  | "QUOTATION"
  | "PAYMENT"
  | "BOOKING"
  | "PAYOUT"
  | "SYSTEM"
  | "DISPUTE"
  | "REVIEW";

export type NotificationChannel = "IN_APP" | "WHATSAPP" | "EMAIL" | "SMS";

export type NotificationStatus = "PENDING" | "SENT" | "DELIVERED" | "FAILED" | "READ";

export interface INotification extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  status: NotificationStatus;
  whatsappStatus?: NotificationStatus;
  whatsappMessageId?: string;
  whatsappError?: string;
  readAt?: Date;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["ENQUIRY", "QUOTATION", "PAYMENT", "BOOKING", "PAYOUT", "SYSTEM", "DISPUTE", "REVIEW"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    data: { type: Schema.Types.Mixed },
    channels: { type: [String], enum: ["IN_APP", "WHATSAPP", "EMAIL", "SMS"], default: ["IN_APP"] },
    status: { type: String, enum: ["PENDING", "SENT", "DELIVERED", "FAILED", "READ"], default: "PENDING", index: true },
    whatsappStatus: { type: String, enum: ["PENDING", "SENT", "DELIVERED", "FAILED", "READ"] },
    whatsappMessageId: { type: String },
    whatsappError: { type: String },
    readAt: { type: Date },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  (mongoose.models.Notification as Model<INotification>) || mongoose.model<INotification>("Notification", notificationSchema);

export default Notification;
