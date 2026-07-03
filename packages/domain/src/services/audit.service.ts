import type { Types } from 'mongoose';
import { AuditLogModel } from '../models/audit-log.model';

/**
 * Append-only audit logging (FR-ADMIN-02, FR-AUTH-09, NFR-PRIV-03).
 *
 * Exposed as a single shared hook so route handlers/services never write to the
 * collection ad hoc (SAD §8). Never throws into the caller's critical path — an
 * audit failure must not fail the underlying action — so errors are swallowed
 * after logging to stderr.
 */
export interface AuditEntry {
  institutionId: string | Types.ObjectId;
  actorId?: string | Types.ObjectId | null;
  actorRole?: string;
  action: string;
  targetEntity?: { type: string; id?: string | Types.ObjectId };
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLogModel.create({
      institutionId: entry.institutionId,
      actorId: entry.actorId ?? undefined,
      actorRole: entry.actorRole,
      action: entry.action,
      targetEntity: entry.targetEntity,
      before: entry.before,
      after: entry.after,
      ipAddress: entry.ipAddress,
    });
  } catch (err) {
    console.error('[audit] failed to write entry', entry.action, err);
  }
}
