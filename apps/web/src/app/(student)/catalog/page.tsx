'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Button, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { CourseCard } from '@/lib/course-types';

interface MyEnrollment {
  courseId: string;
  status: string;
}

export default function CatalogPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [byCourse, setByCourse] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cat, mine] = await Promise.all([
      authedFetch<{ courses: CourseCard[] }>('/courses?scope=catalog&pageSize=100'),
      authedFetch<{ enrollments: MyEnrollment[] }>('/me/enrollments'),
    ]);
    setCourses(cat.courses);
    setByCourse(Object.fromEntries(mine.enrollments.map((e) => [e.courseId, e.status])));
    setLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = async (courseId: string) => {
    try {
      const e = await authedFetch<{ status: string }>(`/courses/${courseId}/enrollments`, {
        method: 'POST',
        body: {},
      });
      setByCourse((m) => ({ ...m, [courseId]: e.status }));
      toast(e.status === 'active' ? 'Enrolled' : 'Enrollment requested', 'live');
    } catch (err) {
      toast((err as { message?: string }).message ?? 'Could not enroll', 'alert');
    }
  };

  const label = (status?: string) => {
    if (status === 'active' || status === 'completed') return 'Enrolled';
    if (status === 'pending_approval') return 'Pending approval';
    return null;
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-content px-6 py-10">
        <h1 className="mb-6 font-display text-2xl font-semibold text-ink-900">Course Catalog</h1>
        {loading ? (
          <p className="text-neutral-600">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="text-neutral-600">No published courses yet.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const status = byCourse[c.id];
              const enrolledLabel = label(status);
              return (
                <li key={c.id} className="flex flex-col rounded-card border border-neutral-200 bg-surface-0 p-5">
                  <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">{c.title}</h2>
                  {c.category && (
                    <p className="mb-2 text-caption uppercase tracking-[0.02em] text-neutral-600">
                      {c.category}
                    </p>
                  )}
                  <p className="mb-3 line-clamp-3 flex-1 text-sm text-neutral-600">{c.description}</p>
                  <p className="mb-3 font-mono text-caption tabular-nums text-neutral-600">
                    {c.moduleCount} modules · {c.lessonCount} lessons
                  </p>
                  {enrolledLabel ? (
                    <span className="text-sm font-medium text-accent-live">{enrolledLabel}</span>
                  ) : (
                    <Button size="sm" onClick={() => enroll(c.id)}>
                      {c.enrollmentMode === 'approval_required' ? 'Request enrollment' : 'Enroll'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Toaster />
    </AppShell>
  );
}
