import type { EnrollmentStatus } from '@lumora/config';
import { ValidationError } from '../errors';

/**
 * Enrollment status state machine (DDD §3.4, FR-ENROLL).
 *
 *   (new) ──open──▶ active
 *   (new) ──approval_required──▶ pending_approval ──approve──▶ active
 *                                     └──────reject──────▶ rejected
 *   active ──drop──▶ dropped
 *   active ──complete──▶ completed   (set by grading/certification, Phase 5/8)
 */
const TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  pending_approval: ['active', 'rejected', 'dropped'],
  active: ['completed', 'dropped'],
  completed: [],
  dropped: [],
  rejected: [],
};

export function canEnrollmentTransition(from: EnrollmentStatus, to: EnrollmentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertEnrollmentTransition(from: EnrollmentStatus, to: EnrollmentStatus): void {
  if (!canEnrollmentTransition(from, to)) {
    throw ValidationError(`Enrollment cannot move from "${from}" to "${to}".`);
  }
}
