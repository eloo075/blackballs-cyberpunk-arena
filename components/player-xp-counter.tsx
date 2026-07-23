'use client';

import { motion } from 'framer-motion';
import { xpProgress } from '@/lib/arena-rewards';
import { useWallet } from '@/lib/wallet-context';

interface PlayerXpCounterProps {
  variant?: 'compact' | 'full';
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

  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-2 min-w-0 px-2 py-1 border border-cp-yellow/25 bg-black/60 ${className}`}
        title={`${prog.xpToNextRank.toLocaleString()} XP to ${prog.isMaxRank ? 'max rank' : prog.nextRankTitle}`}
      >
        <span className="text-[10px] shrink-0">⭐</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[9px] font-black text-cp-yellow truncate">{wallet.xp.toLocaleString()} XP</span>
            <span className="text-[8px] font-bold text-cp-cyan shrink-0">{prog.rankTitle}</span>
          </div>
          <div className="h-1 mt-0.5 bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cp-yellow to-cp-cyan"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ boxShadow: '0 0 6px rgba(252,238,10,0.5)' }}
            />
          </div>
        </div>
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
