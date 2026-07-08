'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAuthStore, type SessionUser } from '@/lib/auth-store';
import { useSession } from '@/lib/use-session';

interface NavLink {
  href: string;
  label: string;
  marker: string;
}

const NAV: Record<SessionUser['role'], NavLink[]> = {
  student: [
    { href: '/dashboard', label: 'Dashboard', marker: 'DB' },
    { href: '/catalog', label: 'Catalog', marker: 'CT' },
    { href: '/my-courses', label: 'My Courses', marker: 'MC' },
    { href: '/messages', label: 'Messages', marker: 'MS' },
    { href: '/events', label: 'Events', marker: 'EV' },
    { href: '/badges', label: 'Badges', marker: 'BD' },
    { href: '/certificates', label: 'Certificates', marker: 'CF' },
    { href: '/notifications', label: 'Notifications', marker: 'NT' },
    { href: '/profile', label: 'Profile', marker: 'PR' },
  ],
  alumnus: [
    { href: '/dashboard', label: 'Dashboard', marker: 'DB' },
    { href: '/messages', label: 'Messages', marker: 'MS' },
    { href: '/events', label: 'Events', marker: 'EV' },
    { href: '/badges', label: 'Badges', marker: 'BD' },
    { href: '/certificates', label: 'Certificates', marker: 'CF' },
    { href: '/notifications', label: 'Notifications', marker: 'NT' },
    { href: '/profile', label: 'Profile', marker: 'PR' },
  ],
  instructor: [
    { href: '/instructor/dashboard', label: 'Dashboard', marker: 'DB' },
    { href: '/instructor/courses', label: 'My Courses', marker: 'CR' },
    { href: '/instructor/templates', label: 'Templates', marker: 'TP' },
    { href: '/messages', label: 'Messages', marker: 'MS' },
    { href: '/events', label: 'Events', marker: 'EV' },
    { href: '/notifications', label: 'Notifications', marker: 'NT' },
    { href: '/profile', label: 'Profile', marker: 'PR' },
  ],
  admin: [
    { href: '/admin/dashboard', label: 'Dashboard', marker: 'DB' },
    { href: '/admin/courses', label: 'Approvals', marker: 'AP' },
    { href: '/admin/users', label: 'Users', marker: 'US' },
    { href: '/messages', label: 'Messages', marker: 'MS' },
    { href: '/events', label: 'Events', marker: 'EV' },
    { href: '/notifications', label: 'Notifications', marker: 'NT' },
    { href: '/profile', label: 'Profile', marker: 'PR' },
  ],
  super_admin: [
    { href: '/admin/dashboard', label: 'Dashboard', marker: 'DB' },
    { href: '/admin/courses', label: 'Approvals', marker: 'AP' },
    { href: '/admin/users', label: 'Users', marker: 'US' },
    { href: '/messages', label: 'Messages', marker: 'MS' },
    { href: '/events', label: 'Events', marker: 'EV' },
    { href: '/notifications', label: 'Notifications', marker: 'NT' },
    { href: '/profile', label: 'Profile', marker: 'PR' },
  ],
};

export function AppShell({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: SessionUser['role'][];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);
  const { user, status } = useSession({ redirect: true, allow });

  if (status !== 'authed' || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-600">Loading…</div>
    );
  }

  const links = NAV[user.role] ?? [];
  const roleLabel = user.role.replace('_', ' ');

  return (
    <div className="min-h-screen bg-paper-50 text-ink-900 lg:flex">
      <aside className="hidden w-sidebar shrink-0 border-r border-neutral-200 bg-surface-0 lg:flex lg:min-h-screen lg:flex-col">
        <div className="border-b border-neutral-200 px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-ink-900 text-sm font-semibold text-white">
              L
            </span>
            <span>
              <span className="block text-lg font-semibold leading-6">Lumora</span>
              <span className="block text-caption font-semibold uppercase text-neutral-500">
                Operations
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'group flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-neutral-600',
                  active && 'bg-paper-100 text-ink-900 shadow-[inset_3px_0_0_#0F172A]',
                  !active && 'hover:bg-paper-100 hover:text-ink-900',
                )}
              >
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded border border-neutral-200 bg-white text-[10px] font-semibold text-neutral-500',
                    active && 'border-ink-900 bg-ink-900 text-white',
                  )}
                >
                  {link.marker}
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-neutral-200 p-4">
          <div className="mb-3 rounded-md bg-paper-100 p-3">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="text-caption font-semibold uppercase text-neutral-500">{roleLabel}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-neutral-200 bg-surface-0/95 backdrop-blur">
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold lg:hidden">
              <span className="grid size-8 place-items-center rounded-md bg-ink-900 text-sm text-white">
                L
              </span>
              Lumora
            </Link>
            <div className="hidden min-w-0 lg:block">
              <p className="text-caption font-semibold uppercase text-neutral-500">Workspace</p>
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
            </div>
            <div className="hidden flex-1 overflow-x-auto md:block lg:hidden">
              <nav className="flex items-center gap-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                    className={cn(
                      'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-neutral-600',
                      (pathname === l.href || pathname.startsWith(`${l.href}/`)) &&
                        'bg-paper-100 text-ink-900',
                    )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-neutral-600 sm:inline">{roleLabel}</span>
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
    </div>
  );
}
