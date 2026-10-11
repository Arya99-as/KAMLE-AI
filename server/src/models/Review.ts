import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type ModerationStatus = "pending" | "approved" | "rejected";

export interface IReview extends Document<Types.ObjectId> {
  customerId: Types.ObjectId;
  workerId: Types.ObjectId;
  enquiryId?: Types.ObjectId;
  rating: number;
  comment: string;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    enquiryId: { type: Schema.Types.ObjectId, ref: "Enquiry" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1500 },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

// One review per completed enquiry, and one review per customer/worker pair.
reviewSchema.index({ customerId: 1, workerId: 1 }, { unique: true });
reviewSchema.index({ workerId: 1, moderationStatus: 1, createdAt: -1 });

export const Review: Model<IReview> =
  (mongoose.models.Review as Model<IReview>) || mongoose.model<IReview>("Review", reviewSchema);

export default Review;
