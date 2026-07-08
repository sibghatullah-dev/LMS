'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { DataTable } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';

interface Certificate {
  id: string;
  studentId: string;
  courseId: string;
  verificationCode: string;
  issuedAt: string;
  finalGradePercent: number;
  downloadUrl: string;
}

export default function CertificatesPage() {
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);

  const load = useCallback(async () => {
    setCertificates(await authedFetch<Certificate[]>('/me/certificates'));
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell allow={['student', 'instructor', 'admin', 'super_admin', 'alumnus']}>
      <main className="mx-auto max-w-content px-4 py-6 sm:px-6">
        <div className="mb-5">
          <p className="text-caption font-semibold uppercase text-neutral-500">Credential record</p>
          <h1 className="text-2xl font-semibold text-ink-900">Certificates</h1>
          <p className="text-sm text-neutral-600">Download certificates and share verification codes.</p>
        </div>
        {!certificates ? (
          <div className="h-72 animate-pulse rounded-lg border border-neutral-200 bg-surface-0" />
        ) : (
          <DataTable
            rows={certificates}
            rowKey={(row) => row.id}
            emptyMessage="No certificates yet."
            columns={[
              { key: 'code', header: 'Verification code', cell: (row) => row.verificationCode },
              {
                key: 'grade',
                header: 'Grade',
                numeric: true,
                cell: (row) => `${row.finalGradePercent}%`,
              },
              {
                key: 'issued',
                header: 'Issued',
                cell: (row) => new Date(row.issuedAt).toLocaleDateString(),
              },
              {
                key: 'actions',
                header: '',
                cell: (row) => (
                  <div className="flex gap-3">
                    <a href={row.downloadUrl} className="text-sm font-semibold text-ink-900 underline">
                      Download
                    </a>
                    <a
                      href={`/certificates/verify/${row.verificationCode}`}
                      className="text-sm font-semibold text-ink-900 underline"
                    >
                      Verify
                    </a>
                  </div>
                ),
              },
            ]}
          />
        )}
      </main>
    </AppShell>
  );
}
