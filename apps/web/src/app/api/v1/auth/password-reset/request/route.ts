import { requestPasswordReset, passwordResetRequestSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { getEmailPort } from '@/server/email';
import { ok } from '@/server/respond';
import { isDev } from '@/server/env-helpers';

/** POST /api/v1/auth/password-reset/request (FR-AUTH-05). Always 200 (no enumeration). */
export const POST = defineRoute(
  {
    body: passwordResetRequestSchema,
    rateLimit: (ip) => ({ key: `pwreset:${ip}`, limit: 5, windowMs: 60_000 }),
  },
  async ({ body, ip }) => {
    const { resetToken } = await requestPasswordReset(body, { ip, emailPort: getEmailPort() });
    return ok({ success: true, ...(isDev() && resetToken ? { resetToken } : {}) });
  },
);
