import { z } from 'zod';

/**
 * Central environment schema for Lumora (SAD §9, plan §4 "Env + config parsing").
 * Parsed once, fail-fast: a missing/invalid variable crashes the process at boot
 * rather than surfacing as a confusing runtime error later.
 *
 * Kept transport-agnostic where possible so local (MinIO/Mailpit) and cloud
 * (S3/Resend) share the same variables (Risk: local↔cloud drift).
 */
const booleanish = z
  .string()
  .transform((v) => v === 'true' || v === '1')
  .pipe(z.boolean());

export const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_BASE_PATH: z.string().startsWith('/').default('/api/v1'),

  // Data
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Auth
  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET must be at least 16 chars'),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),

  // Object storage
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanish.default('true'),

  // Email (O-4: email only for now)
  EMAIL_TRANSPORT: z.enum(['smtp', 'resend']).default('smtp'),
  EMAIL_FROM: z.string().min(1).default('Lumora <no-reply@lumora.local>'),
  SMTP_HOST: z.string().optional().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  RESEND_API_KEY: z.string().optional().default(''),

  // Uploads (NFR-SEC-05)
  MAX_VIDEO_UPLOAD_BYTES: z.coerce.number().int().positive().default(2_147_483_648),
  MAX_FILE_UPLOAD_BYTES: z.coerce.number().int().positive().default(104_857_600),

  // Observability
  SENTRY_DSN: z.string().optional().default(''),

  // Live sessions (Phase 10)
  ZOOM_ACCOUNT_ID: z.string().optional().default(''),
  ZOOM_CLIENT_ID: z.string().optional().default(''),
  ZOOM_CLIENT_SECRET: z.string().optional().default(''),
  MS_TEAMS_CLIENT_ID: z.string().optional().default(''),
  MS_TEAMS_CLIENT_SECRET: z.string().optional().default(''),
  MS_TEAMS_TENANT_ID: z.string().optional().default(''),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Parse and cache process.env against the schema.
 * Throws a readable aggregated error listing every invalid/missing variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only: clear the memoized env so a fresh parse runs. */
export function __resetEnvForTests(): void {
  cached = null;
}
