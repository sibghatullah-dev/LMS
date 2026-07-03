'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { DataTable, ProgressRing, StatusChip, toneForStatus } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { CourseCard } from '@/lib/course-types';

interface StudentDashboard {
  courses: {
    enrollmentId: string;
    status: string;
    finalGradePercent: number | null;
    progressPercent: number;
    course: CourseCard | null;
  }[];
  upcomingDeadlines: {
    id: string;
    courseId: string;
    title: string;
    type: string;
    dueAt?: string;
    overdue: boolean;
  }[];
  recentGrades: {
    id: string;
    courseId: string;
    assessmentId: string;
    totalScore: number | null;
    totalScorePercent: number | null;
    gradedAt: string;
  }[];
}

export default function StudentDashboardPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [data, setData] = useState<StudentDashboard | null>(null);

  const load = useCallback(async () => {
    setData(await authedFetch<StudentDashboard>('/dashboard/student'));
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell allow={['student', 'instructor', 'admin', 'super_admin', 'alumnus']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Dashboard</h1>
            <p className="text-sm text-neutral-600">Deadlines, grades, and course progress.</p>
          </div>
          <Link
            href="/catalog"
            className="rounded-card bg-ink-900 px-4 py-2 text-sm font-medium text-surface-0"
          >
            Browse catalog
          </Link>
        </div>

        {!data ? (
          <p className="text-neutral-600">Loading…</p>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.courses.length === 0 ? (
                <p className="rounded-card border border-neutral-200 bg-surface-0 p-5 text-neutral-600">
                  No active courses yet.
                </p>
              ) : (
                data.courses.map((row) => (
                  <article key={row.enrollmentId} className="rounded-card border border-neutral-200 bg-surface-0 p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-semibold text-ink-900">
                          {row.course?.title ?? 'Course'}
                        </h2>
                        <StatusChip label={row.status.replace('_', ' ')} tone={toneForStatus(row.status)} />
                      </div>
                      <ProgressRing total={100} completed={row.progressPercent} size="sm" />
                    </div>
                    <p className="mb-4 font-mono text-sm tabular-nums text-neutral-600">
                      {row.progressPercent}% complete · Grade {row.finalGradePercent == null ? '—' : `${row.finalGradePercent}%`}
                    </p>
                    {row.course && (
                      <div className="flex gap-3">
                        <Link href={`/learn/${row.course.id}`} className="text-sm font-medium text-ink-900 underline">
                          Continue
                        </Link>
                        <Link href={`/grades/${row.course.id}`} className="text-sm font-medium text-ink-900 underline">
                          Grades
                        </Link>
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 font-display text-xl font-semibold text-ink-900">Upcoming deadlines</h2>
                <DataTable
                  rows={data.upcomingDeadlines}
                  rowKey={(row) => row.id}
                  emptyMessage="No open deadlines."
                  columns={[
                    { key: 'title', header: 'Assessment', cell: (row) => row.title },
                    { key: 'type', header: 'Type', cell: (row) => row.type },
                    {
                      key: 'due',
                      header: 'Due',
                      cell: (row) => (
                        <span className={row.overdue ? 'text-accent-alert' : undefined}>
                          {row.dueAt ? new Date(row.dueAt).toLocaleString() : 'No due date'}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
              <div>
                <h2 className="mb-3 font-display text-xl font-semibold text-ink-900">Recent grades</h2>
                <DataTable
                  rows={data.recentGrades}
                  rowKey={(row) => row.id}
                  emptyMessage="No grades posted yet."
                  columns={[
                    {
                      key: 'score',
                      header: 'Score',
                      numeric: true,
                      cell: (row) =>
                        row.totalScore == null ? '—' : `${row.totalScore} (${row.totalScorePercent}%)`,
                    },
                    {
                      key: 'graded',
                      header: 'Posted',
                      cell: (row) => new Date(row.gradedAt).toLocaleString(),
                    },
                    {
                      key: 'course',
                      header: '',
                      cell: (row) => (
                        <Link href={`/grades/${row.courseId}`} className="text-sm font-medium text-ink-900 underline">
                          View
                        </Link>
                      ),
                    },
                  ]}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
