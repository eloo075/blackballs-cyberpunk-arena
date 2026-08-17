import { NextRequest, NextResponse } from 'next/server';
import * as crash from '@/lib/api/crash-routes';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function actionFrom(ctx: RouteCtx): Promise<string> {
  return ((await ctx.params).path ?? [])[0] ?? '';
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  switch (await actionFrom(ctx)) {
    case 'stream':
      return crash.handleStream(req);
    case 'state':
      return crash.handleState(req);
    case 'leaderboard':
      return crash.handleLeaderboard(req);
    default:
      return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  switch (await actionFrom(ctx)) {
    case 'enter':
      return crash.handleEnter(req);
    case 'session':
      return crash.handleSession(req);
    case 'cancel':
      return crash.handleCancel(req);
    case 'cashout':
      return crash.handleCashout(req);
    case 'auto':
      return crash.handleAuto(req);
    case 'verify':
      return crash.handleVerify(req);
    case 'refill':
      return crash.handleRefill(req);
    default:
      return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
