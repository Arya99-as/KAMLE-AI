import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";
import type { ChatMessage, ExtractedRequirements } from "../types/ai.js";

export interface IChatSession extends Document<Types.ObjectId> {
  customerId?: Types.ObjectId;
  sessionKey: string;
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
    customerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    sessionKey: { type: String, required: true, unique: true, index: true },
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

// Data-retention helper: sessions are cheap to expire after 30 days of inactivity.
chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const ChatSession: Model<IChatSession> =
  (mongoose.models.ChatSession as Model<IChatSession>) ||
  mongoose.model<IChatSession>("ChatSession", chatSessionSchema);

export default ChatSession;
