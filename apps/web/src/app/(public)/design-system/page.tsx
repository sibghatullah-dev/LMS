import type { Metadata } from 'next';
import { BadgeChip, ProgressRing, StatusChip } from '@/components/ui';
import { DesignSystemInteractive } from './interactive';

export const metadata: Metadata = { title: 'Design System · Lumora' };

/**
 * Phase 0 verification surface (plan §5, Phase 0 acceptance): renders every
 * design-system primitive so the tokens, typography, and components can be
 * eyeballed and axe-checked. Static parts are a Server Component; interactive
 * demos (Button clicks → Toast, DataTable selection) are isolated in a Client
 * Component.
 */
export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-content px-6 py-12">
      <header className="mb-10">
        <span className="text-caption font-medium uppercase tracking-[0.02em] text-neutral-600">
          Lumora
        </span>
        <h1 className="font-display text-3xl font-bold text-ink-900">Design System</h1>
        <p className="mt-2 text-base text-neutral-600">
          UI/UX Design Specification §2 — tokens and core components.
        </p>
      </header>

      <Section title="Typography (§2.3)">
        <div className="space-y-2">
          <p className="font-display text-3xl font-bold">Space Grotesk 40/700 — Display H1</p>
          <p className="font-sans text-base">Inter 16/400 — body copy and UI.</p>
          <p className="font-mono text-base tabular-nums">IBM Plex Mono — 92.5% · 12:04 / 18:30</p>
        </div>
      </Section>

      <Section title="Color palette (§2.2)">
        <div className="flex flex-wrap gap-4">
          <Swatch name="ink-900" className="bg-ink-900 text-surface-0" />
          <Swatch name="paper-50" className="bg-paper-50 text-ink-900 border border-neutral-200" />
          <Swatch name="accent-progress" className="bg-accent-progress text-ink-900" />
          <Swatch name="accent-live" className="bg-accent-live text-surface-0" />
          <Swatch name="accent-alert" className="bg-accent-alert text-surface-0" />
          <Swatch name="neutral-600" className="bg-neutral-600 text-surface-0" />
        </div>
      </Section>

      <Section title="Progress Ring — signature element (§2.1, §2.5)">
        <div className="flex items-end gap-8">
          <div className="flex flex-col items-center gap-2">
            <ProgressRing total={5} completed={3} size="lg" />
            <span className="text-caption text-neutral-600">lg / 120px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProgressRing total={4} completed={2} size="md" />
            <span className="text-caption text-neutral-600">md / 64px</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProgressRing total={6} completed={5} size="sm" />
            <span className="text-caption text-neutral-600">sm / 32px</span>
          </div>
        </div>
      </Section>

      <Section title="Status Chips (§2.5)">
        <div className="flex flex-wrap gap-3">
          <StatusChip label="Draft" tone="neutral" />
          <StatusChip label="Pending review" tone="progress" />
          <StatusChip label="Published" tone="live" />
          <StatusChip label="Overdue" tone="alert" />
        </div>
      </Section>

      <Section title="Badge Chips — gamification only (§2.5)">
        <div className="flex flex-wrap gap-3">
          <BadgeChip label="On-Time Streak (5)" />
          <BadgeChip label="Course Complete" icon="🎓" />
        </div>
      </Section>

      <DesignSystemInteractive />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 font-display text-xl font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div
      className={`flex h-20 w-32 items-end rounded-card p-2 text-caption font-medium ${className}`}
    >
      {name}
    </div>
  );
}
