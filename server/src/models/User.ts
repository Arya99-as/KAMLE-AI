import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export type Role = "customer" | "worker" | "admin";
export type AccountStatus = "active" | "suspended" | "deactivated";

export interface IUser extends Document<Types.ObjectId> {
  name: string;
  email?: string;
  phone: string;
  passwordHash: string;
  role: Role;
  accountStatus: AccountStatus;
  avatarUrl?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      match: [/^\+?[0-9\s-]{7,15}$/, "Invalid phone number"],
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "worker", "admin"], default: "customer", index: true },
    accountStatus: {
      type: String,
      enum: ["active", "suspended", "deactivated"],
      default: "active",
      index: true,
    },
    avatarUrl: { type: String, default: "" },
    location: { type: String, default: "", trim: true, maxlength: 120 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, accountStatus: 1 });

export const User: Model<IUser> =
  (mongoose.models.User as Model<IUser>) || mongoose.model<IUser>("User", userSchema);

export default User;
