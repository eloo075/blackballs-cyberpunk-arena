'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MAX_FIGHTER_LEVEL, scaleFighterStats } from '@/lib/arena-rewards';
import { computeUnlockCostFromPower, formatUnlockCost, getFighterUnlockRequirement, isFreeFighter } from '@/lib/fighter-unlocks';
import { FIGHTERS, RARITY_COLOR, type Fighter } from '@/lib/fighters';
import { FighterPortrait } from '@/components/fighter-portrait';
import { useFighterProgress } from '@/hooks/use-fighter-progress';
import { useFighterUnlocks } from '@/hooks/use-fighter-unlocks';

interface FighterSelectionProps {
  selectedFighterId?: string | null;
  onSelectFighter: (fighter: Fighter) => void;
}

export function FighterSelection({ selectedFighterId, onSelectFighter }: FighterSelectionProps) {
  const [modalFighter, setModalFighter] = useState<Fighter | null>(null);
  const { blackballsBalance, checkUnlocked } = useFighterUnlocks();
  const { getProgress, levelUpFighter, levelUpCost, canLevelUp } = useFighterProgress();

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {FIGHTERS.map((fighter, i) => {
          const required = getFighterUnlockRequirement(fighter);
          const unlocked = checkUnlocked(fighter);
          const isLocked = !unlocked;
          const selected = selectedFighterId === fighter.id;
          const prog = getProgress(fighter.id);
          const scaled = scaleFighterStats(fighter, prog.level);

          return (
            <motion.button
              key={fighter.id}
              type="button"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 220 }}
              whileHover={isLocked ? undefined : { scale: 1.04, y: -6 }}
              whileTap={isLocked ? undefined : { scale: 0.97 }}
              onClick={() => setModalFighter(fighter)}
              className={`group relative text-left rounded-sm overflow-hidden transition-shadow ${
                isLocked ? 'cursor-not-allowed' : 'cursor-pointer'
              } ${selected ? 'ring-2 ring-white/80' : ''}`}
              style={{
                border: `2px solid ${fighter.color}`,
                boxShadow: selected
                  ? `0 0 24px ${fighter.glowColor}, 0 0 48px ${fighter.glowColor}44`
                  : `0 0 12px ${fighter.glowColor}66, 0 4px 20px rgba(0,0,0,0.6)`,
              }}
            >
              <div className={`relative aspect-[3/4] bg-[#050714] overflow-hidden ${isLocked ? 'grayscale-[0.55] brightness-75' : ''}`}>
                <FighterPortrait fighter={fighter} />

                <div
                  className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-black tracking-wider bg-black/75 border"
                  style={{ color: fighter.color, borderColor: `${fighter.color}88` }}
                >
                  PWR {scaled.power}
                </div>

                <div
                  className="absolute top-2 right-2 text-[7px] font-black uppercase px-1 py-0.5 bg-black/75 border"
                  style={{
                    color: RARITY_COLOR[fighter.rarity],
                    borderColor: `${RARITY_COLOR[fighter.rarity]}66`,
                  }}
                >
                  {fighter.rarity}
                </div>

                {!isLocked && prog.level > 1 && (
                  <div className="absolute bottom-2 left-2 px-1.5 py-0.5 text-[8px] font-black bg-cp-yellow/90 text-black">
                    LVL {prog.level}
                  </div>
                )}

                {isLocked && (
                  <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center p-2">
                    <span className="text-2xl mb-1">🔒</span>
                    <span className="text-[10px] font-black text-white/90 tracking-widest">LOCKED</span>
                    <span className="text-[9px] text-cp-yellow mt-1 text-center">
                      {formatUnlockCost(required ?? computeUnlockCostFromPower(fighter.power))} $BlackBalls
                    </span>
                  </div>
                )}
              </div>

              <div
                className="px-2 py-1.5 text-center border-t-2 bg-black/90"
                style={{ borderColor: fighter.color }}
              >
                <div
                  className="text-[11px] sm:text-xs font-black tracking-wide truncate"
                  style={{ color: fighter.color, fontFamily: 'Orbitron, sans-serif' }}
                >
                  {fighter.name}
                </div>
                <div className="text-[8px] text-white/40 truncate">{fighter.title}</div>
              </div>

              {/* Stat bars */}
              <div className="px-2 py-1.5 grid grid-cols-4 gap-1 border-t bg-black/95" style={{ borderColor: `${fighter.color}22` }}>
                {([['ATK', scaled.atk], ['HP', scaled.hp], ['SPD', scaled.spd], ['LCK', scaled.luck]] as const).map(
                  ([label, val]) => (
                    <div key={label} className="text-center">
                      <div className="text-[7px] text-white/30">{label}</div>
                      <div className="text-[9px] font-bold" style={{ color: fighter.color }}>{val}</div>
                      <div className="h-0.5 mt-0.5 bg-white/10 overflow-hidden rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${val}%`, background: fighter.color }} />
                      </div>
                    </div>
                  ),
                )}
              </div>

              {isFreeFighter(fighter) ? (
                <div
                  className="py-1 text-center text-[9px] font-bold border-t bg-black/95"
                  style={{ borderColor: `${fighter.color}44`, color: fighter.color }}
                >
                  FREE · LVL {prog.level}
                </div>
              ) : (
                <div
                  className="flex items-center justify-center gap-1 py-1 text-[9px] font-bold border-t bg-black/95"
                  style={{ borderColor: `${fighter.color}44`, color: isLocked ? '#fcee0a' : fighter.color }}
                >
                  {isLocked ? '🔒' : '✓'} {required?.toLocaleString()} $BlackBalls
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-white/40 text-center font-mono">
        Balance: {blackballsBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $BlackBalls ·
        Only 2 weakest fighters free · Unlock cost = power³ × 25
      </p>

      <AnimatePresence>
        {modalFighter && (
          <FighterSelectModal
            fighter={modalFighter}
            blackballsBalance={blackballsBalance}
            unlocked={checkUnlocked(modalFighter)}
            required={getFighterUnlockRequirement(modalFighter)}
            progress={getProgress(modalFighter.id)}
            canLevelUp={canLevelUp(modalFighter.id)}
            levelUpCost={levelUpCost(getProgress(modalFighter.id).level)}
            onLevelUp={() => levelUpFighter(modalFighter.id)}
            onClose={() => setModalFighter(null)}
            onSelect={() => {
              if (!checkUnlocked(modalFighter)) return;
              onSelectFighter(modalFighter);
              setModalFighter(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FighterSelectModal({
  fighter: f,
  blackballsBalance,
  unlocked,
  required,
  progress,
  canLevelUp,
  levelUpCost,
  onLevelUp,
  onClose,
  onSelect,
}: {
  fighter: Fighter;
  blackballsBalance: number;
  unlocked: boolean;
  required: number | null;
  progress: { level: number; coins: number; wins: number };
  canLevelUp: boolean;
  levelUpCost: number;
  onLevelUp: () => void;
  onClose: () => void;
  onSelect: () => void;
}) {
  const scaled = scaleFighterStats(f, progress.level);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="max-w-sm w-full overflow-hidden font-mono max-h-[90vh] overflow-y-auto"
        style={{ border: `2px solid ${f.color}`, boxShadow: `0 0 40px ${f.glowColor}88` }}
      >
        <div className={`relative aspect-[3/4] bg-[#050714] overflow-hidden ${!unlocked ? 'grayscale-[0.5] brightness-75' : ''}`}>
          <FighterPortrait fighter={f} />
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-7 h-7 bg-black/80 border border-white/20 text-white/60 hover:text-cp-magenta text-sm z-10"
          >
            ×
          </button>
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black via-black/90 to-transparent">
            <div className="text-lg font-black" style={{ color: f.color, fontFamily: 'Orbitron, sans-serif' }}>
              {f.name}
            </div>
            <div className="text-[10px] text-white/50">{f.title}</div>
            <div className="text-[9px] text-cp-yellow mt-1">LVL {progress.level} · {progress.wins} arena wins</div>
          </div>
        </div>

        <div className="p-4 bg-black/95 border-t-2" style={{ borderColor: f.color }}>
          <div className="grid grid-cols-5 gap-2 text-center mb-3">
            {[['PWR', scaled.power], ['ATK', scaled.atk], ['HP', scaled.hp], ['SPD', scaled.spd], ['LCK', scaled.luck]].map(
              ([label, value]) => (
                <div key={label}>
                  <div className="text-[8px] text-white/30">{label}</div>
                  <div className="text-sm font-bold" style={{ color: f.color }}>
                    {value}
                  </div>
                </div>
              ),
            )}
          </div>

          {unlocked && (
            <div className="mb-3 p-2 border border-cp-cyan/30 bg-cp-cyan/5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/50">Fight coins</span>
                <span className="font-bold text-cp-cyan">{progress.coins.toLocaleString()} 🪙</span>
              </div>
              <div className="text-[9px] text-white/30 mt-1">Win battles to earn coins · spend to level up</div>
              {progress.level < MAX_FIGHTER_LEVEL && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onLevelUp();
                  }}
                  disabled={!canLevelUp}
                  className="mt-2 w-full py-1.5 text-[10px] font-black border disabled:opacity-40"
                  style={{
                    borderColor: canLevelUp ? f.color : '#444',
                    color: canLevelUp ? f.color : '#666',
                  }}
                >
                  {canLevelUp
                    ? `⬆ LEVEL UP (${levelUpCost.toLocaleString()} coins)`
                    : `⬆ NEED ${levelUpCost.toLocaleString()} coins`}
                </button>
              )}
            </div>
          )}

          <div className="text-[10px] text-cp-yellow/80 mb-1">{f.buff.label}</div>
          <p className="text-[10px] text-white/50 leading-relaxed mb-2">{f.lore}</p>

          {!unlocked && required != null && (
            <div className="mb-3 p-2 border border-cp-yellow/40 bg-cp-yellow/5 text-[11px] text-cp-yellow text-center">
              🔒 Requires {formatUnlockCost(required)} $BlackBalls (power {f.power})
              <div className="text-[9px] text-white/40 mt-1">
                You have {blackballsBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          )}

          <button
            onClick={onSelect}
            disabled={!unlocked}
            className="w-full py-2.5 font-black text-sm tracking-wider disabled:opacity-40 transition-all"
            style={{
              background: unlocked ? f.color : '#222',
              color: unlocked ? '#000' : '#666',
              boxShadow: unlocked ? `0 0 20px ${f.glowColor}` : undefined,
            }}
          >
            {unlocked ? 'SELECT FOR ARENA' : `LOCKED — ${required?.toLocaleString()} $BlackBalls`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
