import { LeaderboardView } from '@/components/leaderboard-view';
import Link from 'next/link';

export default function RankingPage() {
  return (
    <div className="min-h-screen bg-[#141518] py-4">
      <div className="max-w-[1100px] mx-auto px-3 mb-2">
        <Link href="/" className="text-[11px] font-extrabold text-sky-400/80 hover:text-sky-300">
          ← Crash
        </Link>
      </div>
      <LeaderboardView />
    </div>
  );
}
