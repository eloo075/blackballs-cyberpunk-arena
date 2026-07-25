'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MAX_FIGHTER_LEVEL, scaleFighterStats } from '@/lib/arena-rewards';
import { computeUnlockCostFromPower, formatUnlockCost, getFighterUnlockRequirement, isFreeFighter } from '@/lib/fighter-unlocks';
import { FIGHTERS, type Fighter, type Rarity } from '@/lib/fighters';
import { FighterArt } from '@/components/fighter-art';
import { useFighterProgress } from '@/hooks/use-fighter-progress';
import { useFighterUnlocks } from '@/hooks/use-fighter-unlocks';

const STAT_BAR: Record<string, string> = {
  ATK: 'bg-gradient-to-r from-rose-600 to-red-400',
  HP: 'bg-gradient-to-r from-emerald-600 to-green-400',
  SPD: 'bg-gradient-to-r from-cyan-600 to-blue-400',
  LCK: 'bg-gradient-to-r from-amber-500 to-yellow-300',
};

const STAT_BAR_MODAL: Record<string, string> = {
  PWR: 'bg-gradient-to-r from-violet-600 to-purple-400',
  ...STAT_BAR,
};

const FIGHTER_BACKDROP: Record<string, string> = {
  pepe_prime: 'bg-gradient-to-b from-emerald-900/60 to-teal-950/80',
  based_frog: 'bg-gradient-to-b from-emerald-900/60 to-teal-950/80',
  street_rat: 'bg-gradient-to-b from-zinc-800 to-stone-900',
  giga_chad: 'bg-gradient-to-b from-amber-700/50 to-red-950/80',
  wojak: 'bg-gradient-to-b from-purple-900/60 to-slate-950',
  bullx: 'bg-gradient-to-b from-orange-600/60 to-yellow-950/80',
  dogelord: 'bg-gradient-to-b from-sky-900/50 to-blue-950/80',
  mewtrix: 'bg-gradient-to-b from-purple-900/50 to-fuchsia-950/80',
  diamond_degen: 'bg-gradient-to-b from-cyan-800/40 to-slate-950',
  pingu: 'bg-gradient-to-b from-cyan-700/40 to-indigo-950/80',
  rug_reaper: 'bg-gradient-to-b from-violet-900/60 to-black',
  zog: 'bg-gradient-to-b from-fuchsia-700/50 to-purple-950/80',
};

const RARITY_STYLE: Record<Rarity, { card: string; badge: string }> = {
  COMMON: {
    card: 'border-slate-700/50',
    badge: 'bg-slate-800/90 text-slate-300 border border-slate-600/50',
  },
  RARE: {
    card: 'border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
    badge: 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]',
  },
  EPIC: {
    card: 'border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    badge: 'bg-purple-950/90 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.25)]',
  },
  LEGENDARY: {
    card: 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.25)]',
    badge: 'bg-amber-950/90 text-amber-200 border border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.3)]',
  },
};

