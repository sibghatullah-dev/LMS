'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, StatusChip, toneForStatus, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { CourseCard } from '@/lib/course-types';

interface MyEnrollment {
  id: string;
  status: string;
  course: CourseCard | null;
}

export default function MyCoursesPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch<{ enrollments: MyEnrollment[] }>('/me/enrollments');
    setEnrollments(data.enrollments);
    setLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const withdraw = async (id: string) => {
    await authedFetch(`/enrollments/${id}/drop`, { method: 'POST', body: {} });
    toast('Withdrawn', 'alert');
    void load();
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-content px-6 py-10">
        <h1 className="mb-6 font-display text-2xl font-semibold text-ink-900">My Courses</h1>
        {loading ? (
          <p className="text-neutral-600">Loading…</p>
        ) : enrollments.length === 0 ? (
          <p className="text-neutral-600">
            You are not enrolled in any courses yet. Browse the catalog to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {enrollments.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-card border border-neutral-200 bg-surface-0 p-4"
              >
                <div>
                  <p className="font-display text-lg font-semibold text-ink-900">
                    {e.course?.title ?? 'Course'}
                  </p>
                  <p className="font-mono text-caption tabular-nums text-neutral-600">
                    {e.course?.moduleCount ?? 0} modules · {e.course?.lessonCount ?? 0} lessons
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusChip label={e.status.replace('_', ' ')} tone={toneForStatus(e.status)} />
                  {(e.status === 'active' || e.status === 'completed') && e.course && (
                    <Link
                      href={`/learn/${e.course.id}`}
                      className="rounded-card bg-ink-900 px-3 py-1.5 text-sm font-medium text-surface-0"
                    >
                      Open
                    </Link>
                  )}
                  {(e.status === 'active' || e.status === 'pending_approval') && (
                    <Button size="sm" variant="secondary" onClick={() => withdraw(e.id)}>
                      Withdraw
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Toaster />
    </AppShell>
  );
}
