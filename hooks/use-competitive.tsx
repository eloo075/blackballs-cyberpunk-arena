'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ACHIEVEMENTS,
  arenaStreakMultiplier,
  DAILY_CHALLENGES,
  isMegaUpset,
  isUpset,
  todayKey,
  type Achievement,
} from '@/lib/competitive';
import { useWallet } from '@/lib/wallet-context';

export interface CompetitiveState {
  arenaWinStreak: number;
  bestArenaStreak: number;
  crashWinStreak: number;
  dailyKey: string;
  dailyProgress: Record<string, number>;
  dailyClaimed: string[];
  bossAttemptsToday: number;
  achievements: string[];
  totalArenaFights: number;
}

export interface ArenaBattleResult {
  won: boolean;
  playerPower: number;
  opponentPower: number;
  opponentId: string;
  isBoss: boolean;
}

const STORAGE_PREFIX = 'bb_competitive_';

const DEFAULT_STATE: CompetitiveState = {
  arenaWinStreak: 0,
  bestArenaStreak: 0,
  crashWinStreak: 0,
  dailyKey: todayKey(),
  dailyProgress: {},
  dailyClaimed: [],
  bossAttemptsToday: 0,
  achievements: [],
  totalArenaFights: 0,
};

function loadState(address: string | null): CompetitiveState {
  if (!address || typeof window === 'undefined') return { ...DEFAULT_STATE, dailyKey: todayKey() };
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + address);
    if (!raw) return { ...DEFAULT_STATE, dailyKey: todayKey() };
    const parsed = JSON.parse(raw) as CompetitiveState;
    if (parsed.dailyKey !== todayKey()) {
      return {
        ...parsed,
        dailyKey: todayKey(),
        dailyProgress: {},
        dailyClaimed: [],
        bossAttemptsToday: 0,
      };
    }
    return parsed;
  } catch {
    return { ...DEFAULT_STATE, dailyKey: todayKey() };
  }
}

function saveState(address: string, state: CompetitiveState) {
  localStorage.setItem(STORAGE_PREFIX + address, JSON.stringify(state));
}

interface CompetitiveContextValue {
  state: CompetitiveState;
  streakMultiplier: number;
  streakLabel: string | null;
  recordArenaBattle: (result: ArenaBattleResult) => string[];
  recordCrashResult: (won: boolean, exitMult: number) => string[];
  claimChallenge: (challengeId: string) => number;
  unlockAchievement: (id: string) => boolean;
  canFightBoss: () => boolean;
  recordBossAttempt: () => void;
  pendingAchievements: Achievement[];
  clearPendingAchievements: () => void;
}

const CompetitiveContext = createContext<CompetitiveContextValue | null>(null);

