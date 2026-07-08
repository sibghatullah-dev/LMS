import { recordNativeAttendanceLeave } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/leave — record native attendance leave. */
export const POST = defineRoute(
  { roles: ['student', 'alumnus'] },
  async ({ ctx, params }) => ok(await recordNativeAttendanceLeave(ctx!, params.sessionId!)),
);
