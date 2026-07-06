'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { DataTable, StatusChip, toneForStatus } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { CourseCard } from '@/lib/course-types';

interface AdminDashboard {
  summary: {
    totalUsers: number;
    totalCourses: number;
    pendingCourseApprovals: number;
    activeEnrollments: number;
    averagePlatformAttendancePercent: number;
  };
  pendingCourses: CourseCard[];
  recentUsers: { id: string; fullName: string; email: string; role: string; status: string }[];
}

export default function AdminDashboardPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [data, setData] = useState<AdminDashboard | null>(null);

  const load = useCallback(async () => {
    setData(await authedFetch<AdminDashboard>('/dashboard/admin'));
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell allow={['admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Admin Dashboard</h1>
            <p className="text-sm text-neutral-600">Platform usage, approvals, and account activity.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/courses" className="rounded-card border border-neutral-200 bg-surface-0 px-4 py-2 text-sm font-medium text-ink-900">
              Course approvals
            </Link>
            <Link href="/admin/users" className="rounded-card bg-ink-900 px-4 py-2 text-sm font-medium text-surface-0">
              Users
            </Link>
          </div>
        </div>

        {!data ? (
          <p className="text-neutral-600">Loading…</p>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Users" value={data.summary.totalUsers} />
              <Metric label="Courses" value={data.summary.totalCourses} />
              <Metric label="Pending approvals" value={data.summary.pendingCourseApprovals} />
              <Metric label="Active enrollments" value={data.summary.activeEnrollments} />
              <Metric label="Attendance" value={`${data.summary.averagePlatformAttendancePercent}%`} />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 font-display text-xl font-semibold text-ink-900">Pending courses</h2>
                <DataTable
                  rows={data.pendingCourses}
                  rowKey={(row) => row.id}
                  emptyMessage="No pending courses."
                  columns={[
                    { key: 'title', header: 'Course', cell: (row) => row.title },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (row) => <StatusChip label={row.status.replace('_', ' ')} tone={toneForStatus(row.status)} />,
                    },
                    {
                      key: 'open',
                      header: '',
                      cell: () => (
                        <Link href="/admin/courses" className="text-sm font-medium text-ink-900 underline">
                          Review
                        </Link>
                      ),
                    },
                  ]}
                />
              </div>
              <div>
                <h2 className="mb-3 font-display text-xl font-semibold text-ink-900">Recent users</h2>
                <DataTable
                  rows={data.recentUsers}
                  rowKey={(row) => row.id}
                  emptyMessage="No users yet."
                  columns={[
                    { key: 'name', header: 'Name', cell: (row) => row.fullName },
                    { key: 'role', header: 'Role', cell: (row) => row.role },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (row) => <StatusChip label={row.status.replace('_', ' ')} tone={toneForStatus(row.status)} />,
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border border-neutral-200 bg-surface-0 p-5">
      <p className="text-caption uppercase tracking-[0.02em] text-neutral-600">{label}</p>
      <p className="font-mono text-3xl font-semibold tabular-nums text-ink-900">{value}</p>
    </div>
  );
}
