'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Certificate {
  id: string;
  studentId: string;
  courseId: string;
  verificationCode: string;
  issuedAt: string;
  finalGradePercent: number;
  downloadUrl: string;
}

export default function VerifyCertificatePage() {
  const params = useParams<{ verificationCode: string }>();
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/certificates/verify/${params.verificationCode}`);
    if (!res.ok) {
      setError('No valid certificate found for this code.');
      return;
    }
    setCertificate(await res.json());
  }, [params.verificationCode]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-paper-50 px-6 py-10">
      <section className="mx-auto max-w-2xl rounded-lg border border-neutral-200 bg-surface-0 p-8">
        <Link href="/" className="text-lg font-bold text-ink-900">
          Lumora
        </Link>
        <h1 className="mt-6 text-2xl font-semibold text-ink-900">
          Certificate verification
        </h1>
        {error ? (
          <p className="mt-4 text-accent-alert">{error}</p>
        ) : !certificate ? (
          <p className="mt-4 text-neutral-600">Checking certificate…</p>
        ) : (
          <div className="mt-6 grid gap-3 text-sm">
            <p>
              <span className="font-medium text-ink-900">Status:</span> Valid
            </p>
            <p>
              <span className="font-medium text-ink-900">Verification code:</span>{' '}
              <span className="font-mono">{certificate.verificationCode}</span>
            </p>
            <p>
              <span className="font-medium text-ink-900">Issued:</span>{' '}
              {new Date(certificate.issuedAt).toLocaleDateString()}
            </p>
            <p>
              <span className="font-medium text-ink-900">Final grade:</span>{' '}
              {certificate.finalGradePercent}%
            </p>
            <a href={certificate.downloadUrl} className="mt-3 text-sm font-medium text-ink-900 underline">
              Download certificate
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
