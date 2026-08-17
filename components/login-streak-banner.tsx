'use client';

import { useEffect, useState } from 'react';
import { CURRENCY_LABEL } from '@/lib/format-currency';
import { tickLoginStreak } from '@/lib/player-retention';
import { useWallet } from '@/lib/wallet-context';

export function LoginStreakBanner() {
  const { wallet } = useWallet();
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet.connected || !wallet.address) return;
    const result = tickLoginStreak(wallet.address);
    setStreak(result.streak);
    if (result.isNew && result.rewardBb > 0) {
      setFlash(`Day ${result.streak} login`);
      const t = setTimeout(() => setFlash(null), 5000);
      return () => clearTimeout(t);
    }
  }, [wallet.connected, wallet.address]);

  if (!wallet.connected || streak < 1) return null;

  return (
    <div className="cp-panel px-3 py-2 text-xs font-bold font-arcade border border-amber-400/25 bg-amber-400/10">
      {flash ? (
        <span className="text-amber-200">{flash}</span>
      ) : (
        <span className="text-amber-300">
          🔥 Login streak: <span className="font-extrabold">{streak} days</span> — come back tomorrow for more {CURRENCY_LABEL}
        </span>
      )}
    </div>
  );
}
