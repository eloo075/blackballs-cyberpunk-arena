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

const TAB_FOCUS_DEBOUNCE_MS = 450;

/** Re-sync server game state when a tab becomes visible (Crash ↔ Flip balance drift). */
export function useGameTabFocus(
  visible: boolean,
  opts: GameTabFocusOpts,
  onFocused?: () => void,
) {
  const wasVisibleRef = useRef(false);
  const optsRef = useRef(opts);
  const onFocusedRef = useRef(onFocused);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    optsRef.current = opts;
    onFocusedRef.current = onFocused;
  });

  useEffect(() => {
    const becameVisible = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!becameVisible) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
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
        window.setTimeout(() => onFocusedRef.current?.(), 280);
      });
    }, TAB_FOCUS_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [visible, opts.connected, opts.address]);
}
