'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAuthStore, type SessionUser } from '@/lib/auth-store';
import { useSession } from '@/lib/use-session';

interface NavLink {
  href: string;
  label: string;
}

const NAV: Record<SessionUser['role'], NavLink[]> = {
  student: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/catalog', label: 'Catalog' },
    { href: '/my-courses', label: 'My Courses' },
    { href: '/certificates', label: 'Certificates' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profile' },
  ],
  alumnus: [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/certificates', label: 'Certificates' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profile' },
  ],
  instructor: [
    { href: '/instructor/dashboard', label: 'Dashboard' },
    { href: '/instructor/courses', label: 'My Courses' },
    { href: '/instructor/templates', label: 'Templates' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profile' },
  ],
  admin: [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/courses', label: 'Approvals' },
    { href: '/admin/users', label: 'Users' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profile' },
  ],
  super_admin: [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/courses', label: 'Approvals' },
    { href: '/admin/users', label: 'Users' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/profile', label: 'Profile' },
  ],
};

/** Authenticated page shell: top nav (role-aware) + sign-out. Guards the page. */
export function AppShell({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: SessionUser['role'][];
}) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { user, status } = useSession({ redirect: true, allow });

  if (status !== 'authed' || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-600">Loading…</div>
    );
  }

  const links = NAV[user.role] ?? [];

  return (
    <div className="min-h-screen bg-paper-50">
      <header className="border-b border-neutral-200 bg-surface-0">
        <div className="mx-auto flex max-w-content items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display text-lg font-bold text-ink-900">
              Lumora
            </Link>
            <nav className="flex items-center gap-4">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm text-neutral-600 hover:text-ink-900"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-600 sm:inline">{user.fullName}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout();
                router.replace('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
