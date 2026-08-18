'use client';

import { useMemo, useState } from 'react';
import type { FeedEvent, RoundSummary, TradeTag } from '@/lib/crash-types';
import { LeaderboardView } from '@/components/leaderboard-view';
import { LiveActivityFeed } from '@/components/LiveActivityFeed';

type MobileLowerTab = 'leaderboard' | 'live' | 'chat';

interface CrashMobileLowerPanelProps {
  history: RoundSummary[];
  feed: FeedEvent[];
  tradeTags: TradeTag[];
  mult: number;
  phase: 'waiting' | 'running' | 'crashed';
  buyersIn: number;
}

function livePnl(amount: number, entry: number, mult: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(entry) || entry <= 0) return 0;
  return amount * (mult / entry - 1);
}

/** Scrollable Leaderboard / Live Bets / Chat under the mobile trade dock. */
export function CrashMobileLowerPanel({
  history,
  feed,
  tradeTags,
  mult,
  phase,
  buyersIn,
}: CrashMobileLowerPanelProps) {
  const [tab, setTab] = useState<MobileLowerTab>('live');

  const liveBets = useMemo(() => {
    const buys = tradeTags.filter(t => t.side === 'buy');
    // Newest first, de-dupe by user keeping latest buy.
    const byUser = new Map<string, TradeTag>();
    for (const t of buys) byUser.set(t.user, t);
    return Array.from(byUser.values())
      .sort((a, b) => b.id - a.id)
      .slice(0, 40);
  }, [tradeTags]);

  const tabs: { id: MobileLowerTab; label: string }[] = [
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'live', label: 'Live Bets' },
    { id: 'chat', label: 'Chat' },
  ];

  return (
    <section className="md:hidden mt-2 mb-3 px-1 pb-[env(safe-area-inset-bottom,8px)]">
      <div className="flex gap-1 p-1 rounded-xl bg-[#12141a] border border-white/[0.06]">
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 min-h-[34px] rounded-lg text-[11px] font-extrabold touch-manipulation transition-colors ${
                active
                  ? 'bg-amber-400 text-black'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-2 rounded-2xl border border-white/[0.06] bg-[#12141a] overflow-hidden min-h-[220px]">
        {tab === 'leaderboard' && <LeaderboardView compact />}

        {tab === 'live' && (
          <div className="p-3 font-arcade">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-extrabold text-white/75">Live Bets</div>
              <div className="text-[10px] font-bold text-white/35">
                {buyersIn > 0
                  ? `${buyersIn} in · ${liveBets.length} shown`
                  : 'No open bets'}
              </div>
            </div>
            {liveBets.length === 0 ? (
              <div className="text-[11px] text-white/35 font-bold py-8 text-center">
                No open bets yet
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {liveBets.map(t => {
                  const pnl =
                    phase === 'running' ? livePnl(t.amount, t.price, mult) : 0;
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 py-2.5 text-[11px]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-white/80 truncate">{t.user}</div>
                        <div className="text-white/40 font-bold tabular-nums mt-0.5">
                          {t.amount.toFixed(2)} @ {t.price.toFixed(2)}x
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-right font-black tabular-nums ${
                          phase !== 'running'
                            ? 'text-white/35'
                            : pnl >= 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                        }`}
                      >
                        {phase === 'running'
                          ? `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`
                          : '—'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="min-h-[240px]">
            <LiveActivityFeed fallbackFeed={feed} inRound={buyersIn} />
          </div>
        )}
      </div>
    </section>
  );
}
