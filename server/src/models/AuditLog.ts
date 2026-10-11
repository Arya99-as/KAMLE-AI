import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface IAuditLog extends Document<Types.ObjectId> {
  adminId: Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, maxlength: 120 },
    targetType: { type: String, required: true, maxlength: 60 },
    targetId: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;
