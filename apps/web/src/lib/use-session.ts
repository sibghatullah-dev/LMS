'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, type SessionUser } from './auth-store';

/**
 * Ensure a session is loaded (via the refresh cookie) on mount. When `redirect`
 * is set, sends unauthenticated users to /login and users without an allowed role
 * to their own dashboard. Client-side guard only — the API enforces RBAC
 * server-side regardless (NFR-SEC-03).
 */
export function useSession(opts: { redirect?: boolean; allow?: SessionUser['role'][] } = {}) {
  const router = useRouter();
  const { user, status, loadSession } = useAuthStore();

  useEffect(() => {
    if (status === 'unknown') void loadSession();
  }, [status, loadSession]);

  useEffect(() => {
    if (!opts.redirect) return;
    if (status === 'anon') router.replace('/login');
    else if (status === 'authed' && opts.allow && user && !opts.allow.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [status, user, opts.redirect, opts.allow, router]);

  return { user, status };
}
