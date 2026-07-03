import { verifyEmail, verifyEmailSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/auth/verify-email (FR-AUTH-01). */
export const POST = defineRoute(
  {
    body: verifyEmailSchema,
    rateLimit: (ip) => ({ key: `verify:${ip}`, limit: 20, windowMs: 60_000 }),
  },
  async ({ body }) => {
    const user = await verifyEmail(body);
    return ok({ user });
  },
);
