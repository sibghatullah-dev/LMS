import { createAnnouncementSchema, createCourseAnnouncement } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/courses/{courseId}/announcements (FR-NOTIFY-05). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: createAnnouncementSchema.omit({ courseId: true }) },
  async ({ ctx, params, body }) =>
    ok(await createCourseAnnouncement(ctx!, { ...body, courseId: params.courseId! }), 201),
);
