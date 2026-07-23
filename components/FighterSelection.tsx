'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FIGHTERS, RARITY_COLOR, type Fighter } from '@/lib/fighters';
import { FighterArt } from '@/components/fighter-art';
import { useFighterUnlocks } from '@/hooks/use-fighter-unlocks';

const RARITY_GRAD: Record<string, string> = {
  COMMON: 'from-gray-900/80 to-gray-950',
  RARE: 'from-cp-cyan/10 to-cp-bg',
  EPIC: 'from-cp-magenta/10 to-cp-bg',
  LEGENDARY: 'from-cp-yellow/10 to-cp-bg',
};

interface FighterSelectionProps {
  selectedFighterId?: string | null;
  onSelectFighter: (fighter: Fighter) => void;
}

export function FighterSelection({ selectedFighterId, onSelectFighter }: FighterSelectionProps) {
  const [modalFighter, setModalFighter] = useState<Fighter | null>(null);
  const { blackballsBalance, checkUnlocked, getRequirement } = useFighterUnlocks();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FIGHTERS.map((fighter, i) => {
          const required = getRequirement(fighter);
          const unlocked = checkUnlocked(fighter);
          const isLocked = !unlocked;

          return (
            <motion.button
              key={fighter.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
              whileHover={isLocked ? undefined : { scale: 1.03, y: -4 }}
              whileTap={isLocked ? undefined : { scale: 0.98 }}
              onClick={() => setModalFighter(fighter)}
              className={`cp-panel relative bg-gradient-to-b ${RARITY_GRAD[fighter.rarity]} p-3 text-left hud-corners overflow-hidden ${
                selectedFighterId === fighter.id ? 'ring-2 ring-cp-cyan' : ''
              } ${isLocked ? 'cursor-not-allowed' : ''}`}
              style={{ borderColor: RARITY_COLOR[fighter.rarity] + '44' }}
            >
              <div
                className="absolute inset-0 opacity-40 cp-glow"
                style={{ '--glow': fighter.glowColor } as React.CSSProperties}
              />

              <div className="relative flex items-start gap-3">
                <div
                  className={`relative w-20 h-20 shrink-0 flex items-center justify-center ${
                    isLocked ? 'opacity-50 grayscale' : ''
                  }`}
                  style={{
                    background: `radial-gradient(circle, ${fighter.color}22, transparent 70%)`,
                  }}
                >
                  <FighterArt fighterId={fighter.id} size={76} glowColor={fighter.glowColor} />
                  {fighter.tokenSymbol && (
                    <div className="absolute -top-1 -right-1 text-[8px] font-black px-1 py-0.5 border border-cp-green/40 text-cp-green bg-black/80">
                      ${fighter.tokenSymbol}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className="text-sm font-black tracking-wide"
                    style={{ color: fighter.color, fontFamily: 'Orbitron, sans-serif' }}
                  >
                    {fighter.name}
                  </div>
                  <div className="text-[10px] text-white/50 italic truncate">{fighter.title}</div>
                  <div className="mt-1">
                    <span
                      className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 inline-block border"
                      style={{
                        color: RARITY_COLOR[fighter.rarity],
                        background: RARITY_COLOR[fighter.rarity] + '15',
                        borderColor: RARITY_COLOR[fighter.rarity] + '44',
                      }}
                    >
                      {fighter.rarity}
                    </span>
                  </div>
                  <div className="mt-1.5 px-1.5 py-0.5 text-[9px] font-bold border border-cp-yellow/30 text-cp-yellow bg-cp-yellow/5 inline-block">
                    {fighter.buff.label}
                  </div>
                </div>
              </div>

              <div className="relative grid grid-cols-4 gap-1.5 mt-3">
                {[['ATK', fighter.atk], ['HP', fighter.hp], ['SPD', fighter.spd], ['LUCK', fighter.luck]].map(
                  ([label, value]) => (
                    <div key={label} className="text-center">
                      <div className="text-[8px] text-white/30 uppercase">{label}</div>
                      <div className="text-xs font-bold text-white/90">{value}</div>
                      <div className="h-0.5 mt-0.5 bg-white/10 overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${value}%`,
                            background: fighter.color,
                            boxShadow: `0 0 4px ${fighter.color}`,
                          }}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>

              <div className="relative flex items-center gap-1.5 mt-2 pt-2 border-t border-cp-cyan/10">
                <span className="text-[8px] text-white/30">META</span>
                <div className="flex-1 h-1 bg-black/40 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${fighter.activity}%`,
                      background: 'linear-gradient(90deg,#00f0ff,#9d00ff)',
                    }}
                  />
                </div>
                <span className="text-[8px] font-bold text-cp-cyan">{fighter.activity}%</span>
              </div>

              {isLocked && required != null && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-3 hud-corners">
                  <div className="text-center px-2">
                    <div className="text-lg mb-1">🔒</div>
                    <div className="text-[10px] font-black text-white/90 tracking-wider">LOCKED</div>
                    <div className="text-[11px] text-cp-yellow mt-1 font-bold">
                      Requires {required.toLocaleString()} $BLACKBALLS
                    </div>
                    <div className="text-[9px] text-white/40 mt-1">
                      You have {blackballsBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {modalFighter && (
          <FighterSelectModal
            fighter={modalFighter}
            blackballsBalance={blackballsBalance}
            unlocked={checkUnlocked(modalFighter)}
            required={getRequirement(modalFighter)}
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
  onClose,
  onSelect,
}: {
  fighter: Fighter;
  blackballsBalance: number;
  unlocked: boolean;
  required: number | null;
  onClose: () => void;
  onSelect: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className={`cp-panel bg-gradient-to-b ${RARITY_GRAD[f.rarity]} p-5 max-w-md w-full font-mono hud-corners relative`}
        style={{ borderColor: RARITY_COLOR[f.rarity], boxShadow: `0 0 30px ${f.glowColor}` }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/40 hover:text-cp-magenta font-mono"
        >
          [X]
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`w-28 h-28 flex items-center justify-center shrink-0 ${!unlocked ? 'opacity-50 grayscale' : ''}`}
            style={{ background: `radial-gradient(circle, ${f.color}33, transparent 70%)` }}
          >
            <FighterArt fighterId={f.id} size={108} glowColor={f.glowColor} />
          </div>
          <div>
            <div
              className="text-xl font-black"
              style={{ color: f.color, fontFamily: 'Orbitron, sans-serif' }}
            >
              {f.name}
            </div>
            <div className="text-xs text-white/50 italic">{f.title}</div>
            <div className="mt-1.5 px-2 py-1 text-[10px] font-bold border border-cp-yellow/30 text-cp-yellow bg-cp-yellow/5 inline-block">
              {f.buff.label}
            </div>
            <div className="text-[9px] text-white/40 mt-2">
              Balance: {blackballsBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} $BlackBalls
            </div>
          </div>
        </div>

        <p className="text-xs text-white/60 mt-3 leading-relaxed">{f.lore}</p>
        <div className="text-[10px] text-cp-yellow/70 mt-1">{f.buff.description}</div>

        {!unlocked && required != null && (
          <div className="mt-3 p-2 border border-cp-yellow/30 bg-cp-yellow/5 text-[11px] text-cp-yellow text-center">
            🔒 Requires {required.toLocaleString()} $BLACKBALLS to unlock
          </div>
        )}

        <button
          onClick={onSelect}
          disabled={!unlocked}
          className="cp-btn w-full mt-4 py-2.5 font-black text-sm tracking-wider disabled:opacity-40"
          style={{
            background: unlocked ? f.color : '#333',
            color: unlocked ? '#000' : '#888',
            boxShadow: unlocked ? `0 0 16px ${f.glowColor}` : undefined,
            clipPath: 'polygon(0 0, 100% 0, 100% 75%, 92% 100%, 0 100%)',
          }}
        >
          {unlocked ? 'SELECT FOR ARENA' : `LOCKED — ${required?.toLocaleString()} $BlackBalls`}
        </button>
      </motion.div>
    </motion.div>
  );
}
