import { cn } from '@/lib/cn';

/**
 * Status Chip (UI/UX §2.5): rectangular, small radius, color-coded by state.
 * Mapping from §2.5:
 *   draft            -> neutral
 *   pending_review   -> accent-progress
 *   published/active -> accent-live
 *   rejected/overdue -> accent-alert
 * Kept rectangular to stay visually distinct from the pill-shaped BadgeChip.
 */
export type StatusTone = 'neutral' | 'progress' | 'live' | 'alert';

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-neutral-200 text-ink-900',
  progress: 'bg-accent-progress/20 text-ink-900',
  live: 'bg-accent-live/15 text-ink-900',
  alert: 'bg-accent-alert/15 text-accent-alert',
};

/** Maps a domain status string to a chip tone (extended as statuses are added). */
export function toneForStatus(status: string): StatusTone {
  switch (status) {
    case 'published':
    case 'active':
    case 'completed':
    case 'live':
      return 'live';
    case 'pending_review':
    case 'pending_approval':
    case 'processing':
      return 'progress';
    case 'rejected':
    case 'overdue':
    case 'cancelled':
    case 'suspended':
      return 'alert';
    default:
      return 'neutral';
  }
}

export interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusChip({ label, tone = 'neutral', className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-caption font-medium uppercase tracking-[0.02em]',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
