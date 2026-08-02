/** Deep diagnostic: position sync, balance desync, multi-round stress. */
const ADDRESS =
  process.env.TEST_ADDRESS ??
  '7xDiag' + Math.random().toString(36).slice(2, 10) + 'demo';

async function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  for (const port of [3003, 3001, 3000]) {
    try {
      const res = await fetch(`http://localhost:${port}/api/market-listings`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) return `http://localhost:${port}`;
    } catch {
      /* next */
    }
  }
  throw new Error('Dev server not running — npm run dev:clean');
}

let BASE = 'http://localhost:3003';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function readCrashOnce() {
  const res = await fetch(`${BASE}/api/crash/stream?address=${encodeURIComponent(ADDRESS)}`);
  const reader = res.body?.getReader();
  if (!reader) return null;
  const dec = new TextDecoder();
  let buf = '';
  for (let i = 0; i < 60; i++) {
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
      /* wait */
    }
  }
  await reader.cancel().catch(() => {});
  return null;
}

async function readFlipOnce() {
  const res = await fetch(`${BASE}/api/flip/stream?address=${encodeURIComponent(ADDRESS)}`);
  const reader = res.body?.getReader();
  if (!reader) return null;
  const dec = new TextDecoder();
  let buf = '';
  for (let i = 0; i < 60; i++) {
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
      /* wait */
    }
  }
  await reader.cancel().catch(() => {});
  return null;
}

async function waitCrashPhase(target, maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const s = await readCrashOnce();
    if (s?.phase === target) return s;
    await sleep(350);
  }
  return null;
}

async function waitCountdown(minWaitLeft = 2, maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const s = await readCrashOnce();
    if (s?.phase === 'waiting' && s.waitLeft >= minWaitLeft) return s;
    await sleep(300);
  }
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function log(section, msg, detail) {
  console.log(`\n[${section}] ${msg}`);
  if (detail !== undefined) console.log(JSON.stringify(detail, null, 2));
}

function bug(name, detail) {
  console.error(`\n🐛 BUG: ${name}`);
  if (detail) console.error(JSON.stringify(detail, null, 2));
}

