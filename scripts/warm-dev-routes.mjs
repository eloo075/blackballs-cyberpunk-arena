/** Hit critical API routes once so first in-browser click is not blocked by dev compile. */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADDRESS = '7xKwarm' + 'a'.repeat(36) + 'demo';

async function warm(path, init) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(120000),
    });
    console.log(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
  } catch (err) {
    console.warn(`${path} warm failed:`, err.message ?? err);
  }
}

async function main() {
  console.log('Warming dev routes at', BASE);
  await warm('/');
  await warm('/api/crash/stream');
  await warm('/api/flip/stream');
  await warm('/api/crash/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: ADDRESS,
      balance: 100,
      stimmy: 0,
      frenzy: 0,
      isRealWallet: false,
      boot: true,
    }),
  });
  await warm('/api/crash/enter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: ADDRESS,
      side: 'buy',
      amount: 0.01,
      leverage: 1,
      balance: 100,
      isRealWallet: false,
    }),
  });
  await warm('/api/crash/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: ADDRESS }),
  });
  console.log('Warmup done — reload the game page.');
}

main();
