import { NextResponse } from 'next/server';
import { exportCourseReportCsv } from '@lumora/domain';
import { defineRoute } from '@/server/route';

/** GET /api/v1/reports/courses/{courseId}/export?format=csv (FR-DASH-06). */
export const GET = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => {
    const csv = await exportCourseReportCsv(ctx!, params.courseId!);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="course-${params.courseId}-report.csv"`,
      },
    });
  },
);
