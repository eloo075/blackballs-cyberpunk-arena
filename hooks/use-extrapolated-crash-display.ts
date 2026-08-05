'use client';

import { useEffect, useRef, useState } from 'react';
import type { FullState, Phase } from '@/lib/crash-types';
import { usePageVisibility } from '@/hooks/use-page-visibility';

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

function computeDisplay(s: FullState, clockOffset: number): ExtrapolatedCrashDisplay {
  const serverNowEst = Date.now() + clockOffset;
  const drift = Math.max(0, (serverNowEst - (s.serverNow ?? serverNowEst)) / 1000);
  const fairMult = resolveSyncedMult(s, drift);

  if (s.phase === 'running') {
    return {
      phase: s.phase,
      mult: fairMult,
      peakMult: Math.max(s.peakMult, fairMult),
      elapsed: s.elapsed + drift,
      waitLeft: s.waitLeft,
    };
  }
  if (s.phase === 'waiting' || s.phase === 'crashed') {
    return {
      phase: s.phase,
      mult: fairMult,
      peakMult: s.peakMult,
      elapsed: s.elapsed,
      waitLeft: Math.max(0, s.waitLeft - drift),
    };
  }
  return {
    phase: s.phase,
    mult: fairMult,
    peakMult: s.peakMult,
    elapsed: s.elapsed,
    waitLeft: s.waitLeft,
  };
}

function displayChanged(a: ExtrapolatedCrashDisplay, b: ExtrapolatedCrashDisplay): boolean {
  return (
    a.phase !== b.phase ||
    Math.abs(a.mult - b.mult) > 0.004 ||
    Math.abs(a.waitLeft - b.waitLeft) > 0.04 ||
    Math.abs(a.elapsed - b.elapsed) > 0.08
  );
}

/**
 * Chart/countdown aligned to server wall clock (not local device clock).
 * Throttled updates (~4/sec) to keep mobile smooth.
 */
export function useExtrapolatedCrashDisplay(
  state: FullState | null,
  active = true,
): ExtrapolatedCrashDisplay {
  const pageActive = usePageVisibility(active);
  const anchorRef = useRef<FullState | null>(null);
  const clockOffsetRef = useRef(0);
  const displayRef = useRef<ExtrapolatedCrashDisplay>({
    phase: 'waiting',
    mult: 1,
    peakMult: 1,
    elapsed: 0,
    waitLeft: 20,
  });
  const [display, setDisplay] = useState(displayRef.current);

  useEffect(() => {
    if (!state) return;
    if (typeof state.serverNow === 'number') {
      clockOffsetRef.current = state.serverNow - Date.now();
    }
    anchorRef.current = state;
    const next = computeDisplay(state, clockOffsetRef.current);
    if (displayChanged(displayRef.current, next)) {
      displayRef.current = next;
      setDisplay(next);
    }
  }, [state]);

  useEffect(() => {
    if (!pageActive) return;

    const tick = () => {
      const s = anchorRef.current;
      if (!s?.serverNow) return;
      const next = computeDisplay(s, clockOffsetRef.current);
      if (displayChanged(displayRef.current, next)) {
        displayRef.current = next;
        setDisplay(next);
      }
    };

    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [pageActive]);

  return display;
}
