'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlipFullState, Flip1v1Match } from '@/lib/flip-types';
import type { FlipSide } from '@/lib/flip-engine';
import { useWallet } from '@/lib/wallet-context';
import { resolveClientSyncBalance, shouldApplyServerBalance, normalizeFlipStreamState } from '@/lib/session-balance';
import { shouldSkipSessionSync, markSessionSynced } from '@/lib/sync-session-debounce';

async function syncFlipSession(
  address: string,
  balance: number,
  holdsBlackballs: boolean,
  isRealWallet: boolean,
  boot = false,
  force = false,
) {
  if (!force && !boot && shouldSkipSessionSync(address)) {
    return null;
  }
  const res = await fetch('/api/flip/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, balance, holdsBlackballs, isRealWallet, boot }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn('[flip/session] sync failed', res.status, data.error ?? data);
    return null;
  }
  const data = await res.json();
  markSessionSynced(address);
  return typeof data.balance === 'number' ? data.balance : null;
}

const STALE_FEED_MS =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? 15000 : 8000;

export function useFlipStream() {
  const { wallet, holdBonuses, hydrated, setBlackballsBalance } = useWallet();
  const address = wallet.connected && hydrated ? wallet.address : null;
  const holdsBlackballs = holdBonuses.active.some(b => b.token === 'BLACKBALLS');
  const [state, setState] = useState<FlipFullState | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const sessionReadyRef = useRef(false);
  const walletBalanceRef = useRef(wallet.blackballsBalance);
  const walletRef = useRef(wallet);
  const holdsBbRef = useRef(holdsBlackballs);
  const balanceHoldRef = useRef(false);
  const pendingBalanceRef = useRef<number | null>(null);

  const applyBalanceFromServer = useCallback(
    (balance: number, force = false) => {
      if (!force && balanceHoldRef.current) {
        pendingBalanceRef.current = balance;
        return;
      }
      setBlackballsBalance(balance);
      walletBalanceRef.current = balance;
    },
    [setBlackballsBalance],
  );

  const setBalanceHold = useCallback(
    (hold: boolean) => {
      if (hold === balanceHoldRef.current) return;
      balanceHoldRef.current = hold;
      if (!hold && pendingBalanceRef.current != null) {
        const bal = pendingBalanceRef.current;
        pendingBalanceRef.current = null;
        setBlackballsBalance(bal);
        walletBalanceRef.current = bal;
      }
    },
    [setBlackballsBalance],
  );

  useEffect(() => {
    walletBalanceRef.current = wallet.blackballsBalance;
    walletRef.current = wallet;
    holdsBbRef.current = holdsBlackballs;
  }, [wallet, holdsBlackballs]);

  const syncBalance = useCallback(async (boot = false, force = false) => {
    const addr = walletRef.current.connected && walletRef.current.address;
    if (!addr) return null;
    const balance = resolveClientSyncBalance(walletRef.current);
    return syncFlipSession(addr, balance, holdsBbRef.current, walletRef.current.isRealWallet, boot, force);
  }, []);

  // Live SSE — spectators and players.
  useEffect(() => {
    if (!hydrated) {
      setState(null);
      setConnected(false);
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let staleTimer: ReturnType<typeof setInterval> | null = null;
    let lastMsgAt = Date.now();

    const streamUrl = address
      ? `/api/flip/stream?address=${encodeURIComponent(address)}`
      : '/api/flip/stream';

    const connectStream = () => {
      if (cancelled) return;
      es?.close();
      es = new EventSource(streamUrl);
      lastMsgAt = Date.now();
      es.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        retry = 0;
        lastMsgAt = Date.now();
      };
      es.onmessage = e => {
        lastMsgAt = Date.now();
        try {
          const parsed = JSON.parse(e.data) as FlipFullState;
          const walletBal = resolveClientSyncBalance(walletRef.current);
          let walletBalanceToApply: number | null = null;
          setState(prev => {
            const next = normalizeFlipStreamState(parsed, prev, walletBal);
            if (
              sessionReadyRef.current &&
              typeof next.player?.balance === 'number' &&
              shouldApplyServerBalance(
                next.player.balance,
                walletBalanceRef.current,
                !walletRef.current.isRealWallet,
              )
            ) {
              walletBalanceToApply = next.player.balance;
            }
            return next;
          });
          if (walletBalanceToApply != null) {
            applyBalanceFromServer(walletBalanceToApply);
          }
        } catch (err) {
          console.warn('[flip/stream] parse failed — reconnecting', err);
          es?.close();
          es = null;
          retryTimer = setTimeout(connectStream, 500);
        }
      };
      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        es?.close();
        es = null;
        retry++;
        retryTimer = setTimeout(connectStream, Math.min(1000 * retry, 5000));
      };
    };

    connectStream();
    staleTimer = setInterval(() => {
      if (cancelled || !es) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - lastMsgAt > STALE_FEED_MS) {
        console.warn('[flip/stream] stale feed — reconnecting');
        es.close();
        es = null;
        connectStream();
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (staleTimer) clearInterval(staleTimer);
      es?.close();
    };
  }, [hydrated, address, applyBalanceFromServer]);

  // Session sync — wallet-context boots once; merge view in background without blocking UI.
  useEffect(() => {
    if (!hydrated) {
      setSessionReady(false);
      sessionReadyRef.current = false;
      return;
    }

    if (!address) {
      setSessionReady(true);
      sessionReadyRef.current = true;
      return;
    }

    sessionReadyRef.current = true;
    setSessionReady(true);

    let cancelled = false;
    void (async () => {
      const synced = await syncBalance(false, true);
      if (cancelled || synced == null) return;
      applyBalanceFromServer(synced, true);
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, address, syncBalance, applyBalanceFromServer]);

  const ensureSession = useCallback(async () => {
    if (!address) return false;
    if (sessionReadyRef.current) return true;
    sessionReadyRef.current = true;
    setSessionReady(true);
    return true;
  }, [address]);

  const flip = useCallback(
    async (params: {
      mode: '1v1' | 'dogpile';
      side: FlipSide;
      amount: number;
      message?: string;
      matchId?: string;
    }) => {
      if (!address) return { ok: false, error: 'Connect wallet first' };
      await ensureSession();

      const amount = Math.floor(params.amount * 1000) / 1000;
      if (amount <= 0) return { ok: false, error: 'Set a wager above 0' };

      const w = walletRef.current;
      const clientBalance = resolveClientSyncBalance(w);

      const runJoin = async () => {
        const res = await fetch('/api/flip/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            ...params,
            amount,
            balance: clientBalance,
            holdsBlackballs: holdsBbRef.current,
            isRealWallet: w.isRealWallet,
          }),
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

      try {
        // Boot-sync before join — fixes stale zero balance / orphan lobbies after Crash tab play.
        const synced = await syncFlipSession(
          address,
          clientBalance,
          holdsBbRef.current,
          w.isRealWallet,
          true,
          true,
        );
        if (synced != null) applyBalanceFromServer(synced, true);

        let { res, data } = await runJoin();

        if (
          !res.ok &&
          typeof data.error === 'string' &&
          (data.error.includes('already in a match') ||
            data.error.includes('insufficient balance') ||
            data.error.includes('no open match'))
        ) {
          await fetch('/api/flip/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address }),
          }).catch(() => {});
          await syncFlipSession(
            address,
            clientBalance,
            holdsBbRef.current,
            w.isRealWallet,
            true,
            true,
          );
          ({ res, data } = await runJoin());
        }

        if (!res.ok) {
          console.warn('[flip/join] rejected', res.status, data.error ?? data);
          return { ok: false, error: typeof data.error === 'string' ? data.error : 'Flip rejected' };
        }
        if (typeof data.balance === 'number') {
          applyBalanceFromServer(data.balance, true);
        }
        if (data.matchId) {
          setState(prev => {
            if (!prev?.player) return prev;
            const waitingMatch = data.waitingMatch as Flip1v1Match | null | undefined;
            const activeMatch = data.activeMatch as Flip1v1Match | null | undefined;
            let open1v1 = prev.open1v1;
            if (waitingMatch && !open1v1.some(m => m.id === waitingMatch.id)) {
              open1v1 = [...open1v1, waitingMatch];
            }
            return {
              ...prev,
              open1v1,
              active1v1:
                activeMatch?.status === 'flipping' || activeMatch?.status === 'done'
                  ? activeMatch
                  : prev.active1v1,
              player: {
                ...prev.player,
                active1v1Id: data.matchId as string,
                balance: typeof data.balance === 'number' ? data.balance : prev.player.balance,
              },
            };
          });
        }
        return { ok: true, matchId: data.matchId as string | undefined };
      } catch {
        return { ok: false, error: 'Network error' };
      }
    },
    [address, ensureSession, applyBalanceFromServer],
  );

  const revenge = useCallback(
    async (wager?: number) => {
      if (!address) return { ok: false, error: 'Connect wallet first' };
      await ensureSession();
      try {
        const res = await fetch('/api/flip/revenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, wager }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error ?? 'Revenge failed' };
        if (typeof data.balance === 'number') {
          applyBalanceFromServer(data.balance, true);
        }
        return { ok: true, matchId: data.matchId as string | undefined };
      } catch {
        return { ok: false, error: 'Network error' };
      }
    },
    [address, ensureSession, applyBalanceFromServer],
  );

  const cancelWaiting = useCallback(async () => {
    if (!address) return { ok: false };
    const res = await fetch('/api/flip/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const data = await res.json().catch(() => ({}));
    if (typeof data.balance === 'number') {
      applyBalanceFromServer(data.balance, true);
    }
    return { ok: res.ok };
  }, [address, applyBalanceFromServer]);

  return {
    state,
    connected,
    sessionReady,
    flip,
    revenge,
    cancelWaiting,
    setBalanceHold,
    walletConnected: !!address,
    holdsBlackballs,
  };
}
