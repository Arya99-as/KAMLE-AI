import AuditLog from "../models/AuditLog.js";
import logger from "../utils/logger.js";

export interface AuditEntry {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/** Records an administrative action for accountability. Never throws to callers. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? "",
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    logger.warn("Failed to write audit log", err);
  }
}

export default recordAudit;
