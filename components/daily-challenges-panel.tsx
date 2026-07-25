'use client';

import { DAILY_CHALLENGES } from '@/lib/competitive';
import { useCompetitive } from '@/hooks/use-competitive';

export function DailyChallengesPanel() {
  const { state, claimChallenge } = useCompetitive();

  return (
    <div className="cp-panel overflow-hidden font-arcade">
      <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/5">
        <div className="text-sm font-extrabold text-white/85">Daily Challenges</div>
        <div className="text-[10px] text-white/40 font-bold mt-0.5">Complete tasks for bonus XP</div>
      </div>
      <div className="p-3 space-y-2">
        {DAILY_CHALLENGES.map(ch => {
          const progress = Math.min(ch.target, state.dailyProgress[ch.id] ?? 0);
          const claimed = state.dailyClaimed.includes(ch.id);
          const ready = !claimed && progress >= ch.target;
          const pct = Math.round((progress / ch.target) * 100);

          return (
            <div
              key={ch.id}
              className={`p-2.5 rounded-xl bg-[#25262c] border ${
                ready ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-white/80 font-bold">{ch.label}</div>
                <div className="text-[10px] text-amber-300 shrink-0 font-extrabold">+{ch.xpReward} XP</div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-2 rounded-full bg-[#2a2c33] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-600 to-amber-400 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-white/40 w-10 text-right font-extrabold tabular-nums">
                  {progress}/{ch.target}
                </span>
              </div>
              {ready && (
                <button
                  type="button"
                  onClick={() => claimChallenge(ch.id)}
                  className="mt-2 w-full py-1.5 text-[11px] font-extrabold bg-amber-500 hover:bg-amber-400 text-black rounded-lg border-b-[3px] border-amber-700 active:border-b-0 active:translate-y-0.5 transition-all"
                >
                  Claim Reward
                </button>
              )}
              {claimed && (
                <div className="mt-1.5 text-[10px] text-emerald-400 text-center font-extrabold">✓ Claimed</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
