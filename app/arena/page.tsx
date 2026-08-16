import { redirect } from 'next/navigation';

/** Arena is disabled for Crash-only launch. */
export default function ArenaRedirect() {
  redirect('/');
}
