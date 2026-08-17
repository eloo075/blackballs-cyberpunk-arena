'use client';

import { motion } from 'framer-motion';
import { useWallet } from '@/lib/wallet-context';
import { formatPeriodRemaining, useCrashLeaderboard } from '@/hooks/use-crash-leaderboard';
import { SCORED_ROUNDS_CAP } from '@/lib/demo-rewards';

export function LeaderboardView({ compact = false }: { compact?: boolean }) {
  const { wallet } = useWallet();
  const { data, error, loading } = useCrashLeaderboard(wallet.connected ? wallet.address : null);
  const entries = data?.entries ?? [];
  const remaining = data ? formatPeriodRemaining(data.remainingMs) : '—';

  if (compact) {
    return (
      <div className="p-2 font-arcade">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-extrabold text-white/80">Weekly board</div>
          <div className="text-[10px] font-black text-amber-300">{remaining}</div>
        </div>
        {loading && <div className="text-[11px] text-white/40 font-bold py-6 text-center">Loading…</div>}
        {!loading && entries.length === 0 && (
          <div className="text-[11px] text-white/40 font-bold py-6 text-center">No scores yet this week</div>
        )}
        <ul className="divide-y divide-white/5">
          {entries.slice(0, 10).map(e => (
            <li
              key={e.address}
              className={`flex items-center gap-2 py-2 text-[11px] ${e.isYou ? 'bg-sky-500/10 -mx-2 px-2 rounded' : ''}`}
            >
              <span className="w-6 font-black text-amber-400">{e.rank}</span>
              <span className="flex-1 truncate font-bold text-white/75">{e.isYou ? 'YOU' : e.display}</span>
              <span className="font-extrabold text-amber-300 tabular-nums">{Math.round(e.points)}</span>
            </li>
          ))}
        </ul>
        {data?.you && (
          <div className="mt-2 text-[10px] font-bold text-white/45">
            You #{data.you.rank} · {Math.round(data.you.points)} pts
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-3 max-w-[1100px] mx-auto w-full font-arcade">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">Weekly ranking</h2>
          <p className="text-xs text-white/45 mt-1 font-bold max-w-xl">
            Skill score from settled Crash rounds. Best {SCORED_ROUNDS_CAP} rounds count — grinding extra volume
            does not stack. Credits are play-money. Token prizes are reviewed and paid off-platform.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-right">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-200/80">
            {data?.periodId ?? 'This week'}
          </div>
          <div className="text-lg font-black text-amber-300 tabular-nums">{remaining}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5 max-w-lg mx-auto items-end">
        {[2, 1, 3].map((r, i) => {
          const e = entries[r - 1];
          const glow =
            r === 1 ? 'text-amber-400 border-amber-400' : r === 2 ? 'text-slate-200 border-slate-300' : 'text-amber-600 border-amber-700';
          return (
            <motion.div
              key={r}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-2xl border bg-[#1f2025] px-2 py-4 text-center ${glow} ${r === 1 ? 'min-h-[7rem]' : 'min-h-[5.5rem]'}`}
            >
              <div className="text-[10px] font-black">#{String(r).padStart(2, '0')}</div>
              <div className="text-[11px] font-bold text-white/70 truncate mt-1">{e?.display ?? '—'}</div>
              <div className={`text-lg font-extrabold tabular-nums ${r === 1 ? 'text-amber-300' : 'text-white'}`}>
                {e ? Math.round(e.points) : '—'}
              </div>
              <div className="text-[10px] text-white/40 font-bold">pts</div>
            </motion.div>
          );
        })}
      </div>

      <div className="cp-panel overflow-hidden mobile-scroll-x">
        <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-white/5 flex items-center justify-between">
          <span className="text-sm font-extrabold text-white/80">Leaderboard</span>
          <span className="text-[10px] font-bold text-white/35">Best {SCORED_ROUNDS_CAP} rounds</span>
        </div>
        {loading && <div className="px-3 py-8 text-center text-xs text-white/40 font-bold">Loading standings…</div>}
        {error && <div className="px-3 py-8 text-center text-xs text-rose-400 font-bold">{error}</div>}
        {!loading && !error && entries.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-white/40 font-bold">
            No settled rounds this week yet. Connect a wallet and cash out before the rug.
          </div>
        )}
        {entries.length > 0 && (
          <table className="w-full text-xs min-w-[520px]">
            <thead>
              <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-white/40 font-extrabold">
                <th className="text-left px-3 py-2.5">#</th>
                <th className="text-left px-3 py-2.5">Player</th>
                <th className="text-right px-3 py-2.5">Points</th>
                <th className="text-right px-3 py-2.5">Scored</th>
                <th className="text-right px-3 py-2.5 hidden sm:table-cell">Wins</th>
                <th className="text-right px-3 py-2.5">Best</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr
                  key={e.address}
                  className={`border-b border-white/5 ${e.isYou ? 'bg-sky-500/10' : ''} ${e.rank <= 3 ? 'bg-amber-500/[0.04]' : ''}`}
                >
                  <td className="px-3 py-2.5 font-extrabold text-amber-400">{e.rank}</td>
                  <td className="px-3 py-2.5 font-bold text-white/75">
                    {e.display}
                    {e.isYou ? ' (YOU)' : ''}
                  </td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-amber-300 tabular-nums">
                    {e.points.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/55 font-bold tabular-nums">
                    {e.scoredRounds}/{data?.scoredRoundsCap ?? SCORED_ROUNDS_CAP}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/55 hidden sm:table-cell font-bold">{e.wins}</td>
                  <td className="px-3 py-2.5 text-right font-extrabold text-emerald-400 tabular-nums">
                    {e.bestMultiplier > 0 ? `${e.bestMultiplier.toFixed(2)}x` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data?.you && !entries.some(e => e.isYou) && (
        <div className="mt-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-200">
          You · #{data.you.rank} · {data.you.points.toFixed(1)} pts · {data.you.display}
        </div>
      )}

      <p className="mt-4 text-[11px] text-white/35 text-center font-bold">
        No auto-payout. Weekly winners are snapshotted for manual review. Credits cannot be cashed out.
      </p>
    </div>
  );
}
