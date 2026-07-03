import mongoose, { type FilterQuery } from 'mongoose';
import { AuditLogModel, type AuditLog } from '../models/audit-log.model';

const { Types } = mongoose;
import type { AuthContext } from '../rbac/roles';

export interface AuditQuery {
  from?: Date;
  to?: Date;
  actorId?: string;
  action?: string;
  page: number;
  pageSize: number;
}

/**
 * FR-ADMIN-03 — query the audit log, always scoped to the caller's institution
 * (NFR-PRIV-03). Read-only; the collection is append-only.
 */
export async function queryAuditLogs(ctx: AuthContext, query: AuditQuery) {
  const filter: FilterQuery<AuditLog> = { institutionId: new Types.ObjectId(ctx.institutionId) };
  if (query.actorId) filter.actorId = new Types.ObjectId(query.actorId);
  if (query.action) filter.action = query.action;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }

  const [entries, total] = await Promise.all([
    AuditLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    AuditLogModel.countDocuments(filter),
  ]);

  return { entries, total, page: query.page, pageSize: query.pageSize };
}
