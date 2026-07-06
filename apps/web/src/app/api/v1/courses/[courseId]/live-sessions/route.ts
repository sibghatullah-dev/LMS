import { listLiveSessions, liveSessionCreateSchema, scheduleLiveSession } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/live-sessions — list course sessions. */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => ok(await listLiveSessions(ctx!, params.courseId!)),
);

/** POST /api/v1/courses/{courseId}/live-sessions — schedule a session. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: liveSessionCreateSchema },
  async ({ ctx, params, body }) =>
    ok(await scheduleLiveSession(ctx!, params.courseId!, body), 201),
);
