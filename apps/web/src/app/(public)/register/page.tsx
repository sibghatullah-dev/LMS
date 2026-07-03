'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '@/components/auth-card';
import { Button, Field, SelectField } from '@/components/ui';
import { apiFetch, type ApiError } from '@/lib/api';
import { t } from '@/i18n';

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'student' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/auth/register', { method: 'POST', body: form });
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthCard title={t('auth.register.title')}>
        <p className="text-base text-ink-900">{t('auth.register.success')}</p>
        <Link href="/login" className="mt-4 inline-block font-medium text-ink-900">
          {t('auth.login.submit')}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('auth.register.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label={t('common.fullName')}
          name="fullName"
          required
          value={form.fullName}
          onChange={set('fullName')}
        />
        <Field
          label={t('common.email')}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
        />
        <Field
          label={t('common.password')}
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={set('password')}
        />
        <SelectField label={t('auth.register.role')} name="role" value={form.role} onChange={set('role')}>
          <option value="student">{t('auth.register.roleStudent')}</option>
          <option value="instructor">{t('auth.register.roleInstructor')}</option>
        </SelectField>
        {error && <p className="text-sm text-accent-alert">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t('common.loading') : t('auth.register.submit')}
        </Button>
      </form>
      <p className="mt-4 text-sm text-neutral-600">
        {t('auth.register.hasAccount')}{' '}
        <Link href="/login" className="font-medium text-ink-900">
          {t('auth.register.login')}
        </Link>
      </p>
    </AuthCard>
  );
}
