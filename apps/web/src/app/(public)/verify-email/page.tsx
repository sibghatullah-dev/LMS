'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '@/components/auth-card';
import { apiFetch } from '@/lib/api';
import { t } from '@/i18n';

function VerifyEmailInner() {
  const params = useSearchParams();
  const [state, setState] = useState<'verifying' | 'success' | 'failed'>('verifying');

  useEffect(() => {
    const uid = params.get('uid');
    const token = params.get('token');
    if (!uid || !token) {
      setState('failed');
      return;
    }
    apiFetch('/auth/verify-email', { method: 'POST', body: { userId: uid, token } })
      .then(() => setState('success'))
      .catch(() => setState('failed'));
  }, [params]);

  return (
    <AuthCard title={t('auth.verify.title')}>
      {state === 'verifying' && <p className="text-neutral-600">{t('auth.verify.verifying')}</p>}
      {state === 'success' && <p className="text-ink-900">{t('auth.verify.success')}</p>}
      {state === 'failed' && <p className="text-accent-alert">{t('auth.verify.failed')}</p>}
      {state !== 'verifying' && (
        <Link href="/login" className="mt-4 inline-block font-medium text-ink-900">
          {t('auth.verify.goToLogin')}
        </Link>
      )}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthCard title={t('auth.verify.title')}><p>{t('common.loading')}</p></AuthCard>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
