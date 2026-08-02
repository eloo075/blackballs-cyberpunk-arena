const BASE = process.env.BASE_URL ?? 'http://localhost:3004';
const ADDRESS = '7xIso' + Date.now();

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

async function waitCountdown() {
  for (let i = 0; i < 80; i++) {
    const res = await fetch(`${BASE}/api/crash/stream?address=${encodeURIComponent(ADDRESS)}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (let j = 0; j < 30; j++) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const idx = buf.indexOf('data: ');
      if (idx < 0) continue;
      const nl = buf.indexOf('\n', idx);
      if (nl <= idx) continue;
      const s = JSON.parse(buf.slice(idx + 6, nl));
      await reader.cancel().catch(() => {});
      if (s.phase === 'waiting' && s.waitLeft > 2) return s;
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('timeout');
}

async function main() {
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

  await waitCountdown();
  const enter = await post('/api/crash/enter', {
    address: ADDRESS,
    side: 'buy',
    amount: 10,
    leverage: 1,
    balance: 100,
    isRealWallet: false,
  });
  console.log('crash enter', enter.data);

  const crashS = await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: false,
  });
  const flipS = await post('/api/flip/session', {
    address: ADDRESS,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: false,
  });
  console.log('after bet — crash', crashS.data.balance, 'flip', flipS.data.balance);

  const join = await post('/api/flip/join', {
    address: ADDRESS,
    mode: '1v1',
    side: 'heads',
    amount: 1,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
  });
  console.log('flip join', join.data);

  const crashS2 = await post('/api/crash/session', {
    address: ADDRESS,
    balance: 100,
    stimmy: 0,
    frenzy: 0,
    isRealWallet: false,
    boot: false,
  });
  const flipS2 = await post('/api/flip/session', {
    address: ADDRESS,
    balance: 100,
    holdsBlackballs: false,
    isRealWallet: false,
    boot: false,
  });
  console.log('after join — crash', crashS2.data.balance, 'flip', flipS2.data.balance);

  const gap = Math.abs(crashS2.data.balance - flipS2.data.balance);
  if (gap > 0.01) {
    console.error('FAIL: balance gap', gap);
    process.exit(1);
  }
  console.log('PASS: balances aligned');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
