'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Button, DataTable, Field, StatusChip, type Column } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import type { AttendanceRecord } from '@/lib/course-types';

export default function AttendancePage() {
  const params = useParams<{ sessionId: string }>();
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [reason, setReason] = useState('Manual attendance correction');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setRecords(await authedFetch<AttendanceRecord[]>(`/live-sessions/${params.sessionId}/attendance`));
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load attendance.');
    }
  }, [authedFetch, params.sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mark = async (record: AttendanceRecord, present: boolean) => {
    setBusyId(record.id);
    setError('');
    try {
      await authedFetch(`/attendance/${record.id}`, {
        method: 'PATCH',
        body: {
          present,
          durationSeconds: present ? Math.max(record.durationSeconds, 1) : 0,
          source: 'manual',
          overrideReason: reason,
        },
      });
      await load();
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not update attendance.');
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'student',
      header: 'Student',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.studentName ?? row.studentId}</p>
          {row.studentEmail && <p className="text-caption text-neutral-600">{row.studentEmail}</p>}
        </div>
      ),
    },
    {
      key: 'present',
      header: 'Present',
      cell: (row) => (
        <StatusChip label={row.present ? 'present' : 'absent'} tone={row.present ? 'live' : 'neutral'} />
      ),
    },
    {
      key: 'duration',
      header: 'Minutes',
      numeric: true,
      cell: (row) => Math.round((row.durationSeconds ?? 0) / 60),
    },
    { key: 'source', header: 'Source', cell: (row) => row.source },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex gap-2">
          <Button size="sm" disabled={busyId === row.id} onClick={() => void mark(row, true)}>
            Mark present
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busyId === row.id}
            onClick={() => void mark(row, false)}
          >
            Mark absent
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell allow={['instructor', 'admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-8">
        <Link href="/instructor/courses" className="text-sm text-neutral-600">
          Back to courses
        </Link>
        <div className="mb-6 mt-2">
          <h1 className="font-display text-2xl font-semibold text-ink-900">Attendance</h1>
          <p className="text-sm text-neutral-600">Manual overrides are written to the audit log.</p>
        </div>
        <div className="mb-4 max-w-xl">
          <Field label="Override reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}
        <DataTable
          columns={columns}
          rows={records}
          rowKey={(record) => record.id}
          emptyMessage="No learners found for this session."
        />
      </main>
    </AppShell>
  );
}
