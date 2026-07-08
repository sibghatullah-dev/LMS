import { recordNativeAttendanceJoin } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/join — record native attendance join. */
export const POST = defineRoute(
  { roles: ['student', 'alumnus'] },
  async ({ ctx, params }) => ok(await recordNativeAttendanceJoin(ctx!, params.sessionId!)),
);
