'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, StatusChip, toneForStatus, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { Assessment, Submission } from '@/lib/course-types';

interface GradeRow extends Assessment {
  submission: Submission | null;
}

interface GradeResponse {
  course: { id: string; title: string };
  finalGradePercent: number | null;
  assessments: GradeRow[];
}

export default function CourseGradesPage() {
  const params = useParams<{ courseId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [data, setData] = useState<GradeResponse | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(await authedFetch<GradeResponse>(`/me/courses/${params.courseId}/grades`));
  }, [authedFetch, params.courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (assessment: GradeRow) => {
    setError(null);
    try {
      if (assessment.type === 'assignment') {
        await authedFetch(`/assessments/${assessment.id}/submissions`, {
          method: 'POST',
          body: { textResponse: responses[assessment.id] ?? '' },
        });
      } else {
        await authedFetch(`/assessments/${assessment.id}/submissions`, {
          method: 'POST',
          body: {
            answers: assessment.questions.map((question) => ({
              questionId: question.id ?? question._id,
              response: responses[`${assessment.id}:${question.id ?? question._id}`] ?? '',
            })),
          },
        });
      }
      toast('Submitted', 'live');
      await load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not submit assessment.');
    }
  };

  if (!data) {
    return (
      <AppShell allow={['student', 'instructor', 'admin', 'super_admin', 'alumnus']}>
        <main className="mx-auto max-w-content px-6 py-10 text-neutral-600">Loading…</main>
      </AppShell>
    );
  }

  return (
    <AppShell allow={['student', 'instructor', 'admin', 'super_admin', 'alumnus']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/learn/${params.courseId}`} className="text-sm text-neutral-600">
              Back to course
            </Link>
            <h1 className="font-display text-2xl font-semibold text-ink-900">Assignments & grades</h1>
            <p className="text-sm text-neutral-600">{data.course.title}</p>
          </div>
          <div className="rounded-card border border-neutral-200 bg-surface-0 px-4 py-3 text-right">
            <p className="text-caption uppercase tracking-[0.02em] text-neutral-600">Current standing</p>
            <p className="font-mono text-2xl font-semibold tabular-nums text-ink-900">
              {data.finalGradePercent == null ? '—' : `${data.finalGradePercent}%`}
            </p>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}

        <div className="grid gap-4">
          {data.assessments.length === 0 && (
            <p className="rounded-card border border-neutral-200 bg-surface-0 p-6 text-neutral-600">
              No assessments are available yet.
            </p>
          )}
          {data.assessments.map((assessment) => (
            <section key={assessment.id} className="rounded-card border border-neutral-200 bg-surface-0 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold text-ink-900">{assessment.title}</h2>
                    <StatusChip
                      label={assessment.submission?.status ?? 'not submitted'}
                      tone={toneForStatus(assessment.submission?.status ?? 'draft')}
                    />
                    {assessment.submission?.isLate && <StatusChip label="late" tone="alert" />}
                  </div>
                  <p className="text-sm text-neutral-600">
                    {assessment.type} · Max {assessment.maxScore} · Weight {assessment.weightPercent}%
                    {assessment.dueAt ? ` · Due ${new Date(assessment.dueAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <p className="font-mono text-sm tabular-nums text-neutral-600">
                  {assessment.submission?.totalScore == null
                    ? 'Ungraded'
                    : `${assessment.submission.totalScore}/${assessment.maxScore} (${assessment.submission.totalScorePercent}%)`}
                </p>
              </div>

              {assessment.instructions && (
                <p className="mb-4 whitespace-pre-wrap text-sm text-ink-900">{assessment.instructions}</p>
              )}

              {assessment.submission ? (
                <div className="grid gap-2 text-sm">
                  {assessment.submission.instructorComment && (
                    <p>
                      <span className="font-medium text-ink-900">Feedback:</span>{' '}
                      {assessment.submission.instructorComment}
                    </p>
                  )}
                  {assessment.submission.rubricScores.length > 0 && (
                    <ul className="grid gap-1">
                      {assessment.submission.rubricScores.map((score) => (
                        <li key={score.criterion} className="text-neutral-600">
                          {score.criterion}: {score.pointsAwarded}
                          {score.comment ? ` — ${score.comment}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : assessment.type === 'assignment' ? (
                <SubmitAssignment
                  value={responses[assessment.id] ?? ''}
                  onChange={(value) => setResponses({ ...responses, [assessment.id]: value })}
                  onSubmit={() => submit(assessment)}
                />
              ) : (
                <SubmitQuiz
                  assessment={assessment}
                  responses={responses}
                  setResponses={setResponses}
                  onSubmit={() => submit(assessment)}
                />
              )}
            </section>
          ))}
        </div>
      </main>
      <Toaster />
    </AppShell>
  );
}

function SubmitAssignment({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-3">
      <textarea
        aria-label="Assignment response"
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-card border border-neutral-200 bg-surface-0 p-3 text-base text-ink-900 outline-none"
      />
      <Button className="justify-self-start" disabled={!value.trim()} onClick={onSubmit}>
        Submit assignment
      </Button>
    </div>
  );
}

function SubmitQuiz({
  assessment,
  responses,
  setResponses,
  onSubmit,
}: {
  assessment: GradeRow;
  responses: Record<string, string>;
  setResponses: (responses: Record<string, string>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4">
      {assessment.questions.map((question, index) => {
        const questionId = question.id ?? question._id ?? String(index);
        const key = `${assessment.id}:${questionId}`;
        return (
          <div key={questionId} className="grid gap-2">
            <p className="font-medium text-ink-900">{question.prompt}</p>
            {question.options.length > 0 ? (
              <select
                aria-label={question.prompt}
                value={responses[key] ?? ''}
                onChange={(e) => setResponses({ ...responses, [key]: e.target.value })}
                className="h-10 rounded-card border border-neutral-200 bg-surface-0 px-3 text-base text-ink-900"
              >
                <option value="">Select an answer</option>
                {question.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                aria-label={question.prompt}
                rows={4}
                value={responses[key] ?? ''}
                onChange={(e) => setResponses({ ...responses, [key]: e.target.value })}
                className="rounded-card border border-neutral-200 bg-surface-0 p-3 text-base text-ink-900 outline-none"
              />
            )}
          </div>
        );
      })}
      <Button className="justify-self-start" onClick={onSubmit}>
        Submit quiz
      </Button>
    </div>
  );
}
