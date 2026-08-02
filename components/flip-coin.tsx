'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FLIP_CONFIG } from '@/lib/flip-config';
import type { FlipSide } from '@/lib/flip-engine';
import { playFlipStartSound } from '@/lib/game-sfx';

const HEADS_SRC = '/blackballs-flip-heads.png';
const TAILS_SRC = '/blackballs-flip-tails.png';

function lockDegrees(side: FlipSide): number {
  return side === 'tails' ? 180 : 0;
}

function spinDegrees(side: FlipSide, fullSpins: number): number {
  return fullSpins * 360 + lockDegrees(side);
}

interface FlipCoinProps {
  flipKey: string | null;
  targetSide: FlipSide | null;
  bigWin?: boolean;
  onLand?: () => void;
}

function CoinFace({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="coin-face-disk">
      <img src={src} alt={alt} className="coin-face-img" draggable={false} />
    </div>
  );
}

export function FlipCoin({ flipKey, targetSide, bigWin = false, onLand }: FlipCoinProps) {
  const coinRef = useRef<HTMLDivElement>(null);
  const animKeyRef = useRef<string | null>(null);
  const onLandRef = useRef(onLand);
  const [lockedSide, setLockedSide] = useState<FlipSide | null>(null);
  const [lockedDeg, setLockedDeg] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'flipping' | 'landed'>('idle');
  const [showPulse, setShowPulse] = useState(false);
  const [bounce, setBounce] = useState(false);

  onLandRef.current = onLand;

  const clearCoinMotion = useCallback((el: HTMLDivElement) => {
    el.style.animation = 'none';
    el.style.willChange = 'auto';
    el.classList.remove('coin-wait-spin');
  }, []);

  const runFlip = useCallback(
    (runKey: string, side: FlipSide) => {
      const el = coinRef.current;
      if (!el) return;

      const spins = bigWin ? 8 : 7;
      const endDeg = spinDegrees(side, spins);
      const durationMs = FLIP_CONFIG.FLIP_ANIM_MS;

      animKeyRef.current = runKey;
      setPhase('flipping');
      setShowPulse(false);
      setBounce(false);
      playFlipStartSound();

      clearCoinMotion(el);
      el.style.transform = `rotateY(${lockedDeg}deg)`;
      void el.offsetHeight;

      el.style.setProperty('--flip-end', String(endDeg));
      el.style.willChange = 'transform';
      el.style.animation = `coinFlipLand ${durationMs}ms cubic-bezier(0.42, 0.02, 0.18, 1) forwards`;

      const handleEnd = (ev: AnimationEvent) => {
        if (ev.animationName !== 'coinFlipLand') return;
        el.removeEventListener('animationend', handleEnd);

        const final = lockDegrees(side);
        clearCoinMotion(el);
        el.style.transform = `rotateY(${final}deg)`;

        setLockedDeg(final);
        setLockedSide(side);
        setPhase('landed');
        setShowPulse(true);
        setBounce(true);
        window.setTimeout(() => setBounce(false), 520);

        onLandRef.current?.();
      };

      el.addEventListener('animationend', handleEnd);
      window.setTimeout(() => {
        if (animKeyRef.current !== runKey) return;
        handleEnd({ animationName: 'coinFlipLand' } as AnimationEvent);
      }, durationMs + 150);
    },
    [bigWin, clearCoinMotion, lockedDeg],
  );

  // Flip session started — glow + slow tease spin until result arrives
  useEffect(() => {
    if (!flipKey || targetSide) return;
    if (animKeyRef.current === flipKey || animKeyRef.current?.startsWith(`${flipKey}:`)) return;

    animKeyRef.current = flipKey;
    setPhase('waiting');
    setShowPulse(false);
    setBounce(false);

    const el = coinRef.current;
    if (el) {
      clearCoinMotion(el);
      el.style.transform = '';
      void el.offsetHeight;
      el.style.willChange = 'transform';
      el.classList.add('coin-wait-spin');
    }
  }, [flipKey, targetSide, clearCoinMotion, lockedDeg]);

  // Provably-fair result — one-shot flip then hard lock
  useEffect(() => {
    if (!flipKey || !targetSide) return;
    const runKey = `${flipKey}:${targetSide}`;
    if (animKeyRef.current === runKey) return;
    runFlip(runKey, targetSide);
  }, [flipKey, targetSide, runFlip]);

  const isSpinning = phase === 'waiting' || phase === 'flipping';
  const useLockedTransform = phase === 'idle' || phase === 'landed';

  return (
    <div className="relative flex flex-col items-center justify-center py-4 sm:py-6 coin-scene">
      {isSpinning && <div className="coin-glow coin-glow-active" aria-hidden />}

      <div className="coin-perspective">
        <div className={`coin-bounce-wrap ${bounce ? 'coin-land-bounce' : ''}`}>
          <div
            ref={coinRef}
            className={`coin-spinner ${bigWin ? 'coin-size-lg' : 'coin-size-md'}`}
            style={useLockedTransform ? { transform: `rotateY(${lockedDeg}deg)` } : undefined}
          >
            <div className="coin-face coin-face-heads" style={{ transform: 'rotateY(0deg) translateZ(3px)' }}>
              <CoinFace src={HEADS_SRC} alt="Heads" />
            </div>
            <div className="coin-face coin-face-tails" style={{ transform: 'rotateY(180deg) translateZ(3px)' }}>
              <CoinFace src={TAILS_SRC} alt="Tails" />
            </div>
          </div>
        </div>
      </div>

      {showPulse && phase === 'landed' && (
        <div className="coin-land-ring" key={`ring-${flipKey}`} aria-hidden />
      )}

      {lockedSide && phase === 'landed' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 text-lg sm:text-xl font-extrabold tracking-widest ${
            lockedSide === 'heads' ? 'text-orange-400' : 'text-amber-200'
          }`}
        >
          {lockedSide.toUpperCase()}
        </motion.div>
      )}
    </div>
  );
}
