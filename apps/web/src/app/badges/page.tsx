'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { BadgeChip, Button } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';

interface BadgeAward {
  id: string;
  badge: {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    points: number;
  };
  courseId?: string;
  awardedAt: string;
}

interface BadgeResponse {
  totalPoints: number;
  leaderboardOptOut: boolean;
  badges: BadgeAward[];
}

export default function BadgesPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [data, setData] = useState<BadgeResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await authedFetch<BadgeResponse>('/me/badges'));
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load badges.');
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateOptOut = async () => {
    if (!data) return;
    setSaving(true);
    setError('');
    try {
      await authedFetch('/me/gamification/preferences', {
        method: 'PATCH',
        body: { leaderboardOptOut: !data.leaderboardOptOut },
      });
      await load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not update preference.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell allow={['student', 'alumnus', 'instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-caption font-semibold uppercase text-neutral-500">Achievement record</p>
            <h1 className="text-2xl font-semibold text-ink-900">Badges</h1>
            <p className="text-sm text-neutral-600">Points, achievements, and leaderboard privacy.</p>
          </div>
          {data && (
            <Button variant="secondary" disabled={saving} onClick={updateOptOut}>
              {data.leaderboardOptOut ? 'Join leaderboards' : 'Opt out'}
            </Button>
          )}
        </div>
        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}
        {!data ? (
          <p className="text-neutral-600">Loading...</p>
        ) : (
          <div className="grid gap-5">
            <section className="rounded-lg border border-neutral-200 bg-surface-0 p-5">
              <p className="text-caption font-semibold uppercase text-neutral-500">Total points</p>
              <p className="text-4xl font-semibold tabular-nums text-ink-900">{data.totalPoints}</p>
              <p className="mt-2 text-sm text-neutral-600">
                Leaderboard: {data.leaderboardOptOut ? 'hidden' : 'visible'}
              </p>
            </section>
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink-900">Earned badges</h2>
              {data.badges.length === 0 ? (
                <p className="rounded-lg border border-neutral-200 bg-surface-0 p-5 text-neutral-600">
                  No badges earned yet.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {data.badges.map((award) => (
                    <article key={award.id} className="rounded-lg border border-neutral-200 bg-surface-0 p-5">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <BadgeChip label={award.badge.name} />
                        <span className="text-sm font-semibold tabular-nums text-neutral-600">
                          +{award.badge.points}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600">{award.badge.description}</p>
                      <p className="mt-3 text-caption font-semibold uppercase text-neutral-500">
                        {new Date(award.awardedAt).toLocaleDateString()}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}
