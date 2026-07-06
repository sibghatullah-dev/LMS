'use client';

import { useEffect, useState } from 'react';
import { AuthCard } from '@/components/auth-card';
import { AppShell } from '@/components/app-shell';
import { Button, Field } from '@/components/ui';
import { API_BASE } from '@/lib/api';
import { useAuthStore, type SessionUser } from '@/lib/auth-store';
import { useSession } from '@/lib/use-session';
import { t } from '@/i18n';

export default function ProfilePage() {
  const { user, status } = useSession({ redirect: true });
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState('');
  const [prefs, setPrefs] = useState({ email: true, inApp: true, sms: false });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [eraseConfirmation, setEraseConfirmation] = useState('');
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPrefs(user.notificationPreferences);
    }
  }, [user]);

  if (status !== 'authed' || !user) {
    return (
      <AuthCard title={t('profile.title')}>
        <p className="text-neutral-600">{t('common.loading')}</p>
      </AuthCard>
    );
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    const updated = await authedFetch<SessionUser>('/users/me', {
      method: 'PATCH',
      body: { fullName, notificationPreferences: prefs },
    });
    setUser(updated);
    setSaved(true);
    setBusy(false);
  };

  const exportData = async () => {
    setPrivacyError(null);
    const res = await fetch(`${API_BASE}/me/privacy/export`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) {
      setPrivacyError('Could not export data.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumora-data-export-${user.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const eraseAccount = async () => {
    setPrivacyError(null);
    try {
      await authedFetch('/me/privacy/erase', {
        method: 'POST',
        body: { confirmation: eraseConfirmation },
      });
      await logout();
      window.location.href = '/login';
    } catch (e) {
      setPrivacyError((e as { message?: string }).message ?? 'Could not erase account.');
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-6 py-8">
        <section className="rounded-card border border-neutral-200 bg-surface-0 p-6 sm:p-8">
          <h1 className="mb-6 font-display text-2xl font-semibold text-ink-900">{t('profile.title')}</h1>
          <form onSubmit={onSave} className="flex flex-col gap-4">
            <Field label={t('common.fullName')} name="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Field label={t('common.email')} name="email" value={user.email} disabled />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-ink-900">
                {t('profile.notifications')}
              </legend>
              {(['email', 'inApp', 'sms'] as const).map((ch) => (
                <label key={ch} className="flex items-center gap-2 text-sm text-ink-900">
                  <input
                    type="checkbox"
                    checked={prefs[ch]}
                    onChange={(e) => setPrefs((p) => ({ ...p, [ch]: e.target.checked }))}
                  />
                  {t(`profile.channel${ch === 'inApp' ? 'InApp' : ch === 'sms' ? 'Sms' : 'Email'}`)}
                </label>
              ))}
            </fieldset>

            {saved && <p className="text-sm text-accent-live">{t('profile.saved')}</p>}
            <Button type="submit" disabled={busy}>
              {busy ? t('common.loading') : t('common.save')}
            </Button>
          </form>

          <section className="mt-8 border-t border-neutral-200 pt-5">
            <h2 className="font-display text-lg font-semibold text-ink-900">Privacy</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Export your account data or deactivate and scrub direct personal details.
            </p>
            {privacyError && <p className="mt-3 text-sm text-accent-alert">{privacyError}</p>}
            <div className="mt-4 flex flex-col gap-3">
              <Button variant="secondary" onClick={exportData}>
                Export my data
              </Button>
              <Field
                label="Type ERASE to deactivate and scrub this account"
                value={eraseConfirmation}
                onChange={(e) => setEraseConfirmation(e.target.value)}
              />
              <Button
                variant="destructive"
                disabled={eraseConfirmation !== 'ERASE'}
                onClick={eraseAccount}
              >
                Erase account
              </Button>
            </div>
          </section>
        </section>
      </main>
    </AppShell>
  );
}