export function CompetitiveProvider({ children }: { children: ReactNode }) {
  const { wallet, addArenaXp } = useWallet();
  const [state, setState] = useState<CompetitiveState>(DEFAULT_STATE);
  const [pendingAchievements, setPendingAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    if (wallet.connected && wallet.address) {
      setState(loadState(wallet.address));
    } else {
      setState({ ...DEFAULT_STATE, dailyKey: todayKey() });
    }
  }, [wallet.connected, wallet.address]);

  const persist = useCallback(
    (next: CompetitiveState) => {
      setState(next);
      if (wallet.connected && wallet.address) saveState(wallet.address, next);
    },
    [wallet.address, wallet.connected],
  );

  const unlockAchievement = useCallback(
    (id: string): boolean => {
      if (state.achievements.includes(id)) return false;
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (!ach) return false;
      const next = { ...state, achievements: [...state.achievements, id] };
      persist(next);
      setPendingAchievements(prev => [...prev, ach]);
      return true;
    },
    [persist, state],
  );

  const recordArenaBattle = useCallback(
    (result: ArenaBattleResult): string[] => {
      const logs: string[] = [];
      const wasFirstFight = state.totalArenaFights === 0;
      let dailyProgress = { ...state.dailyProgress };
      dailyProgress.arena_grind_3 = (dailyProgress.arena_grind_3 ?? 0) + 1;

      let arenaWinStreak = state.arenaWinStreak;
      let bestArenaStreak = state.bestArenaStreak;

      if (result.won) {
        arenaWinStreak += 1;
        bestArenaStreak = Math.max(bestArenaStreak, arenaWinStreak);
        dailyProgress.arena_win_2 = (dailyProgress.arena_win_2 ?? 0) + 1;
        if (arenaWinStreak >= 3) dailyProgress.streak_3 = 1;

        const mult = arenaStreakMultiplier(arenaWinStreak);
        if (mult > 1) logs.push(`🔥 ${arenaWinStreak}-WIN STREAK · ${mult}x XP & coins`);

        if (isUpset(result.playerPower, result.opponentPower)) {
          dailyProgress.arena_upset = 1;
          logs.push('👑 UPSET BONUS — David beats Goliath!');
        }

        if (wasFirstFight) unlockAchievement('first_blood');
        if (arenaWinStreak >= 5) unlockAchievement('streak_5');
        if (arenaWinStreak >= 10) unlockAchievement('streak_10');
        if (result.isBoss) unlockAchievement('boss_slayer');
        if (result.opponentId === 'zog') unlockAchievement('whale_hunter');
        if (isMegaUpset(result.playerPower, result.opponentPower)) unlockAchievement('upset_king');
      } else {
        arenaWinStreak = 0;
        logs.push('💀 Streak broken — run it back');
      }

      const totalArenaFights = state.totalArenaFights + 1;
      if (totalArenaFights >= 100) unlockAchievement('degen_100');

      persist({
        ...state,
        arenaWinStreak,
        bestArenaStreak,
        dailyProgress,
        totalArenaFights,
      });
      return logs;
    },
    [persist, state, unlockAchievement],
  );

  const recordCrashResult = useCallback(
    (won: boolean, exitMult: number): string[] => {
      const logs: string[] = [];
      let next = { ...state };

      if (won) {
        next.crashWinStreak = state.crashWinStreak + 1;
        if (exitMult >= 2) {
          next.dailyProgress = {
            ...next.dailyProgress,
            crash_2x: (next.dailyProgress.crash_2x ?? 0) + 1,
          };
          logs.push('✅ Daily: 2x+ cashout progress');
        }
        if (exitMult >= 10) unlockAchievement('crash_moon');
        if (next.crashWinStreak >= 3) {
          logs.push(`📈 Crash streak ${next.crashWinStreak} — degen momentum`);
        }
      } else {
        next.crashWinStreak = 0;
      }

      persist(next);
      return logs;
    },
    [persist, state, unlockAchievement],
  );

  const claimChallenge = useCallback(
    (challengeId: string): number => {
      const challenge = DAILY_CHALLENGES.find(c => c.id === challengeId);
      if (!challenge || state.dailyClaimed.includes(challengeId)) return 0;
      const progress = state.dailyProgress[challengeId] ?? 0;
      if (progress < challenge.target) return 0;

      persist({ ...state, dailyClaimed: [...state.dailyClaimed, challengeId] });
      addArenaXp(challenge.xpReward);
      return challenge.xpReward;
    },
    [addArenaXp, persist, state],
  );

  const canFightBoss = useCallback(
    () => state.bossAttemptsToday < 1 || wallet.blackballsBalance >= 50,
    [state.bossAttemptsToday, wallet.blackballsBalance],
  );

  const recordBossAttempt = useCallback(() => {
    persist({ ...state, bossAttemptsToday: state.bossAttemptsToday + 1 });
  }, [persist, state]);

  const clearPendingAchievements = useCallback(() => setPendingAchievements([]), []);

  const streakMultiplier = arenaStreakMultiplier(state.arenaWinStreak);
  const streakLabelValue =
    state.arenaWinStreak >= 10
      ? 'UNSTOPPABLE'
      : state.arenaWinStreak >= 5
        ? 'ON FIRE'
        : state.arenaWinStreak >= 3
          ? 'HEATING UP'
          : null;

  const value = useMemo<CompetitiveContextValue>(
    () => ({
      state,
      streakMultiplier,
      streakLabel: streakLabelValue,
      recordArenaBattle,
      recordCrashResult,
      claimChallenge,
      unlockAchievement,
      canFightBoss,
      recordBossAttempt,
      pendingAchievements,
      clearPendingAchievements,
    }),
    [
      canFightBoss,
      claimChallenge,
      clearPendingAchievements,
      pendingAchievements,
      recordArenaBattle,
      recordCrashResult,
      recordBossAttempt,
      state,
      streakLabelValue,
      streakMultiplier,
      unlockAchievement,
    ],
  );

  return <CompetitiveContext.Provider value={value}>{children}</CompetitiveContext.Provider>;
}

export function useCompetitive() {
  const ctx = useContext(CompetitiveContext);
  if (!ctx) throw new Error('useCompetitive must be used within CompetitiveProvider');
  return ctx;
}
