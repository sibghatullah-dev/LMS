'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import {
  Button,
  DataTable,
  Field,
  SelectField,
  StatusChip,
  toneForStatus,
  type Column,
} from '@/components/ui';
import type { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useSession } from '@/lib/use-session';
import { t } from '@/i18n';

const roles = ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] as const;
type Role = (typeof roles)[number];

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: string;
}

interface CreateUserForm {
  fullName: string;
  email: string;
  role: Role;
  password: string;
}

export default function AdminUsersPage() {
  const { status } = useSession({ redirect: true, allow: ['admin', 'super_admin'] });
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<CreateUserForm>({
    fullName: '',
    email: '',
    role: 'student',
    password: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authedFetch<{ users: AdminUser[]; total: number }>(
        '/admin/users?page=1&pageSize=50',
      );
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError((err as ApiError).message ?? 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (status === 'authed') void load();
  }, [status, load]);

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      };
      await authedFetch<AdminUser>('/admin/users', { method: 'POST', body });
      setForm({ fullName: '', email: '', role: 'student', password: '' });
      setMessage('User created.');
      await load();
    } catch (err) {
      setError((err as ApiError).message ?? 'Unable to create user.');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (user: AdminUser, role: Role) => {
    if (role === user.role) return;
    setActionUserId(user.id);
    setError('');
    setMessage('');
    try {
      await authedFetch<AdminUser>(`/admin/users/${user.id}/role`, {
        method: 'PATCH',
        body: { role },
      });
      setMessage('Role updated.');
      await load();
    } catch (err) {
      setError((err as ApiError).message ?? 'Unable to update role.');
    } finally {
      setActionUserId(null);
    }
  };

  const deactivateUser = async (user: AdminUser) => {
    setActionUserId(user.id);
    setError('');
    setMessage('');
    try {
      await authedFetch<AdminUser>(`/admin/users/${user.id}/deactivate`, { method: 'POST' });
      setMessage('User deactivated.');
      await load();
    } catch (err) {
      setError((err as ApiError).message ?? 'Unable to deactivate user.');
    } finally {
      setActionUserId(null);
    }
  };

  const columns: Column<AdminUser>[] = [
    { key: 'name', header: t('admin.users.columnName'), cell: (u) => u.fullName },
    { key: 'email', header: t('admin.users.columnEmail'), cell: (u) => u.email },
    {
      key: 'role',
      header: t('admin.users.columnRole'),
      cell: (u) => (
        <select
          aria-label={`Role for ${u.email}`}
          className="h-8 rounded-card border border-neutral-200 bg-surface-0 px-2 text-sm text-ink-900"
          value={u.role}
          disabled={u.id === currentUser?.id || actionUserId === u.id}
          onChange={(event) => void changeRole(u, event.target.value as Role)}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'status',
      header: t('admin.users.columnStatus'),
      cell: (u) => <StatusChip label={u.status} tone={toneForStatus(u.status)} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (u) => (
        <Button
          size="sm"
          variant="destructive"
          disabled={
            u.status === 'deactivated' ||
            u.role === 'super_admin' ||
            u.id === currentUser?.id ||
            actionUserId === u.id
          }
          onClick={() => void deactivateUser(u)}
        >
          Deactivate
        </Button>
      ),
    },
  ];

  return (
    <AppShell allow={['admin', 'super_admin']}>
      <main className="mx-auto max-w-content px-6 py-12">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-semibold text-ink-900">
            {t('admin.users.title')}
          </h1>
          <span className="font-mono text-sm tabular-nums text-neutral-600">{total} users</span>
        </div>
        <form
          className="mb-6 grid gap-4 rounded-card border border-neutral-200 bg-surface-0 p-4 md:grid-cols-[1fr_1fr_180px_1fr_auto]"
          onSubmit={createUser}
        >
          <Field
            label="Full name"
            name="fullName"
            value={form.fullName}
            onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            required
          />
          <Field
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            required
          />
          <SelectField
            label="Role"
            name="role"
            value={form.role}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value as Role }))}
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </SelectField>
          <Field
            label="Initial password"
            name="password"
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Optional"
          />
          <Button className="self-end" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </form>
        {error && <p className="mb-4 text-sm text-accent-alert">{error}</p>}
        {message && <p className="mb-4 text-sm text-accent-success">{message}</p>}
        {loading ? (
          <p className="text-neutral-600">{t('common.loading')}</p>
        ) : (
          <DataTable
            columns={columns}
            rows={users}
            rowKey={(u) => u.id}
            emptyMessage={t('admin.users.empty')}
          />
        )}
      </main>
    </AppShell>
  );
}
