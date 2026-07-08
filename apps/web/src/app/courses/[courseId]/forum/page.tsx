'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, Field, SelectField, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import { useRealtimeStream } from '@/lib/use-realtime';

interface ForumThread {
  id: string;
  title: string;
  mode: 'discussion' | 'qa';
  replyCount: number;
  lastPostAt?: string;
  createdAt?: string;
}

interface ForumResponse {
  threads: ForumThread[];
  total: number;
}

export default function CourseForumPage() {
  const params = useParams<{ courseId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [data, setData] = useState<ForumResponse | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'discussion' | 'qa'>('discussion');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await authedFetch<ForumResponse>(`/courses/${params.courseId}/forum`));
    setLoading(false);
  }, [authedFetch, params.courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeStream({
    courseId: params.courseId,
    onEvent: useCallback(() => {
      void load();
    }, [load]),
  });

  const createThread = async () => {
    await authedFetch(`/courses/${params.courseId}/forum`, {
      method: 'POST',
      body: { title, body, mode },
    });
    setTitle('');
    setBody('');
    setMode('discussion');
    toast('Thread created', 'live');
    void load();
  };

  return (
    <AppShell allow={['student', 'alumnus', 'instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <Link href={`/learn/${params.courseId}`} className="text-sm font-semibold text-neutral-600">
              Back to course
            </Link>
            <p className="mt-2 text-caption font-semibold uppercase text-neutral-500">Course discussion</p>
            <h1 className="text-2xl font-semibold text-ink-900">Course Forum</h1>
          </div>
          <p className="text-sm font-semibold text-neutral-600">{data ? `${data.total} threads` : 'Loading...'}</p>
        </div>

        <section className="mb-6 grid gap-4 rounded-lg border border-neutral-200 bg-surface-0 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <Field label="Thread title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <SelectField label="Mode" value={mode} onChange={(e) => setMode(e.target.value as 'discussion' | 'qa')}>
              <option value="discussion">Discussion</option>
              <option value="qa">Q&A</option>
            </SelectField>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink-900">Opening post</label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-surface-0 p-3 text-sm text-ink-900 outline-none"
            />
          </div>
          <div>
            <Button onClick={createThread} disabled={!title || !body}>
              Start thread
            </Button>
          </div>
        </section>

        {loading || !data ? (
          <p className="text-neutral-600">Loading...</p>
        ) : data.threads.length === 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-surface-0 p-6 text-neutral-600">
            No threads yet.
          </p>
        ) : (
          <ul className="grid gap-3">
            {data.threads.map((thread) => (
              <li key={thread.id} className="rounded-lg border border-neutral-200 bg-surface-0 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/courses/${params.courseId}/forum/${thread.id}`}
                      className="text-lg font-semibold text-ink-900 hover:underline"
                    >
                      {thread.title}
                    </Link>
                    <p className="text-sm text-neutral-600">
                      {thread.mode.replace('_', ' ')} · {thread.replyCount} replies
                    </p>
                  </div>
                  {thread.lastPostAt && (
                    <span className="text-caption text-neutral-600">
                      {new Date(thread.lastPostAt).toLocaleString()}
                    </span>
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
