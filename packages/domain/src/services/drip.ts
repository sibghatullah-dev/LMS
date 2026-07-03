/**
 * Drip-release evaluation (FR-COURSE-06). A module is gated by its `releaseRule`:
 *   immediate               → always available
 *   fixed_date              → available on/after `date`
 *   offset_from_enrollment  → available `offsetDays` after the student enrolled
 *
 * Staff (instructor/admin) previewing a course bypass all gates.
 */
export interface ReleaseRuleLike {
  type?: string;
  date?: Date | null;
  offsetDays?: number | null;
}

export interface LockState {
  locked: boolean;
  releaseAt?: Date;
}

export function computeModuleLock(
  releaseRule: ReleaseRuleLike | null | undefined,
  enrolledAt: Date | undefined,
  now: Date = new Date(),
  isStaff = false,
): LockState {
  if (isStaff) return { locked: false };
  const type = releaseRule?.type ?? 'immediate';

  if (type === 'fixed_date' && releaseRule?.date) {
    const releaseAt = new Date(releaseRule.date);
    return { locked: now < releaseAt, releaseAt };
  }
  if (type === 'offset_from_enrollment' && (releaseRule?.offsetDays ?? 0) > 0) {
    const base = enrolledAt ?? now;
    const releaseAt = new Date(base.getTime() + (releaseRule!.offsetDays ?? 0) * 86_400_000);
    return { locked: now < releaseAt, releaseAt };
  }
  return { locked: false };
}
