'use client';
import { motion } from 'framer-motion';
import { RANK_TITLES, XP_PER_RANK } from '@/lib/arena-rewards';
import { ACHIEVEMENTS } from '@/lib/competitive';
import { useCompetitive } from '@/hooks/use-competitive';
import { useWallet } from '@/lib/wallet-context';
import { PlayerXpCounter } from '@/components/player-xp-counter';

interface Entry {
  rank: number;
  address: string;
  xp: number;
  wins: number;
  crashes: number;
  best: number;
  blackballs: number;
  isYou?: boolean;
}

const NAMES = ['7BxK...3mPq', '9Lam...8vRt', '3Fde...2xWq', 'H8nK...9pLm', '2QaZ...7nDf', '5VkL...1mNb', 'J4pX...8cVg', '6RtY...3qWe', 'K9mN...5bXc', '1ZxV...4pLk', '8GfD...7mJk', '4HbV...2qWx', 'T5nM...9cXd', '7YgF...3pLz', '2RkM...8vBn'];

const RANK_PILL: Record<string, string> = {
  WHALE: 'bg-purple-900/60 text-purple-300 border border-purple-500/40',
  LEGEND: 'bg-amber-900/60 text-amber-200 border border-amber-400/50',
  CHAD: 'bg-orange-900/60 text-orange-300 border border-orange-500/40',
  APE: 'bg-amber-900/60 text-amber-300 border border-amber-500/40',
  DEGEN: 'bg-rose-900/60 text-rose-300 border border-rose-500/40',
  NPC: 'bg-zinc-800 text-zinc-400 border border-zinc-600/40',
};

const PODIUM: Record<
  number,
  { label: string; height: string; card: string; badge: string; glow: string }
> = {
  1: {
    label: '#01 CHAMPION',
    height: 'h-28 sm:h-32',
    card: 'bg-gradient-to-b from-amber-500/20 via-[#1f2025] to-[#1f2025] border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]',
    badge: 'bg-amber-400 text-black',
    glow: 'text-amber-400',
  },
  2: {
    label: '#02 RUNNER-UP',
    height: 'h-20 sm:h-24',
    card: 'bg-gradient-to-b from-slate-400/20 via-[#1f2025] to-[#1f2025] border-2 border-slate-300 shadow-[0_0_20px_rgba(203,213,225,0.15)]',
    badge: 'bg-slate-300 text-black',
    glow: 'text-slate-300',
  },
  3: {
    label: '#03 THIRD',
    height: 'h-20 sm:h-24',
    card: 'bg-gradient-to-b from-amber-700/20 via-[#1f2025] to-[#1f2025] border-2 border-amber-600 shadow-[0_0_18px_rgba(217,119,6,0.2)]',
    badge: 'bg-amber-600 text-black',
    glow: 'text-amber-500',
  },
};

function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildMockEntries(): Entry[] {
  return NAMES.map((addr, i) => ({
    rank: i + 1,
    address: addr,
    xp: Math.floor(48000 / (i + 1) + seeded(i, 1) * 2000),
    wins: Math.floor(500 / (i + 1) + seeded(i, 2) * 50),
    crashes: Math.floor(300 / (i + 1) + seeded(i, 3) * 80),
    best: parseFloat((seeded(i, 4) * 20 + 2).toFixed(2)),
    blackballs: parseFloat((seeded(i, 5) * 1500 + 250).toFixed(1)),
  }));
}

