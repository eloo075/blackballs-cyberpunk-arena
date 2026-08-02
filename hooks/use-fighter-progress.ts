'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { canLevelUp, levelUpCoinCost, MAX_FIGHTER_LEVEL } from '@/lib/arena-rewards';
import { statPointsAvailable } from '@/lib/fighter-build';
import { useWallet } from '@/lib/wallet-context';

export interface FighterProgress {
  level: number;
  coins: number;
  wins: number;
  stats?: { atk: number; hp: number; spd: number; luck: number };
}

export type FighterProgressMap = Record<string, FighterProgress>;

const STORAGE_PREFIX = 'bb_fighter_progress_';

function defaultProgress(): FighterProgress {
  return { level: 1, coins: 0, wins: 0, stats: { atk: 0, hp: 0, spd: 0, luck: 0 } };
}

function loadProgress(address: string | null): FighterProgressMap {
  if (!address || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + address);
    return raw ? (JSON.parse(raw) as FighterProgressMap) : {};
  } catch {
    return {};
  }
}

function saveProgress(address: string, map: FighterProgressMap) {
  localStorage.setItem(STORAGE_PREFIX + address, JSON.stringify(map));
}

export function useFighterProgress() {
  const { wallet } = useWallet();
  const [progress, setProgress] = useState<FighterProgressMap>({});

  useEffect(() => {
    if (wallet.connected && wallet.address) {
      setProgress(loadProgress(wallet.address));
    } else {
      setProgress({});
    }
  }, [wallet.connected, wallet.address]);

  const persist = useCallback(
    (next: FighterProgressMap) => {
      setProgress(next);
      if (wallet.connected && wallet.address) {
        saveProgress(wallet.address, next);
      }
    },
    [wallet.address, wallet.connected],
  );

  const getProgress = useCallback(
    (fighterId: string): FighterProgress => progress[fighterId] ?? defaultProgress(),
    [progress],
  );

  const addBattleReward = useCallback(
    (fighterId: string, coins: number, won: boolean) => {
      persist({
        ...progress,
        [fighterId]: {
          ...(progress[fighterId] ?? defaultProgress()),
          coins: (progress[fighterId]?.coins ?? 0) + coins,
          wins: (progress[fighterId]?.wins ?? 0) + (won ? 1 : 0),
        },
      });
    },
    [persist, progress],
  );

  const levelUpFighter = useCallback(
    (fighterId: string): boolean => {
      const current = progress[fighterId] ?? defaultProgress();
      if (!canLevelUp(current.level, current.coins)) return false;
      const cost = levelUpCoinCost(current.level);
      persist({
        ...progress,
        [fighterId]: {
          ...current,
          level: Math.min(MAX_FIGHTER_LEVEL, current.level + 1),
          coins: current.coins - cost,
          stats: current.stats ?? { atk: 0, hp: 0, spd: 0, luck: 0 },
        },
      });
      return true;
    },
    [persist, progress],
  );

  const allocateStat = useCallback(
    (fighterId: string, stat: 'atk' | 'hp' | 'spd' | 'luck'): boolean => {
      const current = progress[fighterId] ?? defaultProgress();
      const stats = current.stats ?? { atk: 0, hp: 0, spd: 0, luck: 0 };
      if (statPointsAvailable(current.level, stats) <= 0) return false;
      persist({
        ...progress,
        [fighterId]: {
          ...current,
          stats: { ...stats, [stat]: stats[stat] + 1 },
        },
      });
      return true;
    },
    [persist, progress],
  );

  return useMemo(
    () => ({
      getProgress,
      addBattleReward,
      levelUpFighter,
      allocateStat,
      levelUpCost: levelUpCoinCost,
      canLevelUp: (fighterId: string) => {
        const p = getProgress(fighterId);
        return canLevelUp(p.level, p.coins);
      },
    }),
    [addBattleReward, allocateStat, getProgress, levelUpFighter],
  );
}
