'use client';

import { DAILY_CHALLENGES } from '@/lib/competitive';
import { useCompetitive } from '@/hooks/use-competitive';

export function DailyChallengesPanel() {
  const { state, claimChallenge } = useCompetitive();

  return (
    <div className="cp-panel p-3 hud-corners">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] neon-yellow mb-2">
        DAILY CHALLENGES
      </div>
      <div className="space-y-2">
        {DAILY_CHALLENGES.map(ch => {
          const progress = Math.min(ch.target, state.dailyProgress[ch.id] ?? 0);
          const claimed = state.dailyClaimed.includes(ch.id);
          const ready = !claimed && progress >= ch.target;
          const pct = Math.round((progress / ch.target) * 100);

          return (
            <div
              key={ch.id}
              className="p-2 bg-black/30 border border-cp-cyan/10"
              style={ready ? { borderColor: '#fcee0a88' } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] text-white/80">{ch.label}</div>
                <div className="text-[9px] text-cp-yellow shrink-0">+{ch.xpReward} XP</div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1 bg-black/50 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cp-cyan to-cp-yellow"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[8px] text-white/40 w-8 text-right">
                  {progress}/{ch.target}
                </span>
              </div>
              {ready && (
                <button
                  type="button"
                  onClick={() => claimChallenge(ch.id)}
                  className="mt-2 w-full py-1 text-[9px] font-black bg-cp-yellow/20 text-cp-yellow border border-cp-yellow/50 hover:bg-cp-yellow/30"
                >
                  CLAIM REWARD
                </button>
              )}
              {claimed && (
                <div className="mt-1 text-[8px] text-cp-green text-center">✓ CLAIMED</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
