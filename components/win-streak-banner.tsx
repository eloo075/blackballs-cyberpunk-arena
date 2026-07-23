'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { arenaStreakMultiplier } from '@/lib/competitive';
import { useCompetitive } from '@/hooks/use-competitive';

export function WinStreakBanner() {
  const { state, streakLabel } = useCompetitive();
  const streak = state.arenaWinStreak;

  if (streak < 2) return null;

  const mult = arenaStreakMultiplier(streak);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 cp-panel px-3 py-2 flex items-center justify-between gap-3 border border-cp-magenta/40"
        style={{
          background: 'linear-gradient(90deg, rgba(255,0,60,0.12), rgba(252,238,10,0.08))',
          boxShadow: streak >= 5 ? '0 0 20px rgba(255,0,60,0.3)' : undefined,
        }}
      >
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="text-xl"
          >
            🔥
          </motion.span>
          <div>
            <div className="text-[11px] font-black text-cp-magenta tracking-wider">
              {streak} WIN STREAK {streakLabel ? `· ${streakLabel}` : ''}
            </div>
            <div className="text-[9px] text-white/40">
              Best: {state.bestArenaStreak} · {mult}x rewards on next win
            </div>
          </div>
        </div>
        <div
          className="text-lg font-black px-2 py-1 border"
          style={{ color: '#fcee0a', borderColor: '#fcee0a66', fontFamily: 'Orbitron, sans-serif' }}
        >
          {mult}x
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
