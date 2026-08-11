'use client';

import { useEffect, useRef, useState } from 'react';
import type { FullState, Phase } from '@/lib/crash-types';
import { usePageVisibility } from '@/hooks/use-page-visibility';

/** Server tick cadence — used to map wall-clock drift onto pathAhead indices. */
const SERVER_TICK_SEC = 0.25;
/** Client display refresh — 10 Hz keeps countdown/PnL fluid without heavy re-renders. */
const UPDATE_MS = 100;

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
  // Interpolate between path ticks so the multiplier glides instead of stair-stepping.
  const exact = Math.max(0, driftSec / SERVER_TICK_SEC);
  const i0 = Math.min(Math.floor(exact), s.pathAhead.length - 1);
  const i1 = Math.min(i0 + 1, s.pathAhead.length - 1);
  const frac = Math.min(1, Math.max(0, exact - i0));
  const a = s.pathAhead[i0] ?? base;
  const b = s.pathAhead[i1] ?? a;
  return a + (b - a) * frac;
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
  if (s.phase === 'crashed') {
    // Freeze at 0x after the rug — never keep counting / extrapolating.
    return {
      phase: s.phase,
      mult: 0,
      peakMult: s.peakMult,
      elapsed: s.elapsed,
      waitLeft: Math.max(0, s.waitLeft - drift),
    };
  }
  if (s.phase === 'waiting') {
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
    Math.abs(a.mult - b.mult) > 0.002 ||
    Math.abs(a.waitLeft - b.waitLeft) > 0.04 ||
    Math.abs(a.elapsed - b.elapsed) > 0.05
  );
}

/**
 * Chart/countdown aligned to server wall clock (not local device clock).
 * Updates at 10 Hz; per-frame visual smoothing happens in the canvas/multiplier
 * components via refs so React re-render cost stays low on mobile.
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
    waitLeft: 12,
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
    const timer = setInterval(tick, UPDATE_MS);
    return () => clearInterval(timer);
  }, [pageActive]);

  return display;
}
