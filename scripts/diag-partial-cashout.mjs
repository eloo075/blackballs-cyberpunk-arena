/**
 * Diagnostic: connect to the live Crash SSE, enter a position during countdown,
 * do a 50% partial cash-out mid-round, and log every state transition that
 * affects hasPosition/positionAmount — to find where the "no position" flicker
 * comes from (server frames vs client logic).
 *
 * Usage: node scripts/diag-partial-cashout.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? 'https://blackballs-game-luka.fly.dev';
const ADDR = `diagtest${Date.now().toString(36)}`;

function log(...args) {
  console.log(new Date().toISOString().slice(11, 23), ...args);
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

async function main() {
  log('address:', ADDR);
  const session = await post('/api/crash/session', {
    address: ADDR,
    balance: 1000,
    stimmy: 0,
    frenzy: 0,
    boot: true,
  });
  log('session:', session.status, JSON.stringify(session.data).slice(0, 120));

  let entered = false;
  let cashedOut = false;
  let done = false;
  let lastKey = '';
  let frames = 0;
  let anomalies = 0;

  const controller = new AbortController();
  setTimeout(() => {
    controller.abort();
    log(`DONE frames=${frames} anomalies=${anomalies}`);
    process.exit(0);
  }, 75000);

  const res = await fetch(`${BASE}/api/crash/stream?address=${ADDR}`, {
    signal: controller.signal,
    headers: { Accept: 'text/event-stream' },
  });
  log('stream connected:', res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (!done) {
    const { value, done: rdone } = await reader.read();
    if (rdone) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      let s;
      try {
        s = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      frames++;
      const key = [
        s.phase,
        s.gameId,
        s.hasPosition,
        s.hasLivePosition,
        s.entryPending,
        s.positionAmount,
        Number(s.balance).toFixed(2),
        s.lastResult ? `LR(${s.lastResult.amount?.toFixed?.(2)})` : 'LR-null',
      ].join('|');
      if (key !== lastKey) {
        log('frame:', key, `mult=${Number(s.mult).toFixed(3)}`);
        lastKey = key;
      }

      if (cashedOut && s.phase === 'running' && !s.hasPosition) {
        anomalies++;
        log('!! ANOMALY: server frame says NO position after partial cashout', JSON.stringify({
          phase: s.phase, gameId: s.gameId, hasPosition: s.hasPosition,
          positionAmount: s.positionAmount, balance: s.balance,
        }));
      }

      if (!entered && s.phase === 'waiting' && s.waitLeft > 3) {
        entered = true;
        post('/api/crash/enter', {
          address: ADDR,
          side: 'buy',
          amount: 100,
          leverage: 2,
          balance: 1000,
        }).then(r => log('enter:', r.status, JSON.stringify(r.data).slice(0, 200)));
      }

      if (entered && !cashedOut && s.phase === 'running' && s.hasPosition && s.elapsed > 1.2) {
        cashedOut = true;
        post('/api/crash/cashout', { address: ADDR, percent: 0.5 }).then(r =>
          log('cashout 50%:', r.status, JSON.stringify(r.data).slice(0, 300)),
        );
      }
    }
  }
}

main().catch(err => {
  console.error('diag failed:', err);
  process.exit(1);
});
