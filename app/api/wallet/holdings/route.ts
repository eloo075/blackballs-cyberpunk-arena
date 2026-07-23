import { NextRequest, NextResponse } from 'next/server';
import { HOLD_THRESHOLDS } from '@/lib/hold-bonuses';

export const dynamic = 'force-dynamic';

/** Resolve token holdings for a wallet. Demo wallets use client balances; real wallets would query RPC. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  if (!address) {
    return NextResponse.json({ ok: false, error: 'missing address' }, { status: 400 });
  }

  const isRealWallet = body.isRealWallet === true;
  const blackballs = parseFloat(body.blackballsBalance) || 0;
  const ansem = parseFloat(body.ansemBalance) || 0;
  const cashcat = parseFloat(body.cashcatBalance) || 0;

  if (isRealWallet) {
    // Placeholder for on-chain SPL balance lookup once real wallet adapter is wired.
    return NextResponse.json({
      ok: true,
      blackballs,
      ansem,
      cashcat,
      source: 'chain-pending',
    });
  }

  // Demo: deterministic holdings seeded from address so reconnects stay consistent.
  const seed = address.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
  const demoAnsem =
    ansem > 0 ? ansem : seed % 3 !== 0 ? Math.floor((seed * 17) % 4000) + HOLD_THRESHOLDS.ansem : 0;
  const demoCashcat =
    cashcat > 0 ? cashcat : seed % 4 !== 0 ? Math.floor((seed * 23) % 6000) + HOLD_THRESHOLDS.cashcat : 0;

  return NextResponse.json({
    ok: true,
    blackballs,
    ansem: demoAnsem,
    cashcat: demoCashcat,
    source: 'demo',
  });
}
