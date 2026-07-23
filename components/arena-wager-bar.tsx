'use client';

import { WAGER_OPTIONS } from '@/lib/competitive';

interface ArenaWagerBarProps {
  wager: number;
  onWagerChange: (amount: number) => void;
  balance: number;
  disabled?: boolean;
}

export function ArenaWagerBar({ wager, onWagerChange, balance, disabled }: ArenaWagerBarProps) {
  return (
    <div className="cp-panel px-3 py-2 mb-3 border border-cp-purple/30">
      <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2">
        Optional Wager · Win = 2x back + loot · Lose = lose wager
      </div>
      <div className="flex flex-wrap gap-2">
        {WAGER_OPTIONS.map(amount => {
          const active = wager === amount;
          const tooHigh = amount > balance;
          return (
            <button
              key={amount}
              type="button"
              disabled={disabled || (amount > 0 && tooHigh)}
              onClick={() => onWagerChange(amount)}
              className={`px-3 py-1.5 text-[10px] font-black border transition-all disabled:opacity-30 ${
                active ? 'bg-cp-purple/30 text-cp-purple border-cp-purple' : 'text-white/50 border-white/10 hover:border-cp-cyan/40'
              }`}
            >
              {amount === 0 ? 'NO BET' : `${amount} BB`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
