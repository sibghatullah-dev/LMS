import { listSessionAttendance } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/live-sessions/{sessionId}/attendance — instructor/admin attendance list. */
export const GET = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await listSessionAttendance(ctx!, params.sessionId!)),
);
