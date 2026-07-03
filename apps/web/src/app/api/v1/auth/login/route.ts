import { login, loginSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';
import { setRefreshCookie } from '@/server/cookies';

/** POST /api/v1/auth/login (FR-AUTH-02). Access token in body, refresh in cookie. */
export const POST = defineRoute(
  {
    body: loginSchema,
    rateLimit: (ip) => ({ key: `login:${ip}`, limit: 10, windowMs: 60_000 }),
  },
  async ({ body, ip }) => {
    const { user, accessToken, refreshToken } = await login(body, { ip });
    const res = ok({ user, accessToken });
    setRefreshCookie(res, refreshToken);
    return res;
  },
);
