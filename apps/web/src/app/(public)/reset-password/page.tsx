'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '@/components/auth-card';
import { Button, Field } from '@/components/ui';
import { apiFetch, type ApiError } from '@/lib/api';
import { t } from '@/i18n';

function ResetPasswordInner() {
  const params = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/auth/password-reset/confirm', {
        method: 'POST',
        body: { userId: params.get('uid'), token: params.get('token'), newPassword },
      });
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthCard title={t('auth.reset.title')}>
        <p className="text-ink-900">{t('auth.reset.success')}</p>
        <Link href="/login" className="mt-4 inline-block font-medium text-ink-900">
          {t('auth.login.submit')}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.reset.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label={t('auth.reset.newPassword')}
          type="password"
          name="newPassword"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error && <p className="text-sm text-accent-alert">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t('common.loading') : t('auth.reset.submit')}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCard title={t('auth.reset.title')}><p>{t('common.loading')}</p></AuthCard>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
