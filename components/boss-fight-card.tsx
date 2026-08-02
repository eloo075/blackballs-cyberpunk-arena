'use client';

import { motion } from 'framer-motion';
import {
  BOSS_OPPONENT_LEVEL,
  BOSS_REWARD_MULTIPLIER,
  BOSS_RETRY_COST,
  FREE_BOSS_ATTEMPTS,
  getDailyBossFighter,
} from '@/lib/competitive';
import { toBattleFighter } from '@/lib/effective-fighter';
import { FighterPortrait } from '@/components/fighter-portrait';
import { useCompetitive } from '@/hooks/use-competitive';
import { useWallet } from '@/lib/wallet-context';

interface BossFightCardProps {
  onChallengeBoss: (wager?: number) => void;
  disabled?: boolean;
}

export function BossFightCard({ onChallengeBoss, disabled }: BossFightCardProps) {
  const boss = getDailyBossFighter();
  const bossBattle = toBattleFighter(boss, BOSS_OPPONENT_LEVEL);
  const { state, canFightBoss } = useCompetitive();
  const { wallet } = useWallet();

  const freeLeft = Math.max(0, FREE_BOSS_ATTEMPTS - state.bossAttemptsToday);
  const needsPay = freeLeft === 0;
  const canFight = canFightBoss() && !disabled;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mb-4 cp-panel p-3 hud-corners relative overflow-hidden"
      style={{
        borderColor: `${boss.color}88`,
        boxShadow: `0 0 24px ${boss.glowColor}44`,
      }}
    >
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(circle at 30% 50%, ${boss.color}, transparent 60%)` }}
      />
      <div className="relative flex flex-col sm:flex-row gap-3 items-center">
        <div
          className="relative w-24 h-32 shrink-0 border-2 overflow-hidden"
          style={{ borderColor: boss.color }}
        >
          <FighterPortrait fighter={boss} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="text-[9px] text-cp-magenta font-black tracking-[0.3em]">⚠ DAILY BOSS</div>
          <div
            className="text-lg font-black"
            style={{ color: boss.color, fontFamily: 'Orbitron, sans-serif' }}
          >
            {boss.name}
          </div>
          <div className="text-[10px] text-white/50">
            LVL {BOSS_OPPONENT_LEVEL} · PWR {bossBattle.power} · {BOSS_REWARD_MULTIPLIER}x XP & coins
          </div>
          <div className="text-[9px] text-cp-yellow mt-1">
            {freeLeft > 0
              ? `${freeLeft} free attempt today`
              : `Retry costs ${BOSS_RETRY_COST} BlackBalls`}
            {!disabled ? '' : ' · Select your fighter first'}
          </div>
        </div>
        <button
          type="button"
          disabled={!canFight}
          onClick={() => onChallengeBoss()}
          className="cp-btn px-5 py-2.5 font-black text-xs tracking-wider disabled:opacity-40 shrink-0"
          style={{
            background: canFight ? boss.color : '#333',
            color: '#000',
            boxShadow: canFight ? `0 0 16px ${boss.glowColor}` : undefined,
          }}
        >
          {needsPay && wallet.blackballsBalance < BOSS_RETRY_COST ? `NEED 50 BlackBalls` : '⚔ BOSS FIGHT'}
        </button>
      </div>
    </motion.div>
  );
}
