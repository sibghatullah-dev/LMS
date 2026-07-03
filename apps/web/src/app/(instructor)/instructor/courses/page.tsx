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
      <main className="mx-auto max-w-content px-6 py-10">
        <h1 className="mb-6 font-display text-2xl font-semibold text-ink-900">My Courses</h1>

        <form onSubmit={create} className="mb-8 flex items-end gap-3">
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
          <p className="text-neutral-600">Loading…</p>
        ) : courses.length === 0 ? (
          <p className="text-neutral-600">
            No courses yet. Create your first course to start building.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li
                key={c.id}
                className="rounded-card border border-neutral-200 bg-surface-0 p-5"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-ink-900">{c.title}</h2>
                  <StatusChip label={c.status.replace('_', ' ')} tone={toneForStatus(c.status)} />
                </div>
                <p className="mb-4 font-mono text-caption tabular-nums text-neutral-600">
                  {c.moduleCount} modules · {c.lessonCount} lessons
                </p>
                <Link
                  href={`/instructor/courses/${c.id}`}
                  className="text-sm font-medium text-ink-900 underline"
                >
                  Open builder →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
