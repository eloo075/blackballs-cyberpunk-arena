'use client';

import { useState } from 'react';
import { CHALLENGE_COST_BB } from '@/lib/competitive';
import { CURRENCY_LABEL } from '@/lib/format-currency';

const MOCK_TARGETS = [
  { name: '7BxK...3mPq', rank: 'CHAD', power: 420 },
  { name: '9Lam...8vRt', rank: 'WHALE', power: 580 },
  { name: 'H8nK...2xWq', rank: 'APE', power: 310 },
  { name: '2QaZ...9pLm', rank: 'DEGEN', power: 195 },
];

interface ArenaChallengePanelProps {
  balance: number;
  disabled?: boolean;
  onChallenge: (targetName: string, targetPower: number) => void;
}

export function ArenaChallengePanel({ balance, disabled, onChallenge }: ArenaChallengePanelProps) {
  const [selected, setSelected] = useState(0);
  const target = MOCK_TARGETS[selected];
  const canAfford = balance >= CHALLENGE_COST_BB;

  return (
    <div className="cp-panel px-3 py-2 mb-3 border border-amber-400/30">
      <div className="text-[9px] text-amber-300/80 uppercase tracking-wider mb-2 font-black">
        ⚔️ Challenge a Player · {CHALLENGE_COST_BB} {CURRENCY_LABEL}
      </div>
      <div className="flex gap-1 overflow-x-auto mb-2">
        {MOCK_TARGETS.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setSelected(i)}
            className={`shrink-0 px-2 py-1 text-[10px] font-bold border rounded-lg ${
              i === selected
                ? 'bg-amber-400/20 text-amber-200 border-amber-400/50'
                : 'text-white/45 border-white/10'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-white/55 mb-2">
        {target.name} · {target.rank} · PWR {target.power}
      </div>
      <button
        type="button"
        disabled={disabled || !canAfford}
        onClick={() => onChallenge(target.name, target.power)}
        className="w-full py-2 text-xs font-black bg-amber-400 text-black rounded-xl border-b-4 border-amber-600 active:border-b-0 disabled:opacity-40"
      >
        CHALLENGE FOR {CHALLENGE_COST_BB} {CURRENCY_LABEL}
      </button>
    </div>
  );
}
