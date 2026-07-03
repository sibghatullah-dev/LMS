import { register, registerSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { getEmailPort } from '@/server/email';
import { ok } from '@/server/respond';
import { isDev } from '@/server/env-helpers';

/** POST /api/v1/auth/register (FR-AUTH-01). */
export const POST = defineRoute(
  {
    body: registerSchema,
    rateLimit: (ip) => ({ key: `register:${ip}`, limit: 10, windowMs: 60_000 }),
  },
  async ({ body, ip }) => {
    const { user, verificationToken } = await register(body, { ip, emailPort: getEmailPort() });
    // In non-production, surface the verification token so the flow is testable
    // without a mail server. Never returned in production.
    return ok({ user, ...(isDev() ? { verificationToken } : {}) }, 201);
  },
);
