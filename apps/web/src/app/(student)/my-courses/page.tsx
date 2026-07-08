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
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-caption font-semibold uppercase text-neutral-500">Enrollment workspace</p>
            <h1 className="text-2xl font-semibold text-ink-900">My Courses</h1>
            <p className="text-sm text-neutral-600">Open active courses, track pending requests, or withdraw.</p>
          </div>
          <Link href="/catalog" className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-white">
            Browse catalog
          </Link>
        </div>
        {loading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg border border-neutral-200 bg-surface-0" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-surface-0 p-5 text-neutral-600">
            You are not enrolled in any courses yet. Browse the catalog to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {enrollments.map((e) => (
              <li
                key={e.id}
                className="grid gap-3 rounded-lg border border-neutral-200 bg-surface-0 p-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="text-lg font-semibold text-ink-900">
                    {e.course?.title ?? 'Course'}
                  </p>
                  <p className="text-caption font-semibold uppercase text-neutral-500">
                    {e.course?.moduleCount ?? 0} modules · {e.course?.lessonCount ?? 0} lessons
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <StatusChip label={e.status.replace('_', ' ')} tone={toneForStatus(e.status)} />
                  {(e.status === 'active' || e.status === 'completed') && e.course && (
                    <Link
                      href={`/learn/${e.course.id}`}
                      className="rounded-md bg-ink-900 px-3 py-2 text-sm font-semibold text-surface-0"
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
