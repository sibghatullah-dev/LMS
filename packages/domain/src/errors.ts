/**
 * Domain error hierarchy. Route handlers map these to HTTP status codes at the
 * API boundary (SAD §8: RBAC → 403, validation → 400, etc.) so business logic
 * never imports HTTP concerns.
 */
export type DomainErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, httpStatus: number, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export const ValidationError = (message: string, details?: unknown) =>
  new DomainError('VALIDATION', message, 400, details);

export const UnauthenticatedError = (message = 'Authentication required') =>
  new DomainError('UNAUTHENTICATED', message, 401);

export const ForbiddenError = (message = 'You do not have access to this resource') =>
  new DomainError('FORBIDDEN', message, 403);

export const NotFoundError = (message = 'Resource not found') =>
  new DomainError('NOT_FOUND', message, 404);

export const ConflictError = (message: string) => new DomainError('CONFLICT', message, 409);

export const RateLimitedError = (message = 'Too many requests') =>
  new DomainError('RATE_LIMITED', message, 429);
