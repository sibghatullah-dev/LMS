import { cn } from '@/lib/cn';

/**
 * Signature element (UI/UX §2.1): a SEGMENTED progress ring — one discrete arc
 * per module, not a smooth sweep — so it encodes course *structure* alongside
 * *completion*. Sizes per §2.5: sm 32px (list rows), md 64px (dashboard cards),
 * lg 120px (course header).
 *
 * The one-time fill animation (§2.6) is applied by the consumer via the
 * `animate-ring-fill` class where appropriate; prefers-reduced-motion disables
 * it globally (globals.css). This component is presentational and server-safe.
 */
const SIZES = {
  sm: { px: 32, stroke: 4 },
  md: { px: 64, stroke: 6 },
  lg: { px: 120, stroke: 10 },
} as const;

export interface ProgressRingProps {
  /** Total number of segments (e.g. modules in the course). */
  total: number;
  /** How many segments are complete. */
  completed: number;
  size?: keyof typeof SIZES;
  /** Show the "C/T" label in the center (default on md/lg). */
  showLabel?: boolean;
  className?: string;
}

const TAU = Math.PI * 2;

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** SVG arc path from startAngle to endAngle (radians), clockwise from 12 o'clock. */
function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polar(cx, cy, r, start);
  const e = polar(cx, cy, r, end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

export function ProgressRing({
  total,
  completed,
  size = 'md',
  showLabel,
  className,
}: ProgressRingProps) {
  const { px, stroke } = SIZES[size];
  const safeTotal = Math.max(1, Math.floor(total));
  const safeCompleted = Math.min(safeTotal, Math.max(0, Math.floor(completed)));
  const r = (px - stroke) / 2;
  const cx = px / 2;
  const cy = px / 2;

  // Gap between segments in radians (visually separates arcs); smaller when many.
  const gap = safeTotal > 1 ? Math.min(0.18, 1.2 / safeTotal) : 0;
  const segAngle = TAU / safeTotal;
  const offset = -Math.PI / 2; // start at 12 o'clock

  const segments = Array.from({ length: safeTotal }, (_, i) => {
    const start = offset + i * segAngle + gap / 2;
    const end = offset + (i + 1) * segAngle - gap / 2;
    return { d: arcPath(cx, cy, r, start, end), done: i < safeCompleted };
  });

  const label = `${safeCompleted} of ${safeTotal} modules complete`;
  const withLabel = showLabel ?? size !== 'sm';

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      role="img"
      aria-label={label}
      className={cn('block', className)}
    >
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={seg.done ? 'stroke-accent-progress' : 'stroke-neutral-200'}
        />
      ))}
      {withLabel && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-ink-900 font-mono tabular-nums"
          style={{ fontSize: size === 'lg' ? 22 : 14 }}
        >
          {safeCompleted}/{safeTotal}
        </text>
      )}
    </svg>
  );
}
