import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';
import { fromTokenWei, getSessionBalance, isVaultEnabled } from '@/lib/chain/crash-vault-client';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === 'string' ? body.address : null;
  const balance = parseFloat(body.balance);
  const stimmy = parseFloat(body.stimmy);
  const frenzy = parseFloat(body.frenzy);
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
  }

  const finalBalance = getManager().syncPlayer(address, syncedBalance, {
    stimmy: isNaN(stimmy) ? 0 : stimmy,
    frenzy: isNaN(frenzy) ? 0 : frenzy,
  });

  return NextResponse.json({
    ok: true,
    balance: finalBalance,
    vaultSynced: isVaultEnabled(),
  });
}
