import { z } from 'zod';
import { ENROLLMENT_STATUSES } from '@lumora/config';

/**
 * POST /courses/{courseId}/enrollments.
 * - Empty body → the caller self-enrolls (FR-ENROLL-01/02).
 * - `studentIds` / `studentEmails` present → bulk enroll by staff (FR-ENROLL-03).
 */
export const enrollSchema = z.object({
  studentIds: z.array(z.string()).optional(),
  studentEmails: z.array(z.string().email()).optional(),
});
export type EnrollInput = z.infer<typeof enrollSchema>;

/** Reject a pending enrollment (FR-ENROLL-02). */
export const rejectEnrollmentSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type RejectEnrollmentInput = z.infer<typeof rejectEnrollmentSchema>;

/** Drop/withdraw. A reason is required when staff withdraw a student (FR-ENROLL-05). */
export const dropEnrollmentSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type DropEnrollmentInput = z.infer<typeof dropEnrollmentSchema>;

/** Roster query for a course (instructor/admin). */
export const rosterQuerySchema = z.object({
  status: z.enum(ENROLLMENT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type RosterQueryInput = z.infer<typeof rosterQuerySchema>;

/** A student's own enrollments (FR-ENROLL-04). */
export const myEnrollmentsQuerySchema = z.object({
  status: z.enum(ENROLLMENT_STATUSES).optional(),
});
export type MyEnrollmentsQueryInput = z.infer<typeof myEnrollmentsQuerySchema>;
