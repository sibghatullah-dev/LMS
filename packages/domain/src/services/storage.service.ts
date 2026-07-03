import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '@lumora/config';

/**
 * Object storage adapter (SAD §4.6). Presigned URLs let the browser upload
 * directly to S3/MinIO (keeping large media off the app tier) and let enrolled
 * students stream/download content via short-lived GET URLs fronted by the CDN
 * in production.
 *
 * Configured from env so the same code runs against MinIO locally (path-style)
 * and AWS S3 in the cloud.
 */
let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  const env = loadEnv();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/** Presigned PUT URL for a direct browser upload (default 15-min expiry). */
export async function presignUpload(
  storageKey: string,
  contentType: string,
  expiresIn = 900,
): Promise<string> {
  const { S3_BUCKET } = loadEnv();
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: storageKey, ContentType: contentType }),
    { expiresIn },
  );
}

/** Presigned GET URL for streaming/download (default 1-hour expiry). */
export async function presignDownload(storageKey: string, expiresIn = 3600): Promise<string> {
  const { S3_BUCKET } = loadEnv();
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: S3_BUCKET, Key: storageKey }), {
    expiresIn,
  });
}

/** Namespaced, collision-resistant object key. */
export function buildStorageKey(
  institutionId: string,
  courseId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
  const rand = Math.random().toString(36).slice(2, 10);
  return `institutions/${institutionId}/courses/${courseId}/${Date.now()}-${rand}-${safe}`;
}
