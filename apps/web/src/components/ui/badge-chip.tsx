import { cn } from '@/lib/cn';

/**
 * Badge Chip (UI/UX §2.5): pill-shaped, accent-progress background, used ONLY
 * for gamification badges — deliberately distinct from the rectangular
 * StatusChip so achievements never read as status.
 */
export interface BadgeChipProps {
  label: string;
  /** Optional leading icon (emoji or small node). */
  icon?: React.ReactNode;
  className?: string;
}

export function BadgeChip({ label, icon = '🏅', className }: BadgeChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-accent-progress px-3 py-1 text-sm font-medium text-ink-900',
        className,
      )}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
