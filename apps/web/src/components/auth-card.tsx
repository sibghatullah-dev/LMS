import Link from 'next/link';

/** Centered card layout shared by all auth screens. */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4 py-12">
      <div className="w-full max-w-md rounded-card border border-neutral-200 bg-surface-0 p-6 sm:p-8">
        <Link
          href="/"
          className="mb-6 block text-caption font-medium uppercase tracking-[0.02em] text-neutral-600"
        >
          Lumora
        </Link>
        <h1 className="mb-6 font-display text-2xl font-semibold text-ink-900">{title}</h1>
        {children}
      </div>
    </main>
  );
}
