'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, StatusChip, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationResponse {
  notifications: NotificationRow[];
  unreadCount: number;
  total: number;
}

export default function NotificationsPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    setData(await authedFetch<NotificationResponse>(`/notifications?unreadOnly=${unreadOnly}`));
  }, [authedFetch, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    await authedFetch(`/notifications/${id}/read`, { method: 'POST' });
    void load();
  };

  const markAll = async () => {
    await authedFetch('/notifications/read-all', { method: 'POST' });
    toast('Notifications marked read', 'live');
    void load();
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Notifications</h1>
            <p className="text-sm text-neutral-600">
              {data ? `${data.unreadCount} unread · ${data.total} total` : 'Loading…'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant={unreadOnly ? 'primary' : 'secondary'} onClick={() => setUnreadOnly(!unreadOnly)}>
              Unread
            </Button>
            <Button variant="secondary" onClick={markAll}>
              Mark all read
            </Button>
          </div>
        </div>

        {!data ? (
          <p className="text-neutral-600">Loading…</p>
        ) : data.notifications.length === 0 ? (
          <p className="rounded-card border border-neutral-200 bg-surface-0 p-6 text-neutral-600">
            Nothing here yet.
          </p>
        ) : (
          <ul className="grid gap-3">
            {data.notifications.map((n) => (
              <li key={n.id} className="rounded-card border border-neutral-200 bg-surface-0 p-5">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold text-ink-900">{n.title}</h2>
                      {!n.readAt && <StatusChip label="unread" tone="progress" />}
                    </div>
                    <p className="text-caption uppercase tracking-[0.02em] text-neutral-600">
                      {n.type.replaceAll('_', ' ')} · {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.readAt && (
                    <Button size="sm" variant="secondary" onClick={() => markRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
                {n.body && <p className="mb-3 whitespace-pre-wrap text-sm text-ink-900">{n.body}</p>}
                {n.actionUrl && (
                  <Link href={n.actionUrl} className="text-sm font-medium text-ink-900 underline">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Toaster />
    </AppShell>
  );
}
