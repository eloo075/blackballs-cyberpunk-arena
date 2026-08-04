'use client';

import { useEffect, useRef, useState } from 'react';
import type { FullState, Phase } from '@/lib/crash-types';

const MAX_EXTRAP_SEC = 0.5;

export type ExtrapolatedCrashDisplay = {
  phase: Phase;
  mult: number;
  peakMult: number;
  elapsed: number;
  waitLeft: number;
};

/**
 * Smooth chart/countdown display aligned to server wall clock.
 * Uses pathMult (no wiggle) + serverNow so all browsers stay in sync.
 */
export function useExtrapolatedCrashDisplay(state: FullState | null): ExtrapolatedCrashDisplay {
  const anchorRef = useRef<FullState | null>(null);
  const velRef = useRef(0);
  const [display, setDisplay] = useState<ExtrapolatedCrashDisplay>({
    phase: 'waiting',
    mult: 1,
    peakMult: 1,
    elapsed: 0,
    waitLeft: 20,
  });

  useEffect(() => {
    if (!state) return;
    const prev = anchorRef.current;
    if (prev && prev.gameId === state.gameId && prev.phase === state.phase) {
      const dt = state.elapsed - prev.elapsed;
      if (dt > 0.01) {
        velRef.current = (state.mult - prev.mult) / dt;
      }
    } else {
      velRef.current = 0;
    }
    anchorRef.current = state;
    setDisplay({
      phase: state.phase,
      mult: state.pathMult ?? state.mult,
      peakMult: state.peakMult,
      elapsed: state.elapsed,
      waitLeft: state.waitLeft,
    });
  }, [state]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = anchorRef.current;
      if (!s?.serverNow) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const drift = Math.max(0, (Date.now() - s.serverNow) / 1000);
      const d = Math.min(drift, MAX_EXTRAP_SEC);
      const baseMult = s.pathMult ?? s.mult;

      if (s.phase === 'running') {
        const extrapMult = Math.max(baseMult, baseMult + velRef.current * d);
        setDisplay({
          phase: s.phase,
          mult: extrapMult,
          peakMult: Math.max(s.peakMult, extrapMult),
          elapsed: s.elapsed + d,
          waitLeft: s.waitLeft,
        });
      } else if (s.phase === 'waiting' || s.phase === 'crashed') {
        setDisplay({
          phase: s.phase,
          mult: baseMult,
          peakMult: s.peakMult,
          elapsed: s.elapsed,
          waitLeft: Math.max(0, s.waitLeft - d),
        });
      } else {
        setDisplay({
          phase: s.phase,
          mult: baseMult,
          peakMult: s.peakMult,
          elapsed: s.elapsed,
          waitLeft: s.waitLeft,
        });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return display;
}
