'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '@/components/auth-card';
import { Button, Field } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { t } from '@/i18n';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Always resolves to the same message (no account enumeration).
    await apiFetch('/auth/password-reset/request', { method: 'POST', body: { email } }).catch(
      () => undefined,
    );
    setSent(true);
    setBusy(false);
  };

  return (
    <AuthCard title={t('auth.forgot.title')}>
      {sent ? (
        <>
          <p className="text-ink-900">{t('auth.forgot.sent')}</p>
          <Link href="/login" className="mt-4 inline-block font-medium text-ink-900">
            {t('auth.login.submit')}
          </Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">{t('auth.forgot.instructions')}</p>
          <Field
            label={t('common.email')}
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t('common.loading') : t('auth.forgot.submit')}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
