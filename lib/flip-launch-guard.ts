import { NextResponse } from 'next/server';
import { FLIP_PLAYABLE, FLIP_UNAVAILABLE_MESSAGE } from '@/lib/launch-surface';

export function flipUnavailableResponse() {
  return NextResponse.json(
    { ok: false, error: FLIP_UNAVAILABLE_MESSAGE, flipLocked: true },
    { status: 403 },
  );
}

/** Block Flip join / cancel / revenge while Flip is coming-soon. */
export function assertFlipPlayable(): NextResponse | null {
  if (!FLIP_PLAYABLE) return flipUnavailableResponse();
  return null;
}