function mergePlayerEntry(entries: Entry[], wallet: ReturnType<typeof useWallet>['wallet']): Entry[] {
  if (!wallet.connected || !wallet.address) {
    return entries.sort((a, b) => b.xp - a.xp).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  const shortAddr =
    wallet.address.length > 12
      ? `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`
      : wallet.address;

  const withoutDup = entries.filter(e => e.address !== shortAddr && e.address !== wallet.address);
  const playerEntry: Entry = {
    rank: 0,
    address: shortAddr,
    xp: wallet.xp,
    wins: wallet.arenaWins,
    crashes: wallet.arenaLosses,
    best: 1,
    blackballs: wallet.blackballsBalance,
    isYou: true,
  };

  return [...withoutDup, playerEntry]
    .sort((a, b) => b.xp - a.xp)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

function RankPill({ title }: { title: string }) {
  const style = RANK_PILL[title] ?? RANK_PILL.NPC;
  return (
    <span className={`inline-flex text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${style}`}>
      {title}
    </span>
  );
}

export function LeaderboardView() {
  const { wallet } = useWallet();
  const { state: compState } = useCompetitive();
  const data = mergePlayerEntry(buildMockEntries(), wallet);

  return (
    <div className="p-2 sm:p-3 max-w-[1700px] mx-auto w-full font-arcade">
      <PlayerXpCounter className="mb-3" />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">Ranking</h2>
          {!wallet.connected && (
            <p className="text-xs text-white/45 mt-1 font-bold">Connect and win arena fights to appear on the leaderboard.</p>
          )}
        </div>
        <div className="mobile-scroll-x flex gap-2 text-xs pb-1">
          {['Season 01', 'All Time', 'Weekly'].map((t, i) => (
            <button
              key={t}
              className={`touch-manipulation touch-target px-3 py-2 font-extrabold rounded-xl shrink-0 transition-colors ${
                i === 0
                  ? 'bg-amber-500 text-black border-b-[3px] border-amber-700'
                  : 'bg-[#2a2c33] text-white/50 border border-white/10 hover:text-white/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 max-w-lg mx-auto items-end">
        {[2, 1, 3].map((r, i) => {
          const e = data[r - 1];
          if (!e) return null;
          const pod = PODIUM[r];
          return (
            <motion.div
              key={r}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center"
            >
              <div className={`mb-2 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold ${pod.badge}`}>
                {pod.label}
              </div>
              <div className={`w-full ${pod.height} rounded-2xl flex flex-col items-center justify-center px-2 ${pod.card}`}>
                <div className="text-[11px] text-white/70 font-bold truncate max-w-full">
                  {e.isYou ? 'YOU' : e.address}
                </div>
                <div className={`text-lg sm:text-xl font-extrabold tabular-nums ${pod.glow}`}>
                  {e.xp.toLocaleString('en-US')}
                </div>
                <div className="text-[10px] text-white/40 font-bold">XP</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="cp-panel overflow-hidden mobile-scroll-x">
        <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/5">
          <span className="text-sm font-extrabold text-white/80">Leaderboard</span>
        </div>
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/40 font-extrabold">
              <th className="text-left px-3 py-2.5">#</th>
              <th className="text-left px-3 py-2.5">Address</th>
              <th className="text-right px-3 py-2.5">Rank</th>
              <th className="text-right px-3 py-2.5">XP</th>
              <th className="text-right px-3 py-2.5 hidden sm:table-cell">Arena W</th>
              <th className="text-right px-3 py-2.5 hidden sm:table-cell">Arena L</th>
              <th className="text-right px-3 py-2.5">Best</th>
              <th className="text-right px-3 py-2.5">BlackBalls</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e, i) => {
              const rankTitle = RANK_TITLES[Math.min(Math.floor(e.xp / XP_PER_RANK), RANK_TITLES.length - 1)];
              const isTop3 = e.rank <= 3;
              return (
                <motion.tr
                  key={`${e.address}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-b border-white/5 hover:bg-white/[0.03] ${
                    isTop3 ? 'bg-amber-500/[0.04]' : ''
                  } ${e.isYou ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500/25' : ''}`}
                >
                  <td className="px-3 py-2.5">
                    <span className={`font-extrabold ${isTop3 ? 'text-amber-400' : 'text-white/40'}`}>{e.rank}</span>
                  </td>
                  <td className="px-3 py-2.5 text-white/70 font-bold">{e.isYou ? `${e.address} (YOU)` : e.address}</td>
                  <td className="px-3 py-2.5 text-right">
                    <RankPill title={rankTitle} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-amber-300 tabular-nums">
                    {e.xp.toLocaleString('en-US')}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/55 hidden sm:table-cell font-bold">{e.wins}</td>
                  <td className="px-3 py-2.5 text-right text-white/55 hidden sm:table-cell font-bold">{e.crashes}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`font-extrabold ${
                        e.best >= 10 ? 'text-cyan-400' : e.best >= 5 ? 'text-emerald-400' : 'text-white/55'
                      }`}
                    >
                      {e.best.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-sky-400 tabular-nums">
                    {e.blackballs.toFixed(1)}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-white/35 text-center font-bold">
        Win arena fights to earn XP · Stronger opponents = more XP · Climb from NPC → LEGEND
      </p>

      <div className="mt-4 cp-panel overflow-hidden">
        <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/5">
          <div className="text-sm font-extrabold text-white/80">
            Achievements ({compState.achievements.length}/{ACHIEVEMENTS.length})
          </div>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {ACHIEVEMENTS.map(a => {
            const unlocked = compState.achievements.includes(a.id);
            return (
              <div
                key={a.id}
                title={a.description}
                className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full border ${
                  unlocked
                    ? 'border-amber-400/40 text-amber-300 bg-amber-400/10'
                    : 'border-white/10 text-white/25 bg-[#2a2c33]'
                }`}
              >
                {unlocked ? a.emoji : '🔒'} {a.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
