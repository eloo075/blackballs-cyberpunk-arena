/**
 * Replays the REAL client guard pipeline (compiled from lib/session-balance.ts)
 * against the live SSE stream while performing a partial cashout with the same
 * optimistic update the browser does. Logs any hasPosition flip during running.
 *
 * Prereq: npx esbuild lib/session-balance.ts --bundle --format=esm --outfile=scripts/.sb.mjs
 * Usage:  node scripts/diag-client-pipeline.mjs [baseUrl]
 */
import {
  normalizeCrashStreamState,
  guardPendingEntryOnStream,
  guardLivePositionOnStream,
  guardCancelledPositionOnStream,
  guardRecentEntryOnStream,
  guardCashoutOnStream,
  resetPlayerViewForNewRound,
  isNewRoundTransition,
} from './.sb.mjs';

const BASE = process.argv[2] ?? 'https://blackballs-game-luka.fly.dev';
const ADDR = `diagcli${Date.now().toString(36)}`;

let clientState = null;
const cashoutSuppress = { until: 0 };
const cancelSuppress = { until: 0 };
const entrySuppress = { until: 0 };

function log(...args) {
  console.log(new Date().toISOString().slice(11, 23), ...args);
}

function summarize(s) {
  if (!s) return 'null';
  return `${s.phase}|g${s.gameId}|pos=${s.hasPosition}|live=${s.hasLivePosition}|pend=${s.entryPending}|amt=${s.positionAmount}|bal=${Number(s.balance).toFixed(2)}`;
}

function applyStreamPayload(parsed, source) {
  const prev = clientState;
  const roundChanged = isNewRoundTransition(prev, parsed);
  let next = normalizeCrashStreamState(parsed, prev, 1000);
  if (roundChanged) next = resetPlayerViewForNewRound(next);
  next = guardPendingEntryOnStream(prev, next);
  next = guardLivePositionOnStream(prev, next);
  next = guardCancelledPositionOnStream(prev, next, cancelSuppress.until);
  next = guardRecentEntryOnStream(prev, next, entrySuppress.until);
  next = guardCashoutOnStream(prev, next, cashoutSuppress.until);

  const flipped =
    prev &&
    prev.phase === 'running' &&
    next.phase === 'running' &&
    prev.gameId === next.gameId &&
    prev.hasPosition !== next.hasPosition;
  if (flipped) {
    log(`!!! hasPosition FLIP via ${source}:`);
    log('    prev:', summarize(prev));
    log('    raw :', summarize(parsed));
    log('    next:', summarize(next));
  }
  clientState = next;
  return next;
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function mergeView(view) {
  if (!clientState || !view) return;
  clientState = {
    ...clientState,
    ...(view.phase != null ? { phase: view.phase } : {}),
    ...(view.gameId != null ? { gameId: view.gameId } : {}),
    ...(view.hasPosition != null ? { hasPosition: view.hasPosition } : {}),
    ...(view.hasLivePosition != null ? { hasLivePosition: view.hasLivePosition } : {}),
    ...(view.entryPending != null ? { entryPending: view.entryPending } : {}),
    ...(view.positionAmount != null ? { positionAmount: view.positionAmount } : {}),
    ...(view.balance != null ? { balance: view.balance } : {}),
  };
  log('merged view:', summarize(clientState));
}

async function doPartialCashout(pct) {
  // Optimistic update — same as use-crash-stream cashOut()
  const snap = clientState;
  if (snap?.hasPosition && snap.phase === 'running') {
    const closeMargin = parseFloat((snap.positionAmount * pct).toFixed(3));
    const remaining = parseFloat((snap.positionAmount - closeMargin).toFixed(3));
    if (remaining > 0.01) {
      cashoutSuppress.until = Date.now() + 10_000;
      clientState = {
        ...snap,
        hasPosition: true,
        hasLivePosition: true,
        entryPending: false,
        positionAmount: remaining,
      };
      log('optimistic partial applied:', summarize(clientState));
    }
  }
  const r = await post('/api/crash/cashout', {
    address: ADDR,
    percent: pct,
    clientView: clientState
      ? {
          phase: clientState.phase,
          gameId: clientState.gameId,
          hasPosition: clientState.hasPosition,
          hasLivePosition: clientState.hasLivePosition,
          entryPending: clientState.entryPending,
          positionSide: clientState.positionSide,
          positionAmount: clientState.positionAmount,
          positionLeverage: clientState.positionLeverage,
          positionEntryPrice: clientState.positionEntryPrice,
          balance: clientState.balance,
        }
      : undefined,
  });
  log('cashout resp:', r.status, JSON.stringify(r.data).slice(0, 160));
  if (r.data.view) mergeView(r.data.view);
}

async function main() {
  log('address:', ADDR);
  await post('/api/crash/session', { address: ADDR, balance: 1000, stimmy: 0.5, frenzy: 0, boot: true });

  let entered = false;
  let partials = 0;
  let lastSummary = '';

  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
    log('DONE');
    process.exit(0);
  }, 90000);

  const res = await fetch(`${BASE}/api/crash/stream?address=${ADDR}`, {
    signal: controller.signal,
    headers: { Accept: 'text/event-stream' },
  });
  log('stream connected:', res.status);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      const next = applyStreamPayload(parsed, 'sse');
      const summary = summarize(next);
      if (summary !== lastSummary) {
        log('state:', summary, `mult=${Number(parsed.mult).toFixed(3)}`);
        lastSummary = summary;
      }

      if (!entered && next.phase === 'waiting' && next.waitLeft > 3) {
        entered = true;
        post('/api/crash/enter', { address: ADDR, side: 'buy', amount: 100, leverage: 2, balance: 1000 }).then(r => {
          log('enter:', r.status);
          if (r.data.view) mergeView(r.data.view);
        });
      }

      // Two partial cashouts in quick succession — like a user tapping repeatedly
      if (entered && next.phase === 'running' && next.hasPosition && next.elapsed > 1.2 && partials === 0) {
        partials = 1;
        void doPartialCashout(0.5).then(() => {
          setTimeout(() => {
            if (clientState?.hasPosition && clientState.phase === 'running') {
              partials = 2;
              void doPartialCashout(0.5);
            }
          }, 1500);
        });
      }
    }
  }
}

main().catch(err => {
  console.error('diag failed:', err);
  process.exit(1);
});
