'use client';

import { motion } from 'framer-motion';
import { xpProgress } from '@/lib/arena-rewards';
import { useWallet } from '@/lib/wallet-context';

interface PlayerXpCounterProps {
  variant?: 'compact' | 'full' | 'nav';
  className?: string;
}

export function PlayerXpCounter({ variant = 'full', className = '' }: PlayerXpCounterProps) {
  const { wallet } = useWallet();

  if (!wallet.connected) {
    return (
      <div className={`cp-panel px-3 py-2 text-[10px] text-white/40 ${className}`}>
        Connect wallet to track XP and climb the ranking.
      </div>
    );
  }

  const prog = xpProgress(wallet.xp);
  const pct = Math.round(prog.progress * 100);

  if (variant === 'nav') {
    return (
      <div
        className={`nav-xp-chip flex items-center gap-2.5 min-w-0 shrink-0 ${className}`}
        title={`${prog.xpToNextRank.toLocaleString()} XP to ${prog.isMaxRank ? 'max rank' : prog.nextRankTitle}`}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[12px] font-black text-white tracking-wide whitespace-nowrap tabular-nums leading-none">
            {wallet.xp.toLocaleString('en-US')}{' '}
            <span className="text-amber-300/80 text-[10px] font-extrabold">XP</span>
          </span>
          <div className="w-[72px] h-1 bg-black/40 rounded-full overflow-hidden border border-white/[0.06]">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.55)]"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
        <span className="nav-rank-badge shrink-0">{prog.rankTitle}</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`bg-[#0e1015] border border-white/[0.08] rounded-lg px-2.5 py-1.5 flex items-center gap-2.5 min-w-0 shrink-0 ${className}`}
        title={`${prog.xpToNextRank.toLocaleString()} XP to ${prog.isMaxRank ? 'max rank' : prog.nextRankTitle}`}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-extrabold text-white/85 tracking-wide whitespace-nowrap tabular-nums">
            {wallet.xp.toLocaleString('en-US')} XP
          </span>
          <div className="w-20 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>
        <span className="bg-sky-500/10 text-sky-300 border border-sky-500/25 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider shrink-0">
          {prog.rankTitle}
        </span>
      </div>
    );
  }

  const nextLabel = prog.isMaxRank
    ? 'MAX RANK'
    : `${prog.xpToNextRank.toLocaleString()} XP → ${prog.nextRankTitle}`;

  return (
    <div className={`cp-panel p-3 hud-corners border-cp-yellow/30 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-[9px] text-white/40 uppercase tracking-widest">Player XP</div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span
              className="text-xl font-black text-cp-yellow"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              {wallet.xp.toLocaleString()}
            </span>
            <span className="text-[10px] text-white/40">XP</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-white/40 uppercase tracking-widest">Rank</div>
          <div
            className="text-sm font-black text-cp-cyan mt-0.5"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {prog.rankTitle}
          </div>
        </div>
      </div>

      <div className="relative h-2 bg-white/10 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cp-yellow via-cp-yellow to-cp-cyan"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ boxShadow: '0 0 10px rgba(252,238,10,0.45)' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-black/70 mix-blend-screen">
          {pct}%
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-2 text-[9px] text-white/45">
        <span>{nextLabel}</span>
        <span>
          Arena{' '}
          <span className="text-cp-green font-bold">{wallet.arenaWins}W</span>
          {' / '}
          <span className="text-cp-magenta">{wallet.arenaLosses}L</span>
        </span>
      </div>
    </div>
  );
}
