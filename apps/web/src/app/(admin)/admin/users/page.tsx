'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { DataTable, StatusChip, toneForStatus, type Column } from '@/components/ui';
import { useAuthStore } from '@/lib/auth-store';
import { useSession } from '@/lib/use-session';
import { t } from '@/i18n';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export default function AdminUsersPage() {
  const { status } = useSession({ redirect: true, allow: ['admin', 'super_admin'] });
  const authedFetch = useAuthStore((s) => s.authedFetch);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch<{ users: AdminUser[]; total: number }>(
      '/admin/users?page=1&pageSize=50',
    );
    setUsers(data.users);
    setTotal(data.total);
    setLoading(false);
  }, [authedFetch]);

  useEffect(() => {
    if (status === 'authed') void load();
  }, [status, load]);

  const columns: Column<AdminUser>[] = [
    { key: 'name', header: t('admin.users.columnName'), cell: (u) => u.fullName },
    { key: 'email', header: t('admin.users.columnEmail'), cell: (u) => u.email },
    { key: 'role', header: t('admin.users.columnRole'), cell: (u) => u.role },
    {
      key: 'status',
      header: t('admin.users.columnStatus'),
      cell: (u) => <StatusChip label={u.status} tone={toneForStatus(u.status)} />,
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
