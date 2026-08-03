import { NextRequest, NextResponse } from 'next/server';
import * as flip from '@/lib/api/flip-routes';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function actionFrom(ctx: RouteCtx): Promise<string> {
  return ((await ctx.params).path ?? [])[0] ?? '';
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  switch (await actionFrom(ctx)) {
    case 'stream':
      return flip.handleStream(req);
    case 'state':
      return flip.handleState(req);
    default:
      return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  switch (await actionFrom(ctx)) {
    case 'join':
      return flip.handleJoin(req);
    case 'session':
      return flip.handleSession(req);
    case 'cancel':
      return flip.handleCancel(req);
    case 'revenge':
      return flip.handleRevenge(req);
    case 'verify':
      return flip.handleVerify(req);
    default:
      return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
