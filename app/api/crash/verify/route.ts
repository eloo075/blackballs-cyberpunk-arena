import { NextRequest, NextResponse } from 'next/server';
import { verifyCrashRound } from '@/lib/crash-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const serverSeed = typeof body.serverSeed === 'string' ? body.serverSeed.trim() : '';
  const serverSeedHash = typeof body.serverSeedHash === 'string' ? body.serverSeedHash.trim() : '';
  const clientSeed = typeof body.clientSeed === 'string' ? body.clientSeed.trim() : '';
  const nonce = parseInt(body.nonce, 10);
  const expectedCrashPoint = parseFloat(body.expectedCrashPoint);

  if (!serverSeed || !serverSeedHash || !clientSeed || !Number.isFinite(nonce) || !Number.isFinite(expectedCrashPoint)) {
    return NextResponse.json({ valid: false, reason: 'invalid payload' }, { status: 400 });
  }

  const result = verifyCrashRound({
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    expectedCrashPoint,
  });

  return NextResponse.json(result, { status: 200 });
}
