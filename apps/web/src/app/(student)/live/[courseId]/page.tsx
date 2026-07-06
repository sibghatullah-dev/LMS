'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, DataTable, StatusChip, toneForStatus, type Column } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { LiveSession } from '@/lib/course-types';

export default function StudentLiveSessionsPage() {
  const params = useParams<{ courseId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setSessions(await authedFetch<LiveSession[]>(`/courses/${params.courseId}/live-sessions`));
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load live sessions.');
    }
  }, [authedFetch, params.courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const join = async (session: LiveSession) => {
    setJoiningId(session.id);
    setError('');
    try {
      const data = await authedFetch<{ joinToken: string; mediaServiceUrl: string; joinUrl?: string }>(
        `/live-sessions/${session.id}/join-token`,
      );
      if (data.joinUrl) {
        window.open(data.joinUrl, '_blank', 'noopener,noreferrer');
      } else {
        setError('Native classroom tokens are ready, but the media classroom UI is not enabled yet.');
      }
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not join session.');
    } finally {
      setJoiningId(null);
    }
  };

  const columns: Column<LiveSession>[] = [
    { key: 'title', header: 'Session', cell: (row) => row.title },
    {
      key: 'when',
      header: 'When',
      cell: (row) => `${new Date(row.scheduledStart).toLocaleString()} - ${new Date(row.scheduledEnd).toLocaleTimeString()}`,
    },
    { key: 'mode', header: 'Mode', cell: (row) => row.deliveryMode.replace('_', ' ') },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusChip label={row.status} tone={toneForStatus(row.status)} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <Button
          size="sm"
          disabled={joiningId === row.id || row.status === 'ended' || row.status === 'cancelled'}
          onClick={() => void join(row)}
        >
          Join
        </Button>
      ),
    },
  ];

  return (
    <AppShell allow={['student', 'alumnus', 'instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <Link href={`/learn/${params.courseId}`} className="text-sm text-neutral-600">
          Back to course
        </Link>
        <div className="mb-6 mt-2">
          <h1 className="font-display text-2xl font-semibold text-ink-900">Live sessions</h1>
          <p className="text-sm text-neutral-600">Upcoming and past classroom sessions for this course.</p>
        </div>
        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}
        <DataTable
          columns={columns}
          rows={sessions}
          rowKey={(session) => session.id}
          emptyMessage="No live sessions scheduled."
        />
      </main>
    </AppShell>
  );
}
