'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Button, DataTable, StatusChip, toneForStatus } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { CourseCard } from '@/lib/course-types';

interface CourseSummary {
  enrollmentCount: number;
  activeCount: number;
  completedCount: number;
  averageGradePercent: number;
  averageAttendancePercent: number;
  pendingGradingCount: number;
}

interface InstructorDashboard {
  totals: { courses: number; enrollments: number; pendingGrading: number };
  courses: { course: CourseCard; summary: CourseSummary }[];
}

export default function InstructorDashboardPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<InstructorDashboard | null>(null);

  const load = useCallback(async () => {
    setData(await authedFetch<InstructorDashboard>('/dashboard/instructor'));
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = async (courseId: string) => {
    const res = await fetch(`${API_BASE}/reports/courses/${courseId}/export`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course-${courseId}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell allow={['instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Instructor Dashboard</h1>
            <p className="text-sm text-neutral-600">Enrollment, grades, and grading workload.</p>
          </div>
          <Link
            href="/instructor/courses"
            className="rounded-card bg-ink-900 px-4 py-2 text-sm font-medium text-surface-0"
          >
            Manage courses
          </Link>
        </div>

        {!data ? (
          <p className="text-neutral-600">Loading…</p>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-3">
              <Metric label="Courses" value={data.totals.courses} />
              <Metric label="Enrollments" value={data.totals.enrollments} />
              <Metric label="Pending grading" value={data.totals.pendingGrading} />
            </section>

            <section>
              <h2 className="mb-3 font-display text-xl font-semibold text-ink-900">Course summaries</h2>
              <DataTable
                rows={data.courses}
                rowKey={(row) => row.course.id}
                emptyMessage="No courses yet."
                columns={[
                  {
                    key: 'course',
                    header: 'Course',
                    cell: (row) => (
                      <div>
                        <p className="font-medium">{row.course.title}</p>
                        <StatusChip label={row.course.status.replace('_', ' ')} tone={toneForStatus(row.course.status)} />
                      </div>
                    ),
                  },
                  {
                    key: 'enrollment',
                    header: 'Enrollment',
                    numeric: true,
                    cell: (row) => `${row.summary.activeCount}/${row.summary.enrollmentCount}`,
                  },
                  {
                    key: 'grade',
                    header: 'Avg grade',
                    numeric: true,
                    cell: (row) => `${row.summary.averageGradePercent}%`,
                  },
                  {
                    key: 'pending',
                    header: 'Pending',
                    numeric: true,
                    cell: (row) => row.summary.pendingGradingCount,
                  },
                  {
                    key: 'actions',
                    header: '',
                    cell: (row) => (
                      <div className="flex gap-3">
                        <Link href={`/instructor/courses/${row.course.id}`} className="text-sm font-medium text-ink-900 underline">
                          Open
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => exportCsv(row.course.id)}>
                          CSV
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-neutral-200 bg-surface-0 p-5">
      <p className="text-caption uppercase tracking-[0.02em] text-neutral-600">{label}</p>
      <p className="font-mono text-3xl font-semibold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}
