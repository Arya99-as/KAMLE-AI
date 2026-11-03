import { randomUUID } from "node:crypto";
import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { ChatMessage, ExtractedRequirements } from "../types/ai.js";

export type ChatConversationStatus = "ACTIVE" | "ARCHIVED";

export interface IChatSession extends Document<Types.ObjectId> {
  /** Public, stable conversation identifier. Mirrors sessionKey for legacy rows. */
  conversationId?: string;
  customerId?: Types.ObjectId;
  /** Legacy identifier kept for backward compatibility with existing clients/records. */
  sessionKey: string;
  title: string;
  status: ChatConversationStatus;
  messages: ChatMessage[];
  extractedRequirements: ExtractedRequirements;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<ChatMessage>(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 4000 },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const requirementsSchema = new Schema<ExtractedRequirements>(
  {
    service_category: { type: String, default: null },
    required_skills: { type: [String], default: [] },
    location: { type: String, default: null },
    budget: { type: Number, default: null },
    urgency: { type: String, enum: ["low", "normal", "high", "emergency"], default: "normal" },
    missing_information: { type: [String], default: [] },
    search_ready: { type: Boolean, default: false },
  },
  { _id: false },
);

const chatSessionSchema = new Schema<IChatSession>(
  {
    conversationId: { type: String, index: true, unique: true, sparse: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    sessionKey: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "New conversation", trim: true, maxlength: 120 },
    status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE", index: true },
    messages: { type: [messageSchema], default: [] },
    extractedRequirements: {
      type: requirementsSchema,
      default: () => ({
        service_category: null,
        required_skills: [],
        location: null,
        budget: null,
        urgency: "normal",
        missing_information: [],
        search_ready: false,
      }),
    },
  },
  { timestamps: true },
);

// Every persisted conversation must expose a stable conversationId. Legacy
// documents (created before this field existed) inherit their sessionKey the
// next time they are saved, so no record is lost or rewritten destructively.
chatSessionSchema.pre("validate", function (next) {
  if (!this.sessionKey) this.sessionKey = randomUUID();
  if (!this.conversationId) this.conversationId = this.sessionKey;
  next();
});

// Customer-scoped history listing (most recently updated first).
chatSessionSchema.index({ customerId: 1, status: 1, updatedAt: -1 });

// NOTE: the previous 30-day TTL index was removed deliberately. Conversations
// are user-owned history and must survive logout, re-login and inactivity.
// Retention is now an explicit product decision rather than silent deletion.

export const ChatSession: Model<IChatSession> =
  (mongoose.models.ChatSession as Model<IChatSession>) ||
  mongoose.model<IChatSession>("ChatSession", chatSessionSchema);

export default ChatSession;
