'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, Field, StatusChip, toneForStatus } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { CourseCard } from '@/lib/course-types';

export default function InstructorCoursesPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch<{ courses: CourseCard[] }>('/courses?scope=mine&pageSize=100');
    setCourses(data.courses);
    setLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    await authedFetch('/courses', { method: 'POST', body: { title } });
    setTitle('');
    setCreating(false);
    void load();
  };

  return (
    <AppShell allow={['instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-5">
          <p className="text-caption font-semibold uppercase text-neutral-500">Course operations</p>
          <h1 className="text-2xl font-semibold text-ink-900">My Courses</h1>
          <p className="text-sm text-neutral-600">Create drafts, open builders, and monitor approval status.</p>
        </div>

        <form onSubmit={create} className="mb-5 grid gap-3 rounded-lg border border-neutral-200 bg-surface-0 p-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="flex-1">
            <Field
              label="New course title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. UX Foundations"
            />
          </div>
          <Button type="submit" disabled={creating || !title.trim()}>
            {creating ? 'Creating…' : 'Create course'}
          </Button>
        </form>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-lg border border-neutral-200 bg-surface-0" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-surface-0 p-5 text-neutral-600">
            No courses yet. Create your first course to start building.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-neutral-200 bg-surface-0 p-5"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-ink-900">{c.title}</h2>
                  <StatusChip label={c.status.replace('_', ' ')} tone={toneForStatus(c.status)} />
                </div>
                <p className="mb-4 text-caption font-semibold uppercase text-neutral-500">
                  {c.moduleCount} modules · {c.lessonCount} lessons
                </p>
                <Link
                  href={`/instructor/courses/${c.id}`}
                  className="inline-flex rounded-md bg-ink-900 px-3 py-2 text-sm font-semibold text-white"
                >
                  Open builder
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
