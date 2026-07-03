import type { CourseStatus } from '@lumora/config';
import { ValidationError } from '../errors';

/**
 * Course status state machine (DDD §3.3, UC-03, FR-COURSE-07/08/10).
 *
 *   draft ──submit──▶ pending_review ──approve──▶ published ──archive──▶ archived
 *     ▲                     │                         │
 *     └──────reject─────────┘                         └──archive──▶ archived
 *
 * Reject returns a course to `draft` (with a reviewComment) rather than a terminal
 * `rejected` state, so the instructor can revise and resubmit (UC-03).
 */
const TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['published', 'draft'],
  published: ['archived'],
  rejected: ['pending_review'],
  archived: [],
};

export function canTransition(from: CourseStatus, to: CourseStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: CourseStatus, to: CourseStatus): void {
  if (!canTransition(from, to)) {
    throw ValidationError(`A course cannot move from "${from}" to "${to}".`);
  }
}
