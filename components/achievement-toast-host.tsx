'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useCompetitive } from '@/hooks/use-competitive';

export function AchievementToastHost() {
  const { pendingAchievements, clearPendingAchievements } = useCompetitive();

  useEffect(() => {
    if (pendingAchievements.length === 0) return;
    const t = setTimeout(clearPendingAchievements, 4500);
    return () => clearTimeout(t);
  }, [pendingAchievements, clearPendingAchievements]);

  return (
    <div className="fixed top-16 right-3 z-[100] flex flex-col gap-2 pointer-events-none max-w-[280px]">
      <AnimatePresence>
        {pendingAchievements.map((ach, i) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ delay: i * 0.1 }}
            className="cp-panel p-3 border border-cp-yellow/50 bg-black/95 font-mono pointer-events-auto"
            style={{ boxShadow: '0 0 24px rgba(252,238,10,0.25)' }}
          >
            <div className="text-[8px] text-cp-yellow tracking-[0.25em] uppercase">Achievement Unlocked</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl">{ach.emoji}</span>
              <div>
                <div className="text-sm font-black text-white">{ach.label}</div>
                <div className="text-[9px] text-white/50">{ach.description}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
