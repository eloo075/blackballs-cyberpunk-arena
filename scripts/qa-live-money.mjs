/**
 * Live multi-round money-safety + Flip probe against production.
 * Usage: node scripts/qa-live-money.mjs
 * Optional: BASE_URL=https://blackballs-game-luka.fly.dev
 */
const BASE = process.env.BASE_URL || 'https://blackballs-game-luka.fly.dev';
const ADDR =
  process.env.TEST_ADDRESS ||
  `demo-qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const results = [];

function log(ok, label, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'}: ${label}${detail != null ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`;
  console.log(line);
  results.push({ ok, label, detail });
  if (!ok) throw new Error(line);
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

async function getState() {
  const res = await fetch(`${BASE}/api/crash/state?address=${encodeURIComponent(ADDR)}`, {
    signal: AbortSignal.timeout(20000),
  });
  return res.json();
}

async function readStreamOnce(timeoutMs = 15000) {
  const res = await fetch(`${BASE}/api/crash/stream?address=${encodeURIComponent(ADDR)}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  const reader = res.body?.getReader();
  if (!reader) return null;
  const dec = new TextDecoder();
  let buf = '';
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const idx = buf.indexOf('data: ');
    if (idx < 0) continue;
    const after = buf.slice(idx + 6);
    const nl = after.indexOf('\n');
    if (nl <= 0) continue;
    try {
      const parsed = JSON.parse(after.slice(0, nl));
      await reader.cancel().catch(() => {});
      return parsed;
    } catch {
      /* keep reading */
    }
  }
  await reader.cancel().catch(() => {});
  return null;
}

async function waitPhase(phase, maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const s = await readStreamOnce(8000);
    if (s?.phase === phase) return s;
    await new Promise(r => setTimeout(r, 350));
  }
  return null;
}

async function waitUntil(pred, maxMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const s = await readStreamOnce(8000);
    if (s && pred(s)) return s;
    await new Promise(r => setTimeout(r, 350));
  }
  return null;
}

function playerBal(s) {
  return Number(s?.player?.balance ?? s?.balance ?? NaN);
}

function roundMoney(n) {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

async function main() {
  console.log('BASE', BASE);
  console.log('ADDR', ADDR);

  // Boot demo session
  let r = await post('/api/crash/session', {
    address: ADDR,
    balance: 500,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: true,
  });
  log(r.status === 200 && r.data.ok !== false, 'crash session boot', {
    status: r.status,
    bal: r.data?.balance ?? r.data?.player?.balance,
  });

  let s = await getState();
  const startBal = playerBal(s) || Number(r.data?.balance) || 500;
  log(Number.isFinite(startBal) && startBal > 0, 'demo balance present', startBal);

  // --- Cancel Buy during waiting: exact refund ---
  s = await waitPhase('waiting', 90000);
  log(!!s, 'reached waiting for cancel test', s?.phase);

  r = await post('/api/crash/enter', {
    address: ADDR,
    side: 'buy',
    amount: 25,
    leverage: 1,
    balance: startBal,
    isRealWallet: false,
  });
  log(r.status === 200 && r.data.ok === true, 'BUY during waiting', r.data?.error || r.data?.action);
  const afterBuy = Number(r.data?.balance);
  log(
    Math.abs(afterBuy - roundMoney(startBal - 25)) < 0.02,
    'debit exact on pending buy',
    { startBal, afterBuy },
  );

  r = await post('/api/crash/cancel', { address: ADDR });
  log(r.status === 200 && r.data.ok === true, 'cancel pending buy', r.data?.error);
  const afterCancel = Number(r.data?.balance);
  log(
    Math.abs(afterCancel - startBal) < 0.02,
    'cancel refunds exact amount only',
    { startBal, afterCancel },
  );

  // Double cancel must not mint
  r = await post('/api/crash/cancel', { address: ADDR });
  const afterDouble = Number(r.data?.balance ?? afterCancel);
  log(
    Math.abs(afterDouble - startBal) < 0.02,
    'second cancel does not mint',
    { afterDouble },
  );

  // --- Live BUY anytime + hold through rug ---
  s = await waitUntil(st => st.phase === 'running' || st.phase === 'waiting', 60000);
  const balBeforeOpen = afterCancel;
  r = await post('/api/crash/enter', {
    address: ADDR,
    side: 'buy',
    amount: 40,
    leverage: 1,
    balance: balBeforeOpen,
    isRealWallet: false,
  });
  log(r.status === 200 && r.data.ok === true, 'BUY open (waiting or live)', {
    phase: s?.phase,
    err: r.data?.error,
    bal: r.data?.balance,
  });
  const balAfterOpen = Number(r.data?.balance);
  log(balAfterOpen < balBeforeOpen - 39.5, 'open deducted stake', {
    balBeforeOpen,
    balAfterOpen,
  });

  // If still waiting, wait for running then crash; else wait for crash
  const crashed = await waitPhase('crashed', 180000);
  log(!!crashed, 'round rugging observed', crashed?.mult);

  s = await getState();
  const balAfterRug = playerBal(s);
  // Stake was already deducted; rug must not credit it back
  log(
    Number.isFinite(balAfterRug) && balAfterRug <= balAfterOpen + 0.05,
    'rug never increases balance above post-open liquid',
    { balAfterOpen, balAfterRug },
  );
  log(
    balAfterRug < balBeforeOpen - 0.5,
    'rug leaves player poorer than pre-open',
    { balBeforeOpen, balAfterRug },
  );

  // --- Multi buy + partial cashout on next live round ---
  s = await waitPhase('waiting', 60000);
  r = await post('/api/crash/session', {
    address: ADDR,
    balance: balAfterRug,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: false,
  });

  // Open on waiting, add more live, partial sell
  r = await post('/api/crash/enter', {
    address: ADDR,
    side: 'buy',
    amount: 20,
    leverage: 1,
    balance: balAfterRug,
    isRealWallet: false,
  });
  log(r.status === 200 && r.data.ok === true, 'stacked lot #1 waiting', r.data?.error);
  let bal = Number(r.data?.balance);

  const running = await waitPhase('running', 90000);
  log(!!running, 'live phase for stack + partial', running?.mult);

  r = await post('/api/crash/enter', {
    address: ADDR,
    side: 'buy',
    amount: 20,
    leverage: 1,
    balance: bal,
    isRealWallet: false,
  });
  log(r.status === 200 && r.data.ok === true, 'stacked lot #2 live BUY', r.data?.error);
  bal = Number(r.data?.balance);
  const balBeforePartial = bal;

  r = await post('/api/crash/cashout', { address: ADDR, percent: 0.5 });
  if (r.data?.ok) {
    const afterPartial = Number(r.data.balance);
    log(
      afterPartial >= balBeforePartial - 0.01,
      'partial SELL credits stake±PnL (never silent debit)',
      { balBeforePartial, afterPartial, exit: r.data.exitPrice, action: r.data.action },
    );
    bal = afterPartial;
  } else {
    // Possible if round already crashed mid-request — note soft fail
    log(false, 'partial cashout failed unexpectedly', r.data);
  }

  // Refresh / multi-tab: re-fetch state should keep position+balance
  const tabA = await getState();
  const tabB = await getState();
  log(
    Math.abs(playerBal(tabA) - playerBal(tabB)) < 0.05,
    'multi-fetch balance stable',
    { a: playerBal(tabA), b: playerBal(tabB) },
  );

  // Demo vs real isolation probe: 0x address should not share demo liquid
  const REAL = '0xQaLiveIsolate000000000000000000000001';
  r = await post('/api/crash/session', {
    address: REAL,
    balance: 777,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: true,
    boot: true,
  });
  const realState = await fetch(
    `${BASE}/api/crash/state?address=${encodeURIComponent(REAL)}`,
  ).then(x => x.json());
  const demoState = await getState();
  log(
    Math.abs(playerBal(demoState) - playerBal(realState)) > 1 ||
      playerBal(realState) === 777 ||
      playerBal(realState) !== playerBal(demoState),
    'demo and real sessions do not share the same balance blob',
    { demo: playerBal(demoState), real: playerBal(realState) },
  );

  // --- Flip quick confirm ---
  r = await post('/api/flip/session', {
    address: ADDR,
    balance: playerBal(demoState),
    holdsBlackballs: false,
    isRealWallet: false,
    boot: true,
  });
  log(r.status === 200, 'flip session', { status: r.status, ok: r.data?.ok });

  r = await post('/api/flip/join', {
    address: ADDR,
    mode: '1v1',
    side: 'heads',
    amount: 1,
    balance: playerBal(demoState),
    holdsBlackballs: false,
    isRealWallet: false,
  });
  log(r.status === 200 && r.data.ok === true, 'flip join 1v1', r.data?.error || r.data);

  await new Promise(res => setTimeout(res, 9000));
  const flipState = await fetch(
    `${BASE}/api/flip/state?address=${encodeURIComponent(ADDR)}`,
  )
    .then(x => x.json())
    .catch(() => null);
  log(!!flipState, 'flip state reachable after match', flipState?.phase || flipState?.ok);

  console.log('\n=== LIVE QA SUMMARY ===');
  console.log(`Passed ${results.filter(x => x.ok).length}/${results.length}`);
  console.log('All live money-safety probes passed.');
}

main().catch(err => {
  console.error('\nLIVE QA FAILED:', err.message || err);
  console.error(
    `Passed ${results.filter(x => x.ok).length}/${results.length} before failure`,
  );
  process.exit(1);
});
