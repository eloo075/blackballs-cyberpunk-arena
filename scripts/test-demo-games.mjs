/** Integration test for Crash buy/sell + Flip join (demo mode). */
const ADDRESS =
  process.env.TEST_ADDRESS ??
  '7xK' + 'a'.repeat(40) + 'demo' + Math.random().toString(36).slice(2, 8);

async function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  for (const port of [3003, 3001, 3000]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/market-listings`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* try next port */
    }
  }
  throw new Error(
    'Dev server not running. Start it first:\n  npm run dev:clean\nThen re-run:\n  node scripts/test-demo-games.mjs',
  );
}

let BASE = process.env.BASE_URL ?? 'http://localhost:3001';

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const code = err?.cause?.code ?? err?.code;
    if (code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot reach ${BASE}. Start the dev server:\n  npm run dev:clean`,
      );
    }
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function readCrashState() {
  const res = await fetch(`${BASE}/api/crash/stream?address=${encodeURIComponent(ADDRESS)}`);
  const reader = res.body?.getReader();
  if (!reader) return null;
  const dec = new TextDecoder();
  let buf = '';
  for (let i = 0; i < 80; i++) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const dataIdx = buf.indexOf('data: ');
    if (dataIdx < 0) continue;
    const after = buf.slice(dataIdx + 6);
    const nl = after.indexOf('\n');
    if (nl <= 0) continue;
    try {
      const parsed = JSON.parse(after.slice(0, nl));
      await reader.cancel().catch(() => {});
      return parsed;
    } catch {
      /* wait for full JSON line */
    }
  }
  await reader.cancel().catch(() => {});
  return null;
}

async function waitForPhase(target, maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const s = await readCrashState();
    if (s?.phase === target) return s;
    await new Promise(r => setTimeout(r, 400));
  }
  return null;
}

async function enterWhenWaiting(side, amount, balance) {
  for (let i = 0; i < 120; i++) {
    const s = await readCrashState();
    if (s?.phase === 'waiting') {
      const r = await post('/api/crash/enter', {
        address: ADDRESS,
        side,
        amount,
        leverage: 1,
        balance,
        isRealWallet: false,
      });
      return { ...r, phase: s.phase, waitLeft: s.waitLeft };
    }
    await new Promise(r => setTimeout(r, 400));
  }
  return { status: 408, data: { ok: false, error: 'timeout waiting for countdown' }, phase: null };
}

function assert(label, cond, detail) {
  if (!cond) {
    console.error(`FAIL: ${label}`, detail ?? '');
    process.exit(1);
  }
  console.log(`OK: ${label}`, detail ?? '');
}

async function main() {
  BASE = await resolveBaseUrl();
  console.log('Testing against', BASE);
  console.log('Address', ADDRESS);

  let r = await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: true,
  });
  assert('crash/session boot', r.status === 200 && r.data.ok === true, r.data);

  const waiting = await waitForPhase('waiting', 60000);
  assert('crash waiting phase', !!waiting, waiting?.phase);

  r = await enterWhenWaiting('buy', 1, 100);
  assert('BUY for cancel test', r.status === 200 && r.data.ok === true, r.data);

  r = await post('/api/crash/cancel', { address: ADDRESS });
  assert('cancel pending LONG', r.status === 200 && r.data.ok === true, r.data);

  r = await enterWhenWaiting('sell', 1, 100);
  assert('SELL for cancel test', r.status === 200 && r.data.ok === true, r.data);

  r = await post('/api/crash/cancel', { address: ADDRESS });
  assert('cancel pending SHORT', r.status === 200 && r.data.ok === true, r.data);

  r = await enterWhenWaiting('buy', 1, 100);
  assert('crash BUY', r.status === 200 && r.data.ok === true, r.data);

  r = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'buy',
    amount: 1,
    leverage: 1,
    balance: 100,
    isRealWallet: false,
  });
  assert('duplicate BUY rejected', r.status === 400, r.data.error);

  r = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'sell',
    amount: 1,
    leverage: 1,
    balance: 100,
    isRealWallet: false,
  });
  assert('SELL cancels pending', r.status === 200 && r.data.ok === true, r.data);

  r = await enterWhenWaiting('buy', 1, 100);
  assert('BUY after cancel', r.status === 200 && r.data.ok === true, r.data);

  // Let round run and crash, then bet again on new countdown
  console.log('Waiting for round to finish…');
  await waitForPhase('crashed', 120000);
  const waiting2 = await waitForPhase('waiting', 30000);
  assert('new countdown after crash', !!waiting2, waiting2?.phase);

  r = await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: true,
  });
  r = await enterWhenWaiting('sell', 1, 100);
  assert('SELL on fresh countdown', r.status === 200 && r.data.ok === true, r.data);

  // Flip
  r = await post('/api/flip/session', {
    address: ADDRESS,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: true,
  });
  assert('flip/session boot', r.status === 200, r.data);

  r = await post('/api/flip/join', {
    address: ADDRESS,
    mode: '1v1',
    side: 'heads',
    amount: 1,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
  });
  assert('flip/join 1', r.status === 200 && r.data.ok === true, r.data);

  // Wait for bot match + resolve (~5s anim)
  await new Promise(r => setTimeout(r, 8000));

  r = await post('/api/flip/session', {
    address: ADDRESS,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: true,
  });

  r = await post('/api/flip/join', {
    address: ADDRESS,
    mode: '1v1',
    side: 'tails',
    amount: 1,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
  });
  assert('flip/join 2 after round', r.status === 200 && r.data.ok === true, r.data);

  console.log('\nAll integration tests passed.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
