'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, StatusChip, toneForStatus, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';

interface RosterRow {
  id: string;
  status: string;
  student: { id: string; fullName: string; email: string };
}

export default function RosterPage() {
  const params = useParams<{ courseId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch<{ enrollments: RosterRow[] }>(
      `/courses/${params.courseId}/enrollments?pageSize=200`,
    );
    setRows(data.enrollments);
    setLoading(false);
  }, [authedFetch, params.courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'drop', reason?: string) => {
    await authedFetch(`/enrollments/${id}/${action}`, { method: 'POST', body: reason ? { reason } : {} });
    toast(action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'Withdrawn',
      action === 'approve' ? 'live' : 'alert');
    void load();
  };

  const bulkEnroll = async () => {
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (!list.length) return;
    const res = await authedFetch<{ enrolled: number; skipped: number; notFound: string[] }>(
      `/courses/${params.courseId}/enrollments`,
      { method: 'POST', body: { studentEmails: list } },
    );
    toast(`Enrolled ${res.enrolled}, skipped ${res.skipped}, not found ${res.notFound.length}`, 'live');
    setEmails('');
    void load();
  };

  const pending = rows.filter((r) => r.status === 'pending_approval');

  return (
    <AppShell allow={['instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-10">
        <Link href={`/instructor/courses/${params.courseId}`} className="text-sm text-neutral-600">
          ← Back to builder
        </Link>
        <h1 className="mb-6 mt-2 font-display text-2xl font-semibold text-ink-900">
          Roster &amp; Attendance
        </h1>

        <section className="mb-8 rounded-card border border-neutral-200 bg-surface-0 p-5">
          <h2 className="mb-2 font-display text-lg font-semibold text-ink-900">Bulk enroll</h2>
          <p className="mb-3 text-sm text-neutral-600">
            Paste student emails (comma, space, or newline separated).
          </p>
          <textarea
            aria-label="Student emails"
            rows={3}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="mb-3 w-full rounded-card border border-neutral-200 p-2 text-sm"
            placeholder="sara@example.com, james@example.com"
          />
          <Button size="sm" onClick={bulkEnroll} disabled={!emails.trim()}>
            Enroll students
          </Button>
        </section>

        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
              Pending approval ({pending.length})
            </h2>
            <ul className="flex flex-col gap-2">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-card border border-neutral-200 bg-surface-0 p-3"
                >
                  <span className="text-sm text-ink-900">
                    {r.student.fullName} · {r.student.email}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => act(r.id, 'approve')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => act(r.id, 'reject', 'Not eligible')}>
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mb-3 font-display text-lg font-semibold text-ink-900">
          Enrolled ({rows.length})
        </h2>
        {loading ? (
          <p className="text-neutral-600">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-neutral-600">No enrollments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-card border border-neutral-200 bg-surface-0 p-3"
              >
                <span className="text-sm text-ink-900">
                  {r.student.fullName} · {r.student.email}
                </span>
                <div className="flex items-center gap-3">
                  <StatusChip label={r.status.replace('_', ' ')} tone={toneForStatus(r.status)} />
                  {r.status === 'active' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => act(r.id, 'drop', 'Withdrawn by instructor')}
                    >
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
