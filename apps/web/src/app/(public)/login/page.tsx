'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthCard } from '@/components/auth-card';
import { Button, Field } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import { dashboardPathFor } from '@/lib/routes';
import { t } from '@/i18n';
import type { ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      const role = useAuthStore.getState().user!.role;
      router.push(dashboardPathFor(role));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t('auth.login.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label={t('common.email')}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={t('common.password')}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-accent-alert">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t('common.loading') : t('auth.login.submit')}
        </Button>
      </form>
      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-neutral-600 hover:text-ink-900">
          {t('auth.login.forgot')}
        </Link>
        <span className="text-neutral-600">
          {t('auth.login.noAccount')}{' '}
          <Link href="/register" className="font-medium text-ink-900">
            {t('auth.login.register')}
          </Link>
        </span>
      </div>
    </AuthCard>
  );
}
