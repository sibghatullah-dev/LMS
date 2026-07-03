import { NextResponse, type NextRequest } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import {
  connectToDatabase,
  requireRole,
  type AuthContext,
  type Role,
} from '@lumora/domain';
import { getAuthContext, getClientIp } from './context';
import { enforceRateLimit, type RateLimitOptions } from './rate-limit';
import { toErrorResponse } from './respond';

/**
 * Central API route wrapper (SAD §4.2 cross-cutting middleware): authentication,
 * RBAC authorization, request validation (Zod), rate limiting, DB connection, and
 * uniform error mapping — so no individual handler re-implements them
 * (FR-AUTH-04, NFR-SEC-03/04/07).
 */
interface RouteConfig<B extends ZodTypeAny, Q extends ZodTypeAny> {
  /** Required roles; omit for public endpoints. */
  roles?: readonly Role[];
  /** Validate JSON body against this schema. */
  body?: B;
  /** Validate query string against this schema. */
  query?: Q;
  /** Per-request rate limit; receives the client IP. */
  rateLimit?: (ip: string) => RateLimitOptions;
}

interface Handler<B extends ZodTypeAny, Q extends ZodTypeAny> {
  (args: {
    req: NextRequest;
    ctx: AuthContext | null;
    body: z.infer<B>;
    query: z.infer<Q>;
    params: Record<string, string>;
    ip: string;
  }): Promise<NextResponse>;
}

type RouteContext = { params: Promise<Record<string, string>> };

export function defineRoute<B extends ZodTypeAny = ZodTypeAny, Q extends ZodTypeAny = ZodTypeAny>(
  config: RouteConfig<B, Q>,
  handler: Handler<B, Q>,
) {
  return async (req: NextRequest, routeCtx: RouteContext): Promise<NextResponse> => {
    try {
      const ip = getClientIp(req);
      await connectToDatabase();

      const ctx = await getAuthContext(req);
      if (config.roles) requireRole(ctx, config.roles);
      if (config.rateLimit) {
        enforceRateLimit(config.rateLimit(ip));
      } else if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const subject = ctx?.userId ?? ip;
        enforceRateLimit({ key: `write:${req.method}:${subject}`, limit: 120, windowMs: 60_000 });
      }

      let body = undefined as z.infer<B>;
      if (config.body) {
        const raw = await req.json().catch(() => ({}));
        body = config.body.parse(raw);
      }

      let query = undefined as z.infer<Q>;
      if (config.query) {
        query = config.query.parse(Object.fromEntries(req.nextUrl.searchParams));
      }

      const params = (await routeCtx?.params) ?? {};
      return await handler({ req, ctx, body, query, params, ip });
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
