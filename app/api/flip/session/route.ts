import { NextRequest, NextResponse } from 'next/server';
import { getFlipManager } from '@/lib/flip-manager';
import { fromTokenWei, getSessionBalance, isVaultEnabled } from '@/lib/chain/crash-vault-client';
import { normalizeDemoSessionBalance } from '@/lib/session-balance';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const balance = parseFloat(body.balance);
  const holdsBlackballs = body.holdsBlackballs === true;
  const boot = body.boot === true;
  const isRealWallet = body.isRealWallet === true;

  if (!address) {
    return NextResponse.json({ ok: false, error: 'wallet not connected' }, { status: 401 });
  }

  let syncedBalance = !isNaN(balance) && balance >= 0 ? balance : 0;

  if (isVaultEnabled() && address.startsWith('0x')) {
    try {
      const onChain = await getSessionBalance(address);
      syncedBalance = fromTokenWei(onChain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'vault read failed';
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
  } else if (isNaN(balance) || balance < 0) {
    return NextResponse.json({ ok: false, error: 'invalid balance' }, { status: 400 });
  } else {
    syncedBalance = normalizeDemoSessionBalance(address, syncedBalance, isRealWallet);
  }

  const finalBalance = getFlipManager().syncPlayer(address, syncedBalance, holdsBlackballs, { boot });

  return NextResponse.json({ ok: true, balance: finalBalance, vaultSynced: isVaultEnabled() });
}
