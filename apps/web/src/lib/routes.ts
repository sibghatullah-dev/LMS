import type { SessionUser } from './auth-store';

/** Landing route for a role after sign-in (areas from UI/UX §3). */
export function dashboardPathFor(role: SessionUser['role']): string {
  switch (role) {
    case 'admin':
    case 'super_admin':
      return '/admin/dashboard';
    case 'instructor':
      return '/instructor/dashboard';
    case 'alumnus':
      return '/dashboard';
    default:
      return '/dashboard';
  }
}
