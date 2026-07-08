'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, Field, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import { useRealtimeStream } from '@/lib/use-realtime';
import { useSession } from '@/lib/use-session';

interface ForumPost {
  id: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  parentPostId?: string;
  body: string;
  createdAt?: string;
}

interface ForumThreadDetail {
  id: string;
  title: string;
  mode: 'discussion' | 'qa';
  starterPostId: string;
  acceptedAnswerPostId?: string;
  posts: ForumPost[];
}

export default function ForumThreadPage() {
  const params = useParams<{ courseId: string; threadId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const { user } = useSession({ redirect: true, allow: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'] });
  const [data, setData] = useState<ForumThreadDetail | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [parentPostId, setParentPostId] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setData(await authedFetch<ForumThreadDetail>(`/courses/${params.courseId}/forum/${params.threadId}`));
  }, [authedFetch, params.courseId, params.threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeStream({
    courseId: params.courseId,
    threadId: params.threadId,
    onEvent: useCallback(() => {
      void load();
    }, [load]),
  });

  const postsByParent = useMemo(() => {
    const map = new Map<string | undefined, ForumPost[]>();
    if (!data) return map;
    for (const post of data.posts) {
      const key = post.parentPostId;
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [data]);

  const postOrder = (posts?: ForumPost[]) =>
    [...(posts ?? [])].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

  const submitReply = async () => {
    await authedFetch(`/courses/${params.courseId}/forum/${params.threadId}/replies`, {
      method: 'POST',
      body: { body: replyBody, parentPostId },
    });
    setReplyBody('');
    setParentPostId(undefined);
    toast('Reply posted', 'live');
    void load();
  };

  const markAccepted = async (postId: string) => {
    await authedFetch(`/courses/${params.courseId}/forum/${params.threadId}/accepted-answer`, {
      method: 'PATCH',
      body: { postId },
    });
    toast('Accepted answer updated', 'live');
    void load();
  };

  const renderPosts = (parentId?: string, depth = 0) =>
    postOrder(postsByParent.get(parentId)).map((post) => (
      <div key={post.id} className="space-y-3" style={{ marginLeft: depth * 18 }}>
        <article className="rounded-lg border border-neutral-200 bg-surface-0 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink-900">{post.authorName ?? 'Unknown user'}</p>
              <p className="text-caption font-semibold uppercase text-neutral-500">
                {post.authorRole ?? 'member'}
                {post.createdAt ? ` · ${new Date(post.createdAt).toLocaleString()}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setParentPostId(post.id)}>
                Reply
              </Button>
              {data?.mode === 'qa' && (
                <Button size="sm" onClick={() => markAccepted(post.id)}>
                  Accept
                </Button>
              )}
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink-900">{post.body}</p>
          {data?.acceptedAnswerPostId === post.id && (
            <p className="mt-3 text-sm font-semibold text-accent-live">Accepted answer</p>
          )}
        </article>
        {renderPosts(post.id, depth + 1)}
      </div>
    ));

  return (
    <AppShell allow={['student', 'alumnus', 'instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-5">
          <Link href={`/courses/${params.courseId}/forum`} className="text-sm font-semibold text-neutral-600">
            Back to forum
          </Link>
          <p className="mt-2 text-caption font-semibold uppercase text-neutral-500">Forum thread</p>
          <h1 className="text-2xl font-semibold text-ink-900">{data?.title ?? 'Thread'}</h1>
        </div>

        {!data ? (
          <p className="text-neutral-600">Loading...</p>
        ) : (
          <div className="grid gap-6">
            <section className="grid gap-4">
              {renderPosts(undefined)}
            </section>

            <section className="rounded-lg border border-neutral-200 bg-surface-0 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">Reply</h2>
                  {parentPostId && (
                    <p className="text-sm text-neutral-600">Replying to a specific post.</p>
                  )}
                </div>
                {parentPostId && (
                  <Button size="sm" variant="secondary" onClick={() => setParentPostId(undefined)}>
                    Clear target
                  </Button>
                )}
              </div>
              <div className="grid gap-4">
                <Field
                  label="Message"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <Button onClick={submitReply} disabled={!replyBody}>
                  Post reply
                </Button>
              </div>
            </section>

            {user && data.mode === 'qa' && user.role !== 'student' && (
              <p className="text-sm text-neutral-600">
                Instructor replies can be accepted directly from the post actions.
              </p>
            )}
          </div>
        )}
      </main>
      <Toaster />
    </AppShell>
  );
}
