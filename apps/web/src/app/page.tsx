import Link from 'next/link';

/**
 * Phase 0 landing / themed shell. Real public catalog lands in Phase 3.
 * Serves as a verification surface that fonts, tokens, and routing work.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-content flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-caption font-medium uppercase tracking-[0.02em] text-neutral-600">
          Learning Management System
        </span>
        <h1 className="font-display text-3xl font-bold text-ink-900">Lumora</h1>
        <p className="max-w-xl text-base text-neutral-600">
          Project foundation (Phase 0) is in place: monorepo, design system, and local
          infrastructure. Feature areas are built out in Phases 1–9.
        </p>
      </div>

      <nav className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/design-system"
          className="rounded-card bg-ink-900 px-5 py-2.5 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
        >
          View Design System
        </Link>
        <Link
          href="/dashboard"
          className="rounded-card border border-neutral-200 px-5 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-surface-0"
        >
          Student area (stub)
        </Link>
      </nav>
    </main>
  );
}
