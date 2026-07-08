'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { Course, CourseCard } from '@/lib/course-types';

export default function AdminCoursesPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [pending, setPending] = useState<CourseCard[]>([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch<{ courses: CourseCard[] }>('/admin/courses/pending-review');
    setPending(data.courses);
    setLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (id: string) => {
    setComment('');
    setSelected(await authedFetch<Course>(`/courses/${id}`));
  };

  const approve = async () => {
    if (!selected) return;
    await authedFetch(`/admin/courses/${selected.id}/approve`, { method: 'POST' });
    toast('Published', 'live');
    setSelected(null);
    void load();
  };

  const reject = async () => {
    if (!selected || !comment.trim()) return;
    await authedFetch(`/admin/courses/${selected.id}/reject`, {
      method: 'POST',
      body: { comment },
    });
    toast('Returned to instructor', 'alert');
    setSelected(null);
    void load();
  };

  return (
    <AppShell allow={['admin', 'super_admin']}>
      <main className="mx-auto grid max-w-content gap-5 px-4 py-6 sm:px-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="mb-5">
            <p className="text-caption font-semibold uppercase text-neutral-500">Governance workflow</p>
            <h1 className="text-2xl font-semibold text-ink-900">Pending Course Approvals</h1>
            <p className="text-sm text-neutral-600">{pending.length} courses awaiting content review.</p>
          </div>
          {loading ? (
            <div className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-surface-0" />
          ) : pending.length === 0 ? (
            <p className="rounded-lg border border-neutral-200 bg-surface-0 p-5 text-neutral-600">
              Nothing awaiting review.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((c) => (
                <li
                  key={c.id}
                  className="grid gap-3 rounded-lg border border-neutral-200 bg-surface-0 p-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-semibold text-ink-900">{c.title}</p>
                    <p className="text-caption font-semibold uppercase text-neutral-500">
                      {c.moduleCount} modules · {c.lessonCount} lessons
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => review(c.id)}>
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          {selected ? (
            <div className="rounded-lg border border-neutral-200 bg-surface-0">
              <div className="border-b border-neutral-200 px-5 py-4">
                <h2 className="text-xl font-semibold text-ink-900">{selected.title}</h2>
                <p className="text-sm text-neutral-600">Read-only structure preview</p>
              </div>

              <div className="m-5 max-h-[520px] overflow-y-auto rounded-md border border-neutral-200 bg-paper-50 p-3">
                {selected.modules.map((m, mi) => (
                  <div key={m.id ?? mi} className="mb-3 rounded-md bg-white p-3 last:mb-0">
                    <p className="font-semibold text-ink-900">
                      {mi + 1}. {m.title}
                    </p>
                    <ul className="ml-4 list-disc text-sm text-neutral-600">
                      {m.lessons.map((l, li) => (
                        <li key={l.id ?? li}>
                          {l.title}{' '}
                          <span className="text-caption font-semibold">({l.contentItems.length})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-neutral-200 p-5">
                <Button onClick={approve}>Approve &amp; publish</Button>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reject-comment" className="text-sm font-semibold text-ink-900">
                    Rejection comment (required to reject)
                  </label>
                  <textarea
                    id="reject-comment"
                    rows={2}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="rounded-md border border-neutral-200 p-2 text-sm"
                    placeholder="What needs to change before this can be published?"
                  />
                  <Button variant="destructive" disabled={!comment.trim()} onClick={reject}>
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-neutral-200 bg-surface-0 p-5 text-neutral-600">
              Select a course to review its structure.
            </p>
          )}
        </section>
      </main>
      <Toaster />
    </AppShell>
  );
}
