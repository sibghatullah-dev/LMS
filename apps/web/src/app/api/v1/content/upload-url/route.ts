import { createUploadUrl, uploadUrlSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/content/upload-url (FR-CONTENT-02, NFR-SEC-05). */
export const POST = defineRoute(
  {
    roles: ['instructor', 'admin', 'super_admin'],
    body: uploadUrlSchema,
    rateLimit: (ip) => ({ key: `upload:${ip}`, limit: 60, windowMs: 60_000 }),
  },
  async ({ ctx, body }) => ok(await createUploadUrl(ctx!, body)),
);