function FighterArtSlot({
  fighter,
  locked = false,
  tall = false,
}: {
  fighter: Fighter;
  locked?: boolean;
  tall?: boolean;
}) {
  const backdrop = FIGHTER_BACKDROP[fighter.id] ?? 'bg-gradient-to-b from-zinc-800 to-stone-900';
  return (
    <div
      className={`relative w-full overflow-hidden ${tall ? 'h-52' : 'h-44 sm:h-48'} ${backdrop} ${
        locked ? 'brightness-[0.55] saturate-[0.65]' : ''
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(255,255,255,0.08),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-0 flex items-end justify-center pb-1 transition-transform duration-300 group-hover:scale-105">
        <div className="relative w-[88%] max-w-[148px] aspect-[3/4]">
          <FighterArt
            fighterId={fighter.id}
            glowColor={fighter.glowColor}
            locked={locked}
            fill
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}

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
              whileHover={isLocked ? undefined : { scale: 1.03, y: -4 }}
              whileTap={isLocked ? undefined : { scale: 0.98 }}
              onClick={() => setModalFighter(fighter)}
              className={`group relative text-left rounded-2xl overflow-hidden bg-[#1f2025] border-2 transition-transform ${
                RARITY_STYLE[fighter.rarity].card
              } ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} ${
                selected ? 'ring-2 ring-amber-400/50 ring-offset-2 ring-offset-[#141518]' : ''
              }`}
            >
              <div className="relative">
                <FighterArtSlot fighter={fighter} locked={isLocked} />

                <div className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-black/50 text-white/90 border border-white/10 backdrop-blur-sm">
                  PWR {scaled.power}
                </div>

                <div
                  className={`absolute top-2 right-2 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full backdrop-blur-sm ${RARITY_STYLE[fighter.rarity].badge}`}
                >
                  {fighter.rarity}
                </div>

                {!isLocked && prog.level > 1 && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-400 text-black shadow-md">
                    LVL {prog.level}
                  </div>
                )}

                {isLocked && (
                  <div className="absolute inset-0 bg-[#141518]/60 flex flex-col items-center justify-center p-2 backdrop-blur-[2px]">
                    <span className="text-2xl mb-1">🔒</span>
                    <span className="text-xs font-extrabold text-white/90">LOCKED</span>
                    <span className="text-[10px] text-amber-300 mt-1 text-center font-bold">
                      {formatUnlockCost(required ?? computeUnlockCostFromPower(fighter.power))} $BlackBalls
                    </span>
                  </div>
                )}
              </div>

              <div className="px-3 py-2 text-center border-t border-white/5 bg-[#25262c]">
                <div className="text-sm font-extrabold tracking-wide truncate text-white">
                  {fighter.name}
                </div>
                <div className="text-[10px] text-white/40 truncate font-bold">{fighter.title}</div>
              </div>

              {/* Stat bars */}
              <div className="px-3 py-2.5 space-y-1.5 border-t border-white/5 bg-[#1f2025]">
                {([['ATK', scaled.atk], ['HP', scaled.hp], ['SPD', scaled.spd], ['LCK', scaled.luck]] as const).map(
                  ([label, val]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-white/40 w-7">{label}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-[#2a2c33] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${STAT_BAR[label]}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-extrabold text-white/60 w-6 text-right tabular-nums">{val}</span>
                    </div>
                  ),
                )}
              </div>

              {isFreeFighter(fighter) ? (
                <div className="py-2 text-center text-[11px] font-extrabold border-t border-white/5 bg-[#25262c] text-emerald-400">
                  FREE · LVL {prog.level}
                </div>
              ) : (
                <div
                  className={`flex items-center justify-center gap-1 py-2 text-[11px] font-extrabold border-t border-white/5 bg-[#25262c] ${
                    isLocked ? 'text-amber-300' : 'text-white/55'
                  }`}
                >
                  {isLocked ? '🔒' : '✓'} {required?.toLocaleString()} $BlackBalls
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-white/40 text-center font-bold">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141518]/85 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className={`max-w-sm w-full overflow-hidden font-arcade max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1f2025] border-2 ${RARITY_STYLE[f.rarity].card}`}
      >
        <div className="relative group">
          <FighterArtSlot fighter={f} locked={!unlocked} tall />
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-8 h-8 bg-black/50 border border-white/10 text-white/70 hover:text-white rounded-xl text-sm z-10 font-bold backdrop-blur-sm"
          >
            ×
          </button>
          <div
            className={`absolute top-2 left-2 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${RARITY_STYLE[f.rarity].badge}`}
          >
            {f.rarity}
          </div>
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#1f2025] via-[#1f2025]/95 to-transparent">
            <div className="text-xl font-extrabold text-white">{f.name}</div>
            <div className="text-xs text-white/50 font-bold">{f.title}</div>
            <div className="text-[11px] text-amber-300 mt-1 font-bold">LVL {progress.level} · {progress.wins} arena wins</div>
          </div>
        </div>

        <div className="p-4 bg-[#1f2025] border-t border-white/5">
          <div className="space-y-2 mb-4">
            {([['PWR', scaled.power], ['ATK', scaled.atk], ['HP', scaled.hp], ['SPD', scaled.spd], ['LCK', scaled.luck]] as const).map(
              ([label, value]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-white/40 w-8">{label}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-[#2a2c33] overflow-hidden">
                    <div className={`h-full rounded-full ${STAT_BAR_MODAL[label]}`} style={{ width: `${value}%` }} />
                  </div>
                  <span className="text-sm font-extrabold text-white/70 w-8 text-right tabular-nums">{value}</span>
                </div>
              ),
            )}
          </div>

          {unlocked && (
            <div className="mb-3 p-3 rounded-xl border border-white/5 bg-[#25262c]">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white/50">Fight coins</span>
                <span className="font-extrabold text-sky-400">{progress.coins.toLocaleString()} 🪙</span>
              </div>
              <div className="text-[11px] text-white/35 mt-1 font-bold">Win battles to earn coins · spend to level up</div>
              {progress.level < MAX_FIGHTER_LEVEL && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onLevelUp();
                  }}
                  disabled={!canLevelUp}
                  className="mt-2 w-full py-2 text-xs font-extrabold rounded-xl border-b-4 border-violet-700 bg-violet-500 text-white disabled:opacity-40 disabled:border-b-0 active:border-b-0 active:translate-y-0.5 transition-all"
                >
                  {canLevelUp
                    ? `⬆ Level Up (${levelUpCost.toLocaleString()} coins)`
                    : `⬆ Need ${levelUpCost.toLocaleString()} coins`}
                </button>
              )}
            </div>
          )}

          <div className="text-xs text-amber-300 font-extrabold mb-1">{f.buff.label}</div>
          <p className="text-xs text-white/50 leading-relaxed mb-3 font-bold">{f.lore}</p>

          {!unlocked && required != null && (
            <div className="mb-3 p-3 rounded-xl border border-amber-400/25 bg-amber-400/10 text-xs text-amber-200 text-center font-bold">
              🔒 Requires {formatUnlockCost(required)} $BlackBalls (power {f.power})
              <div className="text-[11px] text-white/40 mt-1">
                You have {blackballsBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          )}

          <button
            onClick={onSelect}
            disabled={!unlocked}
            className={`w-full py-3 font-extrabold text-sm rounded-xl transition-all ${
              unlocked
                ? 'bg-emerald-500 hover:bg-emerald-400 text-white border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1'
                : 'bg-[#2a2c33] text-white/40 border border-white/10'
            }`}
          >
            {unlocked ? 'SELECT FOR ARENA' : `LOCKED — ${required?.toLocaleString()} $BlackBalls`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
