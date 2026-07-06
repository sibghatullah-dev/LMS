import { redirect } from 'next/navigation';

/** Root entry: send users directly into the auth flow. */
export default function HomePage() {
  redirect('/login');
}
