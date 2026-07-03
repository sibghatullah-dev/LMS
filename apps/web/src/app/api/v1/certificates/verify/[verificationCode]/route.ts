import { verifyCertificate } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/certificates/verify/{verificationCode} (public, FR-CERT-02). */
export const GET = defineRoute({}, async ({ params }) =>
  ok(await verifyCertificate(params.verificationCode!)),
);
