import { NextRequest, NextResponse } from 'next/server';
import { verifyFlipRound } from '@/lib/flip-engine';
import type { FlipSide } from '@/lib/flip-engine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const serverSeed = typeof body.serverSeed === 'string' ? body.serverSeed : '';
  const serverSeedHash = typeof body.serverSeedHash === 'string' ? body.serverSeedHash : '';
  const clientSeed = typeof body.clientSeed === 'string' ? body.clientSeed : '';
  const nonce = parseInt(body.nonce, 10);
  const expectedSide = body.expectedSide === 'tails' ? 'tails' : 'heads';

  if (!serverSeed || !serverSeedHash || !clientSeed || !Number.isFinite(nonce)) {
    return NextResponse.json({ valid: false, reason: 'invalid payload' }, { status: 400 });
  }

  const result = verifyFlipRound({
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    expectedSide: expectedSide as FlipSide,
  });

  return NextResponse.json(result, { status: result.valid ? 200 : 400 });
}
