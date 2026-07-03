import { z } from 'zod';
import { queryAuditLogs } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

const auditQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /api/v1/admin/audit-logs (FR-ADMIN-03) — filterable, institution-scoped. */
export const GET = defineRoute(
  { roles: ['admin', 'super_admin'], query: auditQuerySchema },
  async ({ ctx, query }) => ok(await queryAuditLogs(ctx!, query)),
);
