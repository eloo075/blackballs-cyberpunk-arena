'use client';

import { useEffect, useRef } from 'react';
import { syncGameSessionBalances } from '@/lib/sync-game-sessions';

type GameTabFocusOpts = {
  address: string | null;
  connected: boolean;
  balance: number;
  stimmy: number;
  frenzy: number;
  holdsBlackballs: boolean;
  isRealWallet: boolean;
};

/** Re-sync server game state when a tab becomes visible (Crash ↔ Flip balance drift). */
export function useGameTabFocus(
  visible: boolean,
  opts: GameTabFocusOpts,
  onFocused?: () => void,
) {
  const wasVisibleRef = useRef(false);
  const optsRef = useRef(opts);
  const onFocusedRef = useRef(onFocused);

  useEffect(() => {
    optsRef.current = opts;
    onFocusedRef.current = onFocused;
  });

  useEffect(() => {
    const becameVisible = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!becameVisible) return;

    const o = optsRef.current;
    if (!o.connected || !o.address) return;

    void syncGameSessionBalances(
      o.address,
      o.balance,
      o.stimmy,
      o.frenzy,
      o.holdsBlackballs,
      o.isRealWallet,
      false,
      true,
    ).finally(() => {
      onFocusedRef.current?.();
    });
  }, [visible, opts.connected, opts.address]);
}
