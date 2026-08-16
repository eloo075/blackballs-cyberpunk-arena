/**
 * House-edge measurement against realistic cash-out strategies.
 * Read-only: imports production crash RNG + settlement. Does not mutate game code.
 *
 * Run: npx vitest run scripts/house-edge-sim.test.ts --testTimeout=300000
 *
 * Engine under test: DEMO continuous Crash (CrashManager mode === 'continuous').
 * That is the live demo path: generateContinuousRoundPath(deriveServerSeedForGameId(id), id, 250).
 * Real-money 0x uses classic computeCrashPoint() instead — not simulated here.
 */
import {
  deriveServerSeedForGameId,
  generateContinuousRoundPath,
} from '../lib/crash-engine';
import {
  calcCrashSettlement,
  isLeveragedExitAllowed,
  leveragedOpenFee,
} from '../lib/crash-pnl';

const ROUNDS = 200_000;
const STAKE = 100;
const ENTRY = 1.0;
const LEVERAGE = 1;
const SIDE = 'buy' as const;
const TICK_MS = 250;
const GAME_ID_BASE = 10_000_000;

const STRATEGIES: { id: string; label: string; target: number }[] = [
  { id: 'A', label: 'sell on first pump ≥ 1.10x', target: 1.1 },
  { id: 'B', label: 'sell on first pump ≥ 1.05x', target: 1.05 },
  { id: 'C', label: 'sell on first pump ≥ 1.20x', target: 1.2 },
  { id: 'D', label: 'hold to 2x or bust', target: 2.0 },
];

type Stats = {
  wins: number;
  losses: number;
  winSum: number;
  lossSum: number;
  netSum: number;
};

function emptyStats(): Stats {
  return { wins: 0, losses: 0, winSum: 0, lossSum: 0, netSum: 0 };
}

function record(s: Stats, net: number) {
  s.netSum += net;
  if (net > 0) {
    s.wins += 1;
    s.winSum += net;
  } else {
    s.losses += 1;
    s.lossSum += net;
  }
}

function pct(n: number): string {
  return `${(n * 100).toFixed(3)}%`;
}

function moneyPct(net: number): string {
  return `${((net / STAKE) * 100).toFixed(3)}%`;
}

function tryCashout(exit: number): number | null {
  if (!isLeveragedExitAllowed(SIDE, LEVERAGE, ENTRY, exit)) return null;
  const settled = calcCrashSettlement({
    side: SIDE,
    margin: STAKE,
    leverage: LEVERAGE,
    entry: ENTRY,
    exit,
    stimmy: 0,
    frenzy: 0,
  });
  return settled.netProfit;
}

function playRound(
  path: { price: number }[],
  rugTick: number,
  target: number,
): number {
  // Rug candle is not cashable — same as CrashManager.crash() wiping leftover stake.
  const lastPlayable = Math.min(rugTick, path.length - 1);
  for (let i = 1; i < lastPlayable; i++) {
    const price = path[i]?.price;
    if (price == null || price < target) continue;
    const net = tryCashout(price);
    if (net == null) continue;
    return net;
  }
  // Bust: 100% loss of locked stake (fee prepaid at open; 1x fee is 0).
  const fee = leveragedOpenFee(STAKE, LEVERAGE);
  return -(STAKE + fee);
}

