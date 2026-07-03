import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainError } from '@lumora/domain';

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Standard success envelope: the resource is returned directly. */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Standard error envelope (mirrors the OpenAPI `Error` schema). */
export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/**
 * Map any thrown value to an HTTP response. Domain errors carry their status;
 * Zod validation errors become 400; everything else is a masked 500 (never leak
 * internals — NFR-SEC-04).
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    return NextResponse.json<ErrorBody>(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.httpStatus },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json<ErrorBody>(
      { error: { code: 'VALIDATION', message: 'Invalid request.', details: err.flatten() } },
      { status: 400 },
    );
  }
  // MongoDB duplicate-key error (E11000): a check-then-act race lost to a unique
  // index (e.g. two concurrent submissions for the same assessment+student).
  // Without this, a legitimate race surfaces as a masked 500 instead of the
  // intended 409 the same operation would get on the non-racy path.
  if (isDuplicateKeyError(err)) {
    return NextResponse.json<ErrorBody>(
      { error: { code: 'CONFLICT', message: 'This action was already completed.' } },
      { status: 409 },
    );
  }
  console.error('[api] unhandled error', err);
  return NextResponse.json<ErrorBody>(
    { error: { code: 'INTERNAL', message: 'Something went wrong.' } },
    { status: 500 },
  );
}
