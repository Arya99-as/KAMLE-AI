import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IServiceCategory extends Document<Types.ObjectId> {
  name: string;
  slug: string;
  description: string;
  icon: string;
  keywords: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const serviceCategorySchema = new Schema<IServiceCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    description: { type: String, default: "", maxlength: 400 },
    icon: { type: String, default: "wrench" },
    keywords: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

serviceCategorySchema.index({ isActive: 1, sortOrder: 1 });

export const ServiceCategory: Model<IServiceCategory> =
  (mongoose.models.ServiceCategory as Model<IServiceCategory>) ||
  mongoose.model<IServiceCategory>("ServiceCategory", serviceCategorySchema);

export default ServiceCategory;