function main() {
  const t0 = Date.now();
  const stats = STRATEGIES.map(() => emptyStats());
  let peakSum = 0;
  let rugTickSum = 0;
  let rugsBefore105 = 0;
  let rugsBefore110 = 0;
  let rugsBefore120 = 0;
  let rugsBefore200 = 0;

  for (let n = 0; n < ROUNDS; n++) {
    const gameId = GAME_ID_BASE + n;
    const seed = deriveServerSeedForGameId(gameId);
    const round = generateContinuousRoundPath(seed, gameId, TICK_MS);
    peakSum += round.peakMultiplier;
    rugTickSum += round.rugTick;
    let hit105 = false;
    let hit110 = false;
    let hit120 = false;
    let hit200 = false;
    const lastPlayable = Math.min(round.rugTick, round.path.length - 1);
    for (let i = 1; i < lastPlayable; i++) {
      const p = round.path[i]!.price;
      if (p >= 1.05) hit105 = true;
      if (p >= 1.1) hit110 = true;
      if (p >= 1.2) hit120 = true;
      if (p >= 2) hit200 = true;
    }
    if (!hit105) rugsBefore105 += 1;
    if (!hit110) rugsBefore110 += 1;
    if (!hit120) rugsBefore120 += 1;
    if (!hit200) rugsBefore200 += 1;

    for (let s = 0; s < STRATEGIES.length; s++) {
      record(stats[s]!, playRound(round.path, round.rugTick, STRATEGIES[s]!.target));
    }
  }

  const openFee = leveragedOpenFee(STAKE, LEVERAGE);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('Crash house-edge sim (measurement only — no game-code changes)');
  console.log('──────────────────────────────────────────────────────────────');
  console.log('Engine:     DEMO continuous generateContinuousRoundPath');
  console.log('Seeds:      deriveServerSeedForGameId(gameId)  (same as CrashManager)');
  console.log(`Rounds:     ${ROUNDS.toLocaleString()} each strategy (shared paths)`);
  console.log(`Stake:      ${STAKE} @ ${ENTRY.toFixed(2)}x entry, ${LEVERAGE}x long (presale)`);
  console.log(`Open fee:   ${openFee}  (leveragedOpenFee; 0 at 1x)`);
  console.log('Anti-scalp: isLeveragedExitAllowed — no-op at 1x (blocks only leverage > 1)');
  console.log('Cash-out:   calcCrashSettlement (stimmy/frenzy = 0)');
  console.log('Bust:       −100% stake on rug if target never prints on a pre-rug tick');
  console.log('Fill price: first playable tick with price ≥ target (not clipped to target)');
  console.log(`Mean peak:  ${(peakSum / ROUNDS).toFixed(3)}x`);
  console.log(`Mean length:${((rugTickSum / ROUNDS) * (TICK_MS / 1000)).toFixed(1)}s  (rugTick × ${TICK_MS}ms)`);
  console.log(
    `Never hit:  1.05x ${pct(rugsBefore105 / ROUNDS)}  |  1.10x ${pct(rugsBefore110 / ROUNDS)}  |  1.20x ${pct(rugsBefore120 / ROUNDS)}  |  2.00x ${pct(rugsBefore200 / ROUNDS)}`,
  );
  console.log(`Elapsed:    ${elapsed}s`);
  console.log('');
  console.log(
    [
      'ID'.padEnd(4),
      'Strategy'.padEnd(32),
      'Win rate'.padStart(10),
      'Avg win'.padStart(12),
      'Avg loss'.padStart(12),
      'Net EV / stake'.padStart(16),
    ].join('  '),
  );
  console.log('-'.repeat(92));

  for (let s = 0; s < STRATEGIES.length; s++) {
    const st = STRATEGIES[s]!;
    const a = stats[s]!;
    const winRate = a.wins / ROUNDS;
    const avgWin = a.wins ? a.winSum / a.wins : 0;
    const avgLoss = a.losses ? a.lossSum / a.losses : 0;
    const ev = a.netSum / ROUNDS;
    console.log(
      [
        st.id.padEnd(4),
        st.label.padEnd(32),
        pct(winRate).padStart(10),
        moneyPct(avgWin).padStart(12),
        moneyPct(avgLoss).padStart(12),
        moneyPct(ev).padStart(16),
      ].join('  '),
    );
  }
  console.log('');
  console.log('Avg win / avg loss are conditional on winning / losing rounds, as % of stake.');
  console.log('Net EV is mean netProfit per round / stake. Negative = house wins.');
  console.log('Not simulated: classic/0x computeCrashPoint path, 5x leverage, stimmy/frenzy.');
}

export { main };
