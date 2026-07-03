'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { CourseCard } from '@/lib/course-types';

export default function TemplatesPage() {
  const router = useRouter();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [templates, setTemplates] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch<{ courses: CourseCard[] }>('/courses?scope=templates&pageSize=100');
    setTemplates(data.courses);
    setLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const instantiateTemplate = async (id: string) => {
    const created = await authedFetch<{ id: string }>(`/courses/${id}/clone-as-template`, {
      method: 'POST',
      body: { asTemplate: false },
    });
    router.push(`/instructor/courses/${created.id}`);
  };

  return (
    <AppShell allow={['instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-10">
        <h1 className="mb-2 font-display text-2xl font-semibold text-ink-900">Templates</h1>
        <p className="mb-6 text-sm text-neutral-600">
          Reusable course blueprints. Instantiate one into a fresh draft for a new cohort.
        </p>
        {loading ? (
          <p className="text-neutral-600">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-neutral-600">
            No templates yet. In the course builder, use “Save as template” to create one.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <li key={t.id} className="rounded-card border border-neutral-200 bg-surface-0 p-5">
                <h2 className="mb-1 font-display text-lg font-semibold text-ink-900">{t.title}</h2>
                <p className="mb-4 font-mono text-caption tabular-nums text-neutral-600">
                  {t.moduleCount} modules · {t.lessonCount} lessons
                </p>
                <Button size="sm" onClick={() => instantiateTemplate(t.id)}>
                  Use template
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  );
}
