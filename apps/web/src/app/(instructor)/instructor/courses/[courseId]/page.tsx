'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import {
  Button,
  DataTable,
  Field,
  SelectField,
  StatusChip,
  toneForStatus,
  useToast,
  Toaster,
} from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { Assessment, Course, Module } from '@/lib/course-types';

/** Immutably move item at `from` by `delta` within an array. */
function move<T>(arr: T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

export default function CourseBuilderPage() {
  const params = useParams<{ courseId: string }>();
  const router = useRouter();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const c = await authedFetch<Course>(`/courses/${params.courseId}`);
    setCourse(c);
    setModules(c.modules ?? []);
    setTitle(c.title);
    setDescription(c.description ?? '');
  }, [authedFetch, params.courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const editable = course?.status === 'draft';

  /** Request a presigned URL, upload the file directly to storage, return the key. */
  const uploadFile = async (file: File, type: string): Promise<string> => {
    const kind =
      type === 'video' ? 'video' : type === 'audio' ? 'audio' : type === 'downloadable' ? 'downloadable' : 'document';
    const mimeType = file.type || 'application/octet-stream';
    const { uploadUrl, storageKey } = await authedFetch<{ uploadUrl: string; storageKey: string }>(
      '/content/upload-url',
      { method: 'POST', body: { courseId: params.courseId, fileName: file.name, mimeType, sizeBytes: file.size, kind } },
    );
    const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } });
    if (!res.ok) throw new Error('Upload failed');
    return storageKey;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await authedFetch<Course>(`/courses/${params.courseId}`, {
        method: 'PATCH',
        body: { title, description, modules },
      });
      setCourse(updated);
      setModules(updated.modules);
      toast('Saved', 'live');
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    setError(null);
    try {
      await authedFetch(`/courses/${params.courseId}/submit-for-review`, { method: 'POST' });
      toast('Submitted for review', 'live');
      void load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Submit failed.');
    }
  };

  const saveAsTemplate = async () => {
    const created = await authedFetch<{ id: string }>(
      `/courses/${params.courseId}/clone-as-template`,
      { method: 'POST', body: { asTemplate: true } },
    );
    toast('Saved as template', 'live');
    router.push(`/instructor/courses/${created.id}`);
  };

  if (!course) {
    return (
      <AppShell allow={['instructor', 'admin', 'super_admin']}>
        <main className="mx-auto max-w-content px-6 py-10 text-neutral-600">Loading…</main>
      </AppShell>
    );
  }

  return (
    <AppShell allow={['instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-ink-900">Course Builder</h1>
            <StatusChip label={course.status.replace('_', ' ')} tone={toneForStatus(course.status)} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push(`/instructor/courses/${params.courseId}/roster`)}
            >
              Roster
            </Button>
            <Button variant="secondary" onClick={saveAsTemplate}>
              Save as template
            </Button>
            {editable && (
              <>
                <Button variant="secondary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button onClick={submitForReview}>Submit for review</Button>
              </>
            )}
          </div>
        </div>

        {course.reviewComment && (
          <div className="mb-6 rounded-card border border-accent-alert bg-accent-alert/10 p-4 text-sm text-ink-900">
            <strong>Returned for revision:</strong> {course.reviewComment}
          </div>
        )}
        {!editable && (
          <p className="mb-6 rounded-card border border-neutral-200 bg-surface-0 p-4 text-sm text-neutral-600">
            This course is <strong>{course.status.replace('_', ' ')}</strong> and is read-only.
            Only draft courses can be edited.
          </p>
        )}
        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}

        <section className="mb-8 grid gap-4 rounded-card border border-neutral-200 bg-surface-0 p-5">
          <Field
            label="Title"
            value={title}
            disabled={!editable}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="desc" className="text-sm font-medium text-ink-900">
              Description
            </label>
            <textarea
              id="desc"
              rows={3}
              disabled={!editable}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-card border border-neutral-200 bg-surface-0 p-3 text-base text-ink-900 outline-none disabled:opacity-60"
            />
          </div>
        </section>

        <ModuleEditor
          modules={modules}
          setModules={setModules}
          editable={editable}
          uploadFile={uploadFile}
        />

        {editable && (
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => setModules([...modules, { title: `Module ${modules.length + 1}`, lessons: [] }])}
          >
            + Add module
          </Button>
        )}

        <AssessmentPanel courseId={params.courseId} />
      </main>
      <Toaster />
    </AppShell>
  );
}

