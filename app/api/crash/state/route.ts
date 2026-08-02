import { NextRequest, NextResponse } from 'next/server';
import { getManager } from '@/lib/crash-manager';

export const dynamic = 'force-dynamic';

/** Lightweight snapshot for SSE reconnect / client resync. */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const manager = getManager();
  return NextResponse.json(manager.snapshotForStream(address));
}
