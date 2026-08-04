'use client';

import { ChartCanvas } from '@/components/chart-canvas';
import { useCrashStream } from '@/hooks/use-crash-stream';

/** Live crash chart behind the campaign overlay — visual FOMO only, no controls. */
export function CampaignChartBackdrop() {
  const { state, connected, streamEpoch } = useCrashStream();

  if (!state) {
    return (
      <div className="absolute inset-0 bg-[#141518]">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-rose-500/5 animate-pulse" />
      </div>
    );
  }

  const chartMult =
    state.phase === 'crashed' && state.currentRound.crashPoint != null
      ? state.currentRound.crashPoint
      : state.mult;
  const chartPeak =
    state.phase === 'crashed' && state.currentRound.crashPoint != null
      ? Math.max(state.peakMult, state.currentRound.crashPoint)
      : state.peakMult;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#141518]">
      <div className="absolute inset-0 scale-105 sm:scale-110 origin-center">
        <ChartCanvas
          key={`campaign-backdrop-${state.gameId}`}
          candles={state.candles}
          phase={state.phase}
          mult={chartMult}
          peakMult={chartPeak}
          elapsed={state.elapsed}
          tradeTags={state.tradeTags}
          entryPrice={null}
        />
      </div>

      {/* darken + blur so chart teases without exposing gameplay */}
      <div className="absolute inset-0 bg-[#141518]/72 backdrop-blur-[6px] sm:backdrop-blur-[10px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#141518]/40 via-transparent to-[#141518]/85" />

      {/* subtle live indicator */}
      <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-black/40 border border-white/10 px-3 py-1.5 text-[10px] font-extrabold text-white/50">
        <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
        LIVE CRASH · ROUND #{state.currentRound.id}
        {state.phase === 'running' && (
          <span className="text-sky-300 tabular-nums">{state.mult.toFixed(2)}x</span>
        )}
      </div>
    </div>
  );
}
