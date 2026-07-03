import { lessonProgressSchema, upsertLessonProgress } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** PUT /api/v1/courses/{courseId}/lessons/{lessonId}/progress (FR-CONTENT-03). */
export const PUT = defineRoute(
  {
    roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'],
    body: lessonProgressSchema,
  },
  async ({ ctx, params, body }) =>
    ok(await upsertLessonProgress(ctx!, params.courseId!, params.lessonId!, body)),
);
