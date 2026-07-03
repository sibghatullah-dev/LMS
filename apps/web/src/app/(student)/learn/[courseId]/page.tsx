'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, ProgressRing } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';

interface PlayerLesson {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'completed';
  percentConsumed: number;
  contentCount: number;
}
interface PlayerModule {
  id: string;
  title: string;
  locked: boolean;
  releaseAt?: string;
  lessons: PlayerLesson[];
}
interface Player {
  courseId: string;
  title: string;
  modules: PlayerModule[];
  progress: { totalLessons: number; completedLessons: number; percent: number };
}
interface LessonContentItem {
  id: string;
  type: string;
  title: string;
  textBody?: string;
  url?: string;
}

const ICON: Record<string, string> = { completed: '✓', in_progress: '●', not_started: '○' };

export default function LearnPage() {
  const params = useParams<{ courseId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [player, setPlayer] = useState<Player | null>(null);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [content, setContent] = useState<LessonContentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadPlayer = useCallback(async () => {
    const p = await authedFetch<Player>(`/courses/${params.courseId}/player`);
    setPlayer(p);
    return p;
  }, [authedFetch, params.courseId]);

  useEffect(() => {
    void loadPlayer();
  }, [loadPlayer]);

  const openLesson = async (lessonId: string, locked: boolean) => {
    if (locked) return;
    setError(null);
    setActiveLesson(lessonId);
    try {
      const data = await authedFetch<{ contentItems: LessonContentItem[] }>(
        `/courses/${params.courseId}/lessons/${lessonId}`,
      );
      setContent(data.contentItems);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not open lesson.');
      setContent([]);
    }
  };

  const markComplete = async () => {
    if (!activeLesson) return;
    await authedFetch(`/courses/${params.courseId}/lessons/${activeLesson}/progress`, {
      method: 'PUT',
      body: { status: 'completed' },
    });
    await loadPlayer();
  };

  const setPercent = async (percent: number) => {
    if (!activeLesson) return;
    await authedFetch(`/courses/${params.courseId}/lessons/${activeLesson}/progress`, {
      method: 'PUT',
      body: { percentConsumed: Math.round(percent) },
    });
    await loadPlayer();
  };

  if (!player) {
    return (
      <AppShell>
        <main className="mx-auto max-w-content px-6 py-10 text-neutral-600">Loading…</main>
      </AppShell>
    );
  }

  const completedModules = player.modules.filter(
    (m) => m.lessons.length > 0 && m.lessons.every((l) => l.status === 'completed'),
  ).length;

  return (
    <AppShell>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/my-courses" className="text-sm text-neutral-600">
              ← My Courses
            </Link>
            <h1 className="font-display text-2xl font-semibold text-ink-900">{player.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/grades/${params.courseId}`}
              className="rounded-card border border-neutral-200 bg-surface-0 px-3 py-2 text-sm font-medium text-ink-900 hover:bg-paper-50"
            >
              Grades
            </Link>
            <ProgressRing total={player.modules.length || 1} completed={completedModules} size="md" />
            <span className="font-mono text-sm tabular-nums text-neutral-600">
              {player.progress.percent}% complete
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-card border border-neutral-200 bg-surface-0 p-3">
            {player.modules.map((m) => (
              <div key={m.id} className="mb-3">
                <p className="mb-1 flex items-center gap-2 font-display text-sm font-semibold text-ink-900">
                  {m.locked && <span aria-hidden>🔒</span>}
                  {m.title}
                </p>
                {m.locked && m.releaseAt && (
                  <p className="mb-1 text-caption text-neutral-600">
                    Unlocks {new Date(m.releaseAt).toLocaleDateString()}
                  </p>
                )}
                <ul className="flex flex-col">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        disabled={m.locked}
                        onClick={() => openLesson(l.id, m.locked)}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-paper-50 disabled:opacity-50 ${
                          activeLesson === l.id ? 'bg-paper-50 font-medium' : ''
                        }`}
                      >
                        <span aria-hidden className="text-neutral-600">
                          {m.locked ? '🔒' : ICON[l.status]}
                        </span>
                        {l.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          <section className="rounded-card border border-neutral-200 bg-surface-0 p-6">
            {!activeLesson ? (
              <p className="text-neutral-600">Select a lesson to begin.</p>
            ) : error ? (
              <p className="text-accent-alert">{error}</p>
            ) : (
              <div className="flex flex-col gap-5">
                {content.length === 0 && <p className="text-neutral-600">No content in this lesson yet.</p>}
                {content.map((ci) => (
                  <ContentBlock key={ci.id} item={ci} onVideoEnded={() => setPercent(100)} />
                ))}
                <div>
                  <Button onClick={markComplete}>Mark complete</Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function ContentBlock({ item, onVideoEnded }: { item: LessonContentItem; onVideoEnded: () => void }) {
  if (item.type === 'article') {
    return (
      <article>
        <h3 className="mb-2 font-display text-lg font-semibold text-ink-900">{item.title}</h3>
        <p className="whitespace-pre-wrap text-base text-ink-900">{item.textBody}</p>
      </article>
    );
  }
  if (item.type === 'video' && item.url) {
    return (
      <div>
        <h3 className="mb-2 font-display text-lg font-semibold text-ink-900">{item.title}</h3>        <video controls src={item.url} onEnded={onVideoEnded} className="w-full rounded-card" />
      </div>
    );
  }
  if (item.type === 'audio' && item.url) {
    return (
      <div>
        <h3 className="mb-2 font-display text-lg font-semibold text-ink-900">{item.title}</h3>        <audio controls src={item.url} className="w-full" />
      </div>
    );
  }
  // document / downloadable
  return (
    <div>
      <h3 className="mb-1 font-display text-lg font-semibold text-ink-900">{item.title}</h3>
      {item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-ink-900 underline">
          Open {item.type} →
        </a>
      ) : (
        <p className="text-sm text-neutral-600">No file uploaded.</p>
      )}
    </div>
  );
}
