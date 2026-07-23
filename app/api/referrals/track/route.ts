import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function normalizeRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return null;
  return code;
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'supabase not configured' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase unavailable' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const address = normalizeAddress(body.address);
  const refCode = normalizeRef(body.ref ?? body.referralCode);

  if (!address) {
    return NextResponse.json({ ok: false, error: 'invalid wallet address' }, { status: 400 });
  }
  if (!refCode) {
    return NextResponse.json({ ok: false, error: 'invalid referral code' }, { status: 400 });
  }

  const { data: referrer, error: referrerError } = await supabase
    .from('profiles')
    .select('wallet_address, referral_code')
    .eq('referral_code', refCode)
    .maybeSingle();

  if (referrerError) {
    return NextResponse.json({ ok: false, error: referrerError.message }, { status: 500 });
  }
  if (!referrer) {
    return NextResponse.json({ ok: false, error: 'referral code not found' }, { status: 404 });
  }

  const referrerAddress = referrer.wallet_address.toLowerCase();
  if (referrerAddress === address) {
    return NextResponse.json({ ok: false, error: 'cannot refer yourself' }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('wallet_address, referred_by')
    .eq('wallet_address', address)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  }

  if (existing?.referred_by) {
    return NextResponse.json({
      ok: true,
      alreadyBound: true,
      referredBy: existing.referred_by,
    });
  }

  const { error: upsertError } = await supabase.from('profiles').upsert(
    {
      wallet_address: address,
      referred_by: referrerAddress,
    },
    { onConflict: 'wallet_address' },
  );

  if (upsertError) {
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    referredBy: referrerAddress,
    referralCode: refCode,
  });
}
