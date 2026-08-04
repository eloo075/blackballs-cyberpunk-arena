'use client';

import { useEffect, useRef, useState } from 'react';
import type { FullState, Phase } from '@/lib/crash-types';

const TICK_MS = 250;
const TICK_SEC = TICK_MS / 1000;

export type ExtrapolatedCrashDisplay = {
  phase: Phase;
  mult: number;
  peakMult: number;
  elapsed: number;
  waitLeft: number;
};

function resolveSyncedMult(s: FullState, driftSec: number): number {
  const base = s.pathMult ?? s.mult;
  if (s.phase !== 'running' || !s.pathAhead?.length) return base;
  const extraTicks = Math.max(0, Math.floor(driftSec / TICK_SEC));
  const idx = Math.min(extraTicks, s.pathAhead.length - 1);
  return s.pathAhead[idx] ?? base;
}

/**
 * Chart/countdown aligned to server wall clock (not local device clock).
 * Multiplier extrapolates along the server path between SSE ticks.
 */
export function useExtrapolatedCrashDisplay(state: FullState | null): ExtrapolatedCrashDisplay {
  const anchorRef = useRef<FullState | null>(null);
  const clockOffsetRef = useRef(0);
  const [display, setDisplay] = useState<ExtrapolatedCrashDisplay>({
    phase: 'waiting',
    mult: 1,
    peakMult: 1,
    elapsed: 0,
    waitLeft: 20,
  });

  useEffect(() => {
    if (!state) return;
    if (typeof state.serverNow === 'number') {
      clockOffsetRef.current = state.serverNow - Date.now();
    }
    anchorRef.current = state;
    const fairMult = resolveSyncedMult(state, 0);
    setDisplay({
      phase: state.phase,
      mult: fairMult,
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

      const serverNowEst = Date.now() + clockOffsetRef.current;
      const drift = Math.max(0, (serverNowEst - s.serverNow) / 1000);
      const fairMult = resolveSyncedMult(s, drift);

      if (s.phase === 'running') {
        setDisplay({
          phase: s.phase,
          mult: fairMult,
          peakMult: Math.max(s.peakMult, fairMult),
          elapsed: s.elapsed + drift,
          waitLeft: s.waitLeft,
        });
      } else if (s.phase === 'waiting' || s.phase === 'crashed') {
        setDisplay({
          phase: s.phase,
          mult: fairMult,
          peakMult: s.peakMult,
          elapsed: s.elapsed,
          waitLeft: Math.max(0, s.waitLeft - drift),
        });
      } else {
        setDisplay({
          phase: s.phase,
          mult: fairMult,
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
