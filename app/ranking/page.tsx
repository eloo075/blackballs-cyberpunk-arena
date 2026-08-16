import { redirect } from 'next/navigation';

/** Ranking / XP board is disabled for Crash-only launch. */
export default function RankingRedirect() {
  redirect('/');
}
