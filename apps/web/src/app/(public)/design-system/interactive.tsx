'use client';

import { useState } from 'react';
import { Button, DataTable, Toaster, useToast, type Column } from '@/components/ui';

interface DemoRow {
  id: string;
  student: string;
  assignment: string;
  score: number;
}

const ROWS: DemoRow[] = [
  { id: 'r1', student: 'Sara Ahmed', assignment: 'Essay: Ch.4', score: 92 },
  { id: 'r2', student: 'James Osei', assignment: 'Quiz 3', score: 88 },
  { id: 'r3', student: 'Mona Farouk', assignment: 'Project 1', score: 74 },
];

const COLUMNS: Column<DemoRow>[] = [
  { key: 'student', header: 'Student', cell: (r) => r.student },
  { key: 'assignment', header: 'Assignment', cell: (r) => r.assignment },
  { key: 'score', header: 'Score', numeric: true, cell: (r) => `${r.score}%` },
];

/** Interactive portion of the design-system demo (Buttons → Toast, table selection). */
export function DesignSystemInteractive() {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = (keys: string[]) =>
    setSelected((prev) => (prev.size === keys.length ? new Set() : new Set(keys)));

  return (
    <>
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-ink-900">Buttons (§2.5)</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => toast('Published', 'live')}>Primary — Publish</Button>
          <Button variant="secondary" onClick={() => toast('Draft saved')}>
            Secondary
          </Button>
          <Button variant="destructive" onClick={() => toast('Course rejected', 'alert')}>
            Destructive
          </Button>
          <Button variant="ghost" onClick={() => toast('Noted')}>
            Ghost
          </Button>
          <Button disabled>Disabled</Button>
        </div>
        <p className="mt-2 text-caption text-neutral-600">
          Clicking a button raises a toast (bottom-right), announced via an aria-live region.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-ink-900">
          Data Table with bulk-select (§2.5)
        </h2>
        <DataTable
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          selection={{ selectedKeys: selected, onToggle: toggle, onToggleAll: toggleAll }}
        />
        <p className="mt-2 text-caption text-neutral-600">{selected.size} selected</p>
      </section>

      <Toaster />
    </>
  );
}
