import { NextRequest, NextResponse } from 'next/server';
import { registerCampaignWallet } from '@/lib/launch-campaign-store';

export const dynamic = 'force-dynamic';

/** Per-instance in-memory limiter (not shared across Fly machines). */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function allowIp(ip: string): boolean {
  const now = Date.now();
  if (rateBuckets.size > 4000) {
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }
  const existing = rateBuckets.get(ip);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_MAX) return false;
  existing.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!allowIp(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many submissions — try again in a minute' },
      { status: 429 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await registerCampaignWallet(body.address);

    if (!result.ok) {
      return NextResponse.json(result, { status: result.full ? 409 : 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Campaign registration unavailable';
    console.error('[campaign/register]', message);
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
