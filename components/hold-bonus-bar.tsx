'use client';

import type { ActiveBonus } from '@/lib/hold-bonuses';

interface HoldBonusBarProps {
  active: ActiveBonus[];
  compact?: boolean;
  className?: string;
}

const TOKEN_COLOR: Record<ActiveBonus['token'], string> = {
  BLACKBALLS: '#9d00ff',
  ANSEM: '#fcee0a',
  CASHCAT: '#00ff9c',
};

export function HoldBonusBar({ active, compact = false, className = '' }: HoldBonusBarProps) {
  if (active.length === 0) {
    return (
      <div className={`cp-panel px-2.5 py-2 font-mono text-[9px] text-white/35 ${className}`}>
        {compact ? 'NO HOLD BONUSES' : '// HOLD $BLACKBALLS · $ANSEM · $CASHCAT FOR POWER BOOSTS'}
      </div>
    );
  }

  return (
    <div className={`cp-panel px-2.5 py-2 font-mono ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[9px] uppercase tracking-wider text-white/40">Hold Bonuses Active</span>
        {!compact && (
          <span className="text-[9px] text-cp-green">
            {active.filter(b => b.type === 'stimmy').length > 0 &&
              `Stimmy +${Math.round(active.filter(b => b.type === 'stimmy').reduce((s, b) => s + b.rate, 0) * 100)}%`}
            {active.some(b => b.type === 'stimmy') && active.some(b => b.type === 'frenzy') && ' · '}
            {active.some(b => b.type === 'frenzy') &&
              `Frenzy +${Math.round(active.find(b => b.type === 'frenzy')!.rate * 100)}%`}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {active.map(b => (
          <span
            key={b.token}
            className="text-[9px] sm:text-[10px] font-black px-2 py-1 border"
            style={{
              color: TOKEN_COLOR[b.token],
              borderColor: TOKEN_COLOR[b.token] + '66',
              background: TOKEN_COLOR[b.token] + '15',
              boxShadow: `0 0 8px ${TOKEN_COLOR[b.token]}33`,
            }}
          >
            ${b.token} · {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
