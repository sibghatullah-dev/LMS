'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { DataTable } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';

interface LeaderboardRow {
  rank: number;
  userId: string;
  fullName: string;
  points: number;
}

interface LeaderboardResponse {
  courseId: string;
  leaderboard: LeaderboardRow[];
}

export default function LeaderboardPage() {
  const params = useParams<{ courseId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await authedFetch<LeaderboardResponse>(`/courses/${params.courseId}/leaderboard`));
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load leaderboard.');
    }
  }, [authedFetch, params.courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell allow={['student', 'alumnus', 'instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <Link href={`/learn/${params.courseId}`} className="text-sm font-semibold text-neutral-600">
          Back to course
        </Link>
        <div className="mb-5 mt-2">
          <p className="text-caption font-semibold uppercase text-neutral-500">Course ranking</p>
          <h1 className="text-2xl font-semibold text-ink-900">Leaderboard</h1>
          <p className="text-sm text-neutral-600">Course points earned from achievements.</p>
        </div>
        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}
        {!data ? (
          <p className="text-neutral-600">Loading...</p>
        ) : (
          <DataTable
            rows={data.leaderboard}
            rowKey={(row) => row.userId}
            emptyMessage="No points awarded yet."
            columns={[
              { key: 'rank', header: 'Rank', numeric: true, cell: (row) => row.rank },
              { key: 'learner', header: 'Learner', cell: (row) => row.fullName },
              { key: 'points', header: 'Points', numeric: true, cell: (row) => row.points },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
