import { confirmPasswordReset, passwordResetConfirmSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/auth/password-reset/confirm (FR-AUTH-05). */
export const POST = defineRoute(
  {
    body: passwordResetConfirmSchema,
    rateLimit: (ip) => ({ key: `pwconfirm:${ip}`, limit: 10, windowMs: 60_000 }),
  },
  async ({ body }) => {
    await confirmPasswordReset(body);
    return ok({ success: true });
  },
);
