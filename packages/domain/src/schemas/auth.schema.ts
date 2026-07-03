import { z } from 'zod';

/**
 * Request validation schemas (SAD §8, NFR-SEC-04). Shared by the API route
 * boundary and the service layer so validation is defined once.
 * Contracts mirror the OpenAPI spec (`/auth/*`).
 */

// Public self-registration allows only student/instructor (API spec enum).
// Admin/Super Admin accounts are created via the admin API or the seed script.
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1).max(200),
  role: z.enum(['student', 'instructor']),
  institutionSlug: z.string().min(1).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  institutionSlug: z.string().min(1).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(1),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
  institutionSlug: z.string().min(1).optional(),
});
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  userId: z.string().min(1),
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