function AssessmentPanel({ courseId }: { courseId: string }) {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const toast = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [type, setType] = useState<'assignment' | 'quiz'>('assignment');
  const [title, setTitle] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [weightPercent, setWeightPercent] = useState(10);
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setAssessments(await authedFetch<Assessment[]>(`/courses/${courseId}/assessments`));
  }, [authedFetch, courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (status: 'draft' | 'published') => {
    setSaving(true);
    setError(null);
    try {
      const body =
        type === 'assignment'
          ? {
              type,
              title,
              maxScore,
              weightPercent,
              status,
              dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
              allowLateSubmission: true,
              latePenaltyPercentPerDay: 0,
              submissionTypes: ['text'],
              rubric: [{ criterion: 'Overall', maxPoints: maxScore }],
            }
          : {
              type,
              title,
              maxScore,
              weightPercent,
              status,
              dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
              allowLateSubmission: true,
              questions: [
                {
                  questionType: 'multiple_choice',
                  prompt: 'Replace this prompt',
                  options: ['Option A', 'Option B'],
                  correctAnswer: 'Option A',
                  points: maxScore,
                },
              ],
            };
      await authedFetch(`/courses/${courseId}/assessments`, { method: 'POST', body });
      setTitle('');
      toast(status === 'published' ? 'Assessment published' : 'Assessment saved', 'live');
      await load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not create assessment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink-900">Assessments</h2>
          <p className="text-sm text-neutral-600">Assignments, quizzes, grading queues, and weights.</p>
        </div>
      </div>

      <div className="grid gap-4 rounded-card border border-neutral-200 bg-surface-0 p-5 lg:grid-cols-[160px_1fr_130px_130px_190px_auto]">
        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="assignment">Assignment</option>
          <option value="quiz">Quiz</option>
        </SelectField>
        <Field label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field
          label="Max score"
          type="number"
          min={1}
          value={maxScore}
          onChange={(e) => setMaxScore(Number(e.target.value))}
        />
        <Field
          label="Weight %"
          type="number"
          min={0}
          max={100}
          value={weightPercent}
          onChange={(e) => setWeightPercent(Number(e.target.value))}
        />
        <Field label="Due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <div className="flex items-end gap-2">
          <Button variant="secondary" disabled={saving || !title} onClick={() => create('draft')}>
            Save
          </Button>
          <Button disabled={saving || !title} onClick={() => create('published')}>
            Publish
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-accent-alert">{error}</p>}

      <DataTable
        rows={assessments}
        rowKey={(row) => row.id}
        emptyMessage="No assessments yet."
        columns={[
          { key: 'title', header: 'Assessment', cell: (row) => row.title },
          { key: 'type', header: 'Type', cell: (row) => row.type },
          {
            key: 'status',
            header: 'Status',
            cell: (row) => (
              <StatusChip label={row.status} tone={toneForStatus(row.status === 'closed' ? 'archived' : row.status)} />
            ),
          },
          {
            key: 'weight',
            header: 'Weight',
            numeric: true,
            cell: (row) => `${row.weightPercent}%`,
          },
          {
            key: 'due',
            header: 'Due',
            cell: (row) => (row.dueAt ? new Date(row.dueAt).toLocaleString() : 'No due date'),
          },
          {
            key: 'queue',
            header: '',
            cell: (row) => (
              <Link
                href={`/instructor/assessments/${row.id}/submissions`}
                className="text-sm font-medium text-ink-900 underline"
              >
                Grade
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
}

function ModuleEditor({
  modules,
  setModules,
  editable,
  uploadFile,
}: {
  modules: Module[];
  setModules: (m: Module[]) => void;
  editable: boolean;
  uploadFile: (file: File, type: string) => Promise<string>;
}) {
  const update = (mi: number, patch: Partial<Module>) =>
    setModules(modules.map((m, i) => (i === mi ? { ...m, ...patch } : m)));

  return (
    <div className="flex flex-col gap-4">
      {modules.map((mod, mi) => (
        <div key={mod.id ?? mi} className="rounded-card border border-neutral-200 bg-surface-0 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span aria-hidden className="text-neutral-600">
              ⠿
            </span>
            <input
              aria-label={`Module ${mi + 1} title`}
              value={mod.title}
              disabled={!editable}
              onChange={(e) => update(mi, { title: e.target.value })}
              className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 font-display text-lg font-semibold text-ink-900 hover:border-neutral-200 focus:border-neutral-200 disabled:opacity-60"
            />
            {editable && (
              <div className="flex gap-1">
                <IconButton label="Move module up" onClick={() => setModules(move(modules, mi, -1))}>
                  ↑
                </IconButton>
                <IconButton label="Move module down" onClick={() => setModules(move(modules, mi, 1))}>
                  ↓
                </IconButton>
                <IconButton
                  label="Remove module"
                  onClick={() => setModules(modules.filter((_, i) => i !== mi))}
                >
                  ✕
                </IconButton>
              </div>
            )}
          </div>

          <LessonEditor
            lessons={mod.lessons}
            editable={editable}
            uploadFile={uploadFile}
            setLessons={(lessons) => update(mi, { lessons })}
          />
        </div>
      ))}
    </div>
  );
}

function LessonEditor({
  lessons,
  setLessons,
  editable,
  uploadFile,
}: {
  lessons: Module['lessons'];
  setLessons: (l: Module['lessons']) => void;
  editable: boolean;
  uploadFile: (file: File, type: string) => Promise<string>;
}) {
  const setContentItem = (li: number, cii: number, patch: Record<string, unknown>) =>
    setLessons(
      lessons.map((l, i) =>
        i === li
          ? { ...l, contentItems: l.contentItems.map((c, k) => (k === cii ? { ...c, ...patch } : c)) }
          : l,
      ),
    );
  return (
    <div className="ml-6 flex flex-col gap-2">
      {lessons.map((lesson, li) => (
        <div key={lesson.id ?? li} className="rounded border border-neutral-200 p-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-neutral-600">
              ⠿
            </span>
            <input
              aria-label={`Lesson ${li + 1} title`}
              value={lesson.title}
              disabled={!editable}
              onChange={(e) =>
                setLessons(lessons.map((l, i) => (i === li ? { ...l, title: e.target.value } : l)))
              }
              className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-base text-ink-900 hover:border-neutral-200 focus:border-neutral-200 disabled:opacity-60"
            />
            <span className="font-mono text-caption text-neutral-600">
              {lesson.contentItems.length} items
            </span>
            {editable && (
              <div className="flex gap-1">
                <IconButton label="Move lesson up" onClick={() => setLessons(move(lessons, li, -1))}>
                  ↑
                </IconButton>
                <IconButton label="Move lesson down" onClick={() => setLessons(move(lessons, li, 1))}>
                  ↓
                </IconButton>
                <IconButton
                  label="Add content item"
                  onClick={() =>
                    setLessons(
                      lessons.map((l, i) =>
                        i === li
                          ? { ...l, contentItems: [...l.contentItems, { type: 'article', title: 'New item' }] }
                          : l,
                      ),
                    )
                  }
                >
                  +
                </IconButton>
                <IconButton
                  label="Remove lesson"
                  onClick={() => setLessons(lessons.filter((_, i) => i !== li))}
                >
                  ✕
                </IconButton>
              </div>
            )}
          </div>

          {lesson.contentItems.length > 0 && (
            <ul className="ml-6 mt-2 flex flex-col gap-1">
              {lesson.contentItems.map((ci, cii) => (
                <li key={ci.id ?? cii} className="flex items-center gap-2 text-sm">
                  <select
                    aria-label="Content type"
                    value={ci.type}
                    disabled={!editable}
                    onChange={(e) =>
                      setLessons(
                        lessons.map((l, i) =>
                          i === li
                            ? {
                                ...l,
                                contentItems: l.contentItems.map((c, k) =>
                                  k === cii ? { ...c, type: e.target.value as typeof c.type } : c,
                                ),
                              }
                            : l,
                        ),
                      )
                    }
                    className="rounded border border-neutral-200 px-1 py-0.5 text-caption"
                  >
                    {['video', 'audio', 'document', 'article', 'downloadable'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Content title"
                    value={ci.title}
                    disabled={!editable}
                    onChange={(e) =>
                      setLessons(
                        lessons.map((l, i) =>
                          i === li
                            ? {
                                ...l,
                                contentItems: l.contentItems.map((c, k) =>
                                  k === cii ? { ...c, title: e.target.value } : c,
                                ),
                              }
                            : l,
                        ),
                      )
                    }
                    className="flex-1 rounded border border-neutral-200 px-1 py-0.5"
                  />
                  {editable && ci.type !== 'article' && (
                    <UploadControl
                      hasFile={Boolean(ci.storageKey)}
                      onFile={async (file) => {
                        const key = await uploadFile(file, ci.type);
                        setContentItem(li, cii, { storageKey: key });
                      }}
                    />
                  )}
                  {editable && (
                    <IconButton
                      label="Remove content item"
                      onClick={() =>
                        setLessons(
                          lessons.map((l, i) =>
                            i === li
                              ? { ...l, contentItems: l.contentItems.filter((_, k) => k !== cii) }
                              : l,
                          ),
                        )
                      }
                    >
                      ✕
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {editable && (
        <button
          type="button"
          onClick={() => setLessons([...lessons, { title: `Lesson ${lessons.length + 1}`, contentItems: [] }])}
          className="self-start text-sm text-neutral-600 hover:text-ink-900"
        >
          + Add lesson
        </button>
      )}
    </div>
  );
}

function UploadControl({
  hasFile,
  onFile,
}: {
  hasFile: boolean;
  onFile: (file: File) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex cursor-pointer items-center gap-1 text-caption text-neutral-600 hover:text-ink-900">
      <span aria-hidden>{busy ? '…' : hasFile ? '✓' : '⬆'}</span>
      <span>{busy ? 'Uploading' : hasFile ? 'Replace' : 'Upload'}</span>
      <input
        type="file"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            await onFile(file);
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded border border-neutral-200 text-sm text-neutral-600 hover:bg-paper-50 hover:text-ink-900"
    >
      {children}
    </button>
  );
}
