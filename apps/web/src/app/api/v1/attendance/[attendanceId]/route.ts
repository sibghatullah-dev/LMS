import { attendanceOverrideSchema, overrideAttendance } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** PATCH /api/v1/attendance/{attendanceId} — manual attendance override. */
export const PATCH = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: attendanceOverrideSchema },
  async ({ ctx, params, body }) => ok(await overrideAttendance(ctx!, params.attendanceId!, body)),
);