async function main() {
  BASE = await resolveBaseUrl();
  console.log('Diagnose against', BASE);
  console.log('Address', ADDRESS);

  // Boot both games
  let r = await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: true,
  });
  log('boot', 'crash session', r.data);

  r = await post('/api/flip/session', {
    address: ADDRESS,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: true,
  });
  log('boot', 'flip session', r.data);

  // --- TEST 1: Session view after pending entry ---
  log('test1', 'Pending entry view sync');
  await waitCountdown(3);
  r = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'sell',
    amount: 5,
    leverage: 2,
    balance: 100,
    isRealWallet: false,
  });
  log('test1', 'enter short', r);

  r = await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: false,
  });
  if (!r.data.view?.hasPosition || !r.data.view?.entryPending) {
    bug('Session view missing pending position after short entry', r.data.view);
  } else {
    console.log('OK: session view shows pending short', r.data.view);
  }

  // Cancel via opposite side
  r = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'buy',
    amount: 5,
    leverage: 2,
    balance: 100,
    isRealWallet: false,
  });
  log('test1', 'cancel via buy', r);

  // --- TEST 2: Balance desync crash vs flip ---
  log('test2', 'Balance desync after crash-only play');
  await waitCountdown(3);
  r = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'buy',
    amount: 10,
    leverage: 1,
    balance: 100,
    isRealWallet: false,
  });
  const crashBalAfterBet = r.data.balance;
  log('test2', 'crash bet placed', { balance: crashBalAfterBet });

  const crashStream = await readCrashOnce();
  const flipSess = await post('/api/flip/session', {
    address: ADDRESS,
    balance: crashBalAfterBet ?? 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: false,
  });
  log('test2', 'stream balances after crash bet', {
    crashStream: crashStream?.balance,
    flipSession: flipSess.data.balance,
  });

  if (
    typeof crashStream?.balance === 'number' &&
    typeof flipSess.data.balance === 'number' &&
    Math.abs(crashStream.balance - flipSess.data.balance) > 0.01
  ) {
    bug('Crash and Flip balances diverged after crash-only bet', {
      crash: crashStream.balance,
      flip: flipSess.data.balance,
    });
  } else {
    console.log('OK: crash and flip balances aligned after bet');
  }

  // Flip join with stale wallet balance (simulates tab switch without sync)
  r = await post('/api/flip/join', {
    address: ADDRESS,
    mode: '1v1',
    side: 'heads',
    amount: 1,
    balance: 100, // stale — wallet still 100, crash server has ~90
    holdsBlackballs: false,
    isRealWallet: false,
  });
  log('test2', 'flip join with stale wallet balance 100', r);
  if (r.status === 200) {
    const crashAfter = await post('/api/crash/session', {
      address: ADDRESS,
      balance: r.data.balance ?? 100,
      stimmy: 0,
      frenzy: 0,
      isRealWallet: false,
      boot: false,
    });
    const flipBal = r.data.balance;
    if (
      flipBal != null &&
      crashAfter.data.balance != null &&
      Math.abs(flipBal - crashAfter.data.balance) > 0.05
    ) {
      bug('Balance gap after flip join with stale client balance', {
        crash: crashAfter.data.balance,
        flip: flipBal,
      });
    } else {
      console.log('OK: balances stay aligned after flip join', {
        crash: crashAfter.data.balance,
        flip: flipBal,
      });
    }
  }

  await sleep(8000); // let flip resolve

  // --- TEST 3: Rapid enter/cancel stress ---
  log('test3', 'Rapid enter/cancel stress (5 cycles)');
  await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: true,
  });
  await post('/api/flip/session', {
    address: ADDRESS,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: true,
  });

  for (let cycle = 0; cycle < 5; cycle++) {
    await waitCountdown(2.5);
    r = await post('/api/crash/enter', {
      address: ADDRESS,
      side: cycle % 2 === 0 ? 'buy' : 'sell',
      amount: 1,
      leverage: 1,
      balance: 100,
      isRealWallet: false,
    });
    if (r.status !== 200) {
      bug(`Cycle ${cycle} enter failed`, r);
      break;
    }
    r = await post('/api/crash/enter', {
      address: ADDRESS,
      side: cycle % 2 === 0 ? 'sell' : 'buy',
      amount: 1,
      leverage: 1,
      balance: 100,
      isRealWallet: false,
    });
    if (r.status !== 200) {
      bug(`Cycle ${cycle} cancel failed`, r);
      break;
    }
    console.log(`  cycle ${cycle + 1}/5 OK`);
  }

  // --- TEST 4: Duplicate enter should return view ---
  log('test4', 'Duplicate enter returns recoverable view');
  await waitCountdown(2.5);
  r = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'sell',
    amount: 3,
    leverage: 1,
    balance: 100,
    isRealWallet: false,
  });
  r = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'sell',
    amount: 3,
    leverage: 1,
    balance: 100,
    isRealWallet: false,
  });
  if (r.status === 400 && r.data.view?.entryPending && r.data.view?.hasPosition) {
    console.log('OK: 400 includes view with pending position');
  } else {
    bug('Duplicate enter missing view for client recovery', r.data);
  }

  // --- TEST 5: Flip orphan lobby ---
  log('test5', 'Flip orphan waiting lobby');
  await post('/api/flip/session', {
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
    amount: 2,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
  });
  const matchId = r.data.matchId;
  log('test5', 'created waiting lobby', { matchId, balance: r.data.balance });

  // Simulate lost pointer — boot flip without cancel
  r = await post('/api/flip/session', {
    address: ADDRESS,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: false,
  });

  r = await post('/api/flip/join', {
    address: ADDRESS,
    mode: '1v1',
    side: 'heads',
    amount: 2,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
  });
  if (r.status === 400 && String(r.data.error ?? '').includes('already')) {
    bug('Flip blocked by orphan lobby — should auto-cancel on reconcile', r.data);
  } else {
    console.log('OK: flip join after orphan handled', r.status, r.data.error ?? r.data);
  }

  // --- TEST 6: Multi-round (3 full rounds) ---
  log('test6', 'Three full crash rounds');
  await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: true,
  });

  for (let round = 0; round < 3; round++) {
    await waitCountdown(2.5);
    r = await post('/api/crash/enter', {
      address: ADDRESS,
      side: 'buy',
      amount: 2,
      leverage: 1,
      balance: 100,
      isRealWallet: false,
    });
    if (r.status !== 200) {
      bug(`Round ${round} enter failed`, r);
      break;
    }
    await waitCrashPhase('crashed', 120000);
    await waitCrashPhase('waiting', 30000);
    const s = await readCrashOnce();
    console.log(`  round ${round + 1} done, balance=${s?.balance}, phase=${s?.phase}`);
  }

  console.log('\n--- Diagnosis complete ---');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
