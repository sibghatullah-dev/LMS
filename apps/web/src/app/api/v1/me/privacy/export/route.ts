import { NextResponse } from 'next/server';
import { exportMyData } from '@lumora/domain';
import { defineRoute } from '@/server/route';

/** GET /api/v1/me/privacy/export (NFR-PRIV-02). */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx }) => {
    const data = await exportMyData(ctx!);
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="lumora-data-export-${ctx!.userId}.json"`,
      },
    });
  },
);
