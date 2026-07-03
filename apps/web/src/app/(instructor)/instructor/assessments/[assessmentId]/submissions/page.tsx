'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, DataTable, Field, StatusChip, toneForStatus, Toaster, useToast } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { Assessment, Submission } from '@/lib/course-types';

export default function GradingQueuePage() {
  const params = useParams<{ assessmentId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [bulkScore, setBulkScore] = useState('');
  const [bulkComment, setBulkComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, rows] = await Promise.all([
      authedFetch<Assessment>(`/assessments/${params.assessmentId}`),
      authedFetch<Submission[]>(`/assessments/${params.assessmentId}/submissions`),
    ]);
    setAssessment(a);
    setSubmissions(rows);
  }, [authedFetch, params.assessmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRows = useMemo(
    () => submissions.filter((row) => selected.has(row.id)),
    [selected, submissions],
  );

  const gradeOne = async (submissionId: string) => {
    setError(null);
    try {
      await authedFetch(`/submissions/${submissionId}/grade`, {
        method: 'PATCH',
        body: {
          totalScore: Number(scores[submissionId] ?? 0),
          instructorComment: comments[submissionId] ?? '',
        },
      });
      toast('Grade posted', 'live');
      await load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not post grade.');
    }
  };

  const bulkGrade = async () => {
    setError(null);
    try {
      const result = await authedFetch<{
        graded: unknown[];
        failed: { submissionId: string; reason: string }[];
      }>(`/assessments/${params.assessmentId}/submissions/bulk-grade`, {
        method: 'POST',
        body: {
          submissionIds: selectedRows.map((row) => row.id),
          totalScore: Number(bulkScore),
          instructorComment: bulkComment,
        },
      });
      setSelected(new Set());
      if (result.failed.length > 0) {
        toast(`Graded ${result.graded.length}, ${result.failed.length} failed`, 'alert');
      } else {
        toast(`Graded ${result.graded.length} submissions`, 'live');
      }
      await load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not bulk grade.');
    }
  };

  return (
    <AppShell allow={['instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={assessment ? `/instructor/courses/${assessment.courseId}` : '/instructor/courses'} className="text-sm text-neutral-600">
              Back to course
            </Link>
            <h1 className="font-display text-2xl font-semibold text-ink-900">
              {assessment?.title ?? 'Grading queue'}
            </h1>
          </div>
          {assessment && (
            <div className="font-mono text-sm tabular-nums text-neutral-600">
              Max {assessment.maxScore} · Weight {assessment.weightPercent}%
            </div>
          )}
        </div>

        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}

        <div className="mb-4 grid gap-3 rounded-card border border-neutral-200 bg-surface-0 p-4 md:grid-cols-[140px_1fr_auto]">
          <Field
            label="Bulk score"
            type="number"
            min={0}
            max={assessment?.maxScore}
            value={bulkScore}
            onChange={(e) => setBulkScore(e.target.value)}
          />
          <Field
            label="Bulk comment"
            value={bulkComment}
            onChange={(e) => setBulkComment(e.target.value)}
          />
          <div className="flex items-end">
            <Button disabled={selectedRows.length === 0 || !bulkScore} onClick={bulkGrade}>
              Apply to {selectedRows.length}
            </Button>
          </div>
        </div>

        <DataTable
          rows={submissions}
          rowKey={(row) => row.id}
          emptyMessage="No submissions yet."
          selection={{
            selectedKeys: selected,
            onToggle: (key) => {
              const next = new Set(selected);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              setSelected(next);
            },
            onToggleAll: (keys) => {
              const allSelected = keys.every((key) => selected.has(key));
              setSelected(allSelected ? new Set() : new Set(keys));
            },
          }}
          columns={[
            {
              key: 'student',
              header: 'Student',
              cell: (row) => <span className="font-mono text-caption">{row.studentId}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => <StatusChip label={row.status} tone={toneForStatus(row.status)} />,
            },
            {
              key: 'submitted',
              header: 'Submitted',
              cell: (row) => (
                <span>
                  {new Date(row.submittedAt).toLocaleString()}
                  {row.isLate && <span className="ml-2 text-accent-alert">Late</span>}
                </span>
              ),
            },
            {
              key: 'score',
              header: 'Score',
              numeric: true,
              cell: (row) =>
                row.status === 'graded' || row.status === 'auto_graded' ? (
                  row.totalScore == null ? '—' : `${row.totalScore} (${row.totalScorePercent}%)`
                ) : (
                  <input
                    aria-label={`Score for ${row.id}`}
                    type="number"
                    min={0}
                    max={assessment?.maxScore}
                    value={scores[row.id] ?? ''}
                    onChange={(e) => setScores({ ...scores, [row.id]: e.target.value })}
                    className="h-8 w-24 rounded border border-neutral-200 px-2 text-right font-mono"
                  />
                ),
            },
            {
              key: 'comment',
              header: 'Comment',
              cell: (row) =>
                row.status === 'graded' || row.status === 'auto_graded' ? (
                  row.instructorComment ?? ''
                ) : (
                  <input
                    aria-label={`Comment for ${row.id}`}
                    value={comments[row.id] ?? ''}
                    onChange={(e) => setComments({ ...comments, [row.id]: e.target.value })}
                    className="h-8 w-full rounded border border-neutral-200 px-2"
                  />
                ),
            },
            {
              key: 'action',
              header: '',
              cell: (row) =>
                row.status === 'graded' || row.status === 'auto_graded' ? (
                  <span className="text-sm text-neutral-600">Posted</span>
                ) : (
                  <Button size="sm" disabled={!scores[row.id]} onClick={() => gradeOne(row.id)}>
                    Post
                  </Button>
                ),
            },
          ]}
        />
      </main>
      <Toaster />
    </AppShell>
  );
}
