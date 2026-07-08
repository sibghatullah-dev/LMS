import Link from 'next/link';

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex justify-center">
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-ink-900 text-base font-semibold text-white">
              L
            </span>
            <span>
              <span className="block text-xl font-semibold text-ink-900">Lumora</span>
              <span className="block text-caption font-semibold uppercase text-neutral-500">
                LMS Operations
              </span>
            </span>
          </span>
        </Link>
        <div className="rounded-lg border border-neutral-200 bg-surface-0 p-6 shadow-sm sm:p-8">
          <p className="mb-2 text-caption font-semibold uppercase text-neutral-500">Secure access</p>
          <h1 className="mb-6 text-2xl font-semibold text-ink-900">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
