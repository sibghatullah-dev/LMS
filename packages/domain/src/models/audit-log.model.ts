import mongoose, { type InferSchemaType, type Model } from 'mongoose';

const { Schema, model, models } = mongoose;

/**
 * `audit_logs` collection (DDD §3.16, FR-ADMIN-02, NFR-PRIV-03).
 * Append-only: the application layer never updates or deletes entries. Records
 * actor, action, target, before/after snapshots, and source IP for sensitive
 * mutations (grades, enrollment, publishing, role changes, account deactivation,
 * and — from Phase 1 — auth events).
 */
const auditLogSchema = new Schema(
  {
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String },
    action: { type: String, required: true },
    targetEntity: {
      type: { type: String },
      id: { type: Schema.Types.ObjectId },
    },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  {
    // Only a creation timestamp — entries are immutable, so no updatedAt.
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'audit_logs',
  },
);

auditLogSchema.index({ institutionId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ 'targetEntity.type': 1, 'targetEntity.id': 1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel: Model<AuditLog> =
  (models.AuditLog as Model<AuditLog>) ?? model<AuditLog>('AuditLog', auditLogSchema);
