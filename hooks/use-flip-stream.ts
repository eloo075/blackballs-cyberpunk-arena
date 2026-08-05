'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlipFullState, Flip1v1Match } from '@/lib/flip-types';
import type { FlipSide } from '@/lib/flip-engine';
import { useWallet } from '@/lib/wallet-context';
import { resolveClientSyncBalance, shouldApplyServerBalance, normalizeFlipStreamState } from '@/lib/session-balance';
import { shouldSkipSessionSync, markSessionSynced } from '@/lib/sync-session-debounce';
import { notifyDemoRefresh, subscribeDemoTabMessages } from '@/lib/demo-tab-coordinator';
import { isLikelyMobileDevice } from '@/hooks/use-page-visibility';

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
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
    ? 15000
    : isLikelyMobileDevice()
      ? 20000
      : 12000;

const FLIP_JOIN_TIMEOUT_MS = isLikelyMobileDevice() ? 22000 : 15000;
const FLIP_RETRY_RE = /already in a match|insufficient balance|no open match|match not available/i;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  const stateRef = useRef(state);
  const actionLockRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const refreshFlipState = useCallback(async () => {
    const addr = walletRef.current.connected && walletRef.current.address;
    const url = addr
      ? `/api/flip/state?address=${encodeURIComponent(addr)}`
      : '/api/flip/state';
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const parsed = (await res.json()) as FlipFullState;
      const walletBal = resolveClientSyncBalance(walletRef.current);
      setState(prev => normalizeFlipStreamState(parsed, prev, walletBal));
    } catch (err) {
      console.warn('[flip/state] refresh failed', err);
    }
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
        void refreshFlipState();
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
  }, [hydrated, address, applyBalanceFromServer, refreshFlipState]);

  useEffect(() => {
    if (!hydrated) return;
    const onVisible = () => {
      if (document.hidden) return;
      void refreshFlipState();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [hydrated, refreshFlipState]);

  useEffect(() => {
    if (!address) return;
    return subscribeDemoTabMessages(address, msg => {
      if (msg.type === 'refresh' && (msg.game === 'flip' || msg.game === 'both')) {
        void refreshFlipState();
      }
    });
  }, [address, refreshFlipState]);

  useEffect(() => {
    if (!hydrated || state != null || !connected) return;
    void refreshFlipState();
  }, [hydrated, connected, state, refreshFlipState]);

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
      if (actionLockRef.current) return { ok: false, error: 'Action in progress — wait a moment' };
      actionLockRef.current = 'flip';
      await ensureSession();

      const amount = Math.floor(params.amount * 1000) / 1000;
      if (amount <= 0) {
        actionLockRef.current = null;
        return { ok: false, error: 'Set a wager above 0' };
      }

      const w = walletRef.current;
      const clientBalance = resolveClientSyncBalance(w);

      const applyJoinSuccess = (data: Record<string, unknown>) => {
        if (typeof data.balance === 'number') {
          applyBalanceFromServer(data.balance, true);
        }
        if (data.matchId) {
          setState(prev => {
            if (!prev) return prev;
            const waitingMatch = data.waitingMatch as Flip1v1Match | null | undefined;
            const activeMatch = data.activeMatch as Flip1v1Match | null | undefined;
            let open1v1 = prev.open1v1;
            if (waitingMatch && !open1v1.some(m => m.id === waitingMatch.id)) {
              open1v1 = [...open1v1, waitingMatch];
            }
            const player = prev.player ?? {
              balance: typeof data.balance === 'number' ? data.balance : 0,
              holdsBlackballs: holdsBbRef.current,
              rakeRate: 0,
              maxBet: 0,
              winStreak: 0,
              lossStreak: 0,
              lastOpponent: null,
              active1v1Id: null,
              activeDogpileSide: null,
              lastResult: null,
            };
            return {
              ...prev,
              open1v1,
              active1v1:
                activeMatch?.status === 'flipping' || activeMatch?.status === 'done'
                  ? activeMatch
                  : prev.active1v1,
              player: {
                ...player,
                active1v1Id: data.matchId as string,
                balance: typeof data.balance === 'number' ? data.balance : player.balance,
              },
            };
          });
        }
      };

      const runJoin = async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FLIP_JOIN_TIMEOUT_MS);
        try {
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
            signal: controller.signal,
          });
          const data = await res.json().catch(() => ({}));
          return { res, data };
        } finally {
          clearTimeout(timer);
        }
      };

      try {
        let lastErr = 'Flip rejected';

        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt > 0) {
            await syncFlipSession(
              address,
              clientBalance,
              holdsBbRef.current,
              w.isRealWallet,
              true,
              true,
            );
            await refreshFlipState();
            await sleep(50 * attempt);
          } else {
            const synced = await syncFlipSession(
              address,
              clientBalance,
              holdsBbRef.current,
              w.isRealWallet,
              true,
              true,
            );
            if (synced != null) applyBalanceFromServer(synced, true);
          }

          let { res, data } = await runJoin();

          if (
            !res.ok &&
            typeof data.error === 'string' &&
            FLIP_RETRY_RE.test(data.error)
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

          if (res.ok && data.ok !== false) {
            applyJoinSuccess(data);
            notifyDemoRefresh(address, 'flip');
            void refreshFlipState();
            return { ok: true, matchId: data.matchId as string | undefined };
          }

          lastErr = typeof data.error === 'string' ? data.error : 'Flip rejected';
          if (!FLIP_RETRY_RE.test(lastErr)) {
            return { ok: false, error: lastErr };
          }
        }

        void refreshFlipState();
        return { ok: false, error: lastErr };
      } catch (err) {
        void refreshFlipState();
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, error: 'Flip timed out — try again' };
        }
        return { ok: false, error: 'Network error' };
      } finally {
        if (actionLockRef.current === 'flip') actionLockRef.current = null;
      }
    },
    [address, ensureSession, applyBalanceFromServer, refreshFlipState],
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
    if (actionLockRef.current) return { ok: false };
    actionLockRef.current = 'cancel';
    try {
    const res = await fetch('/api/flip/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    const data = await res.json().catch(() => ({}));
    if (typeof data.balance === 'number') {
      applyBalanceFromServer(data.balance, true);
    }
    if (res.ok) {
      notifyDemoRefresh(address, 'flip');
      setState(prev => {
        if (!prev?.player) return prev;
        return {
          ...prev,
          open1v1: prev.open1v1.filter(m => m.creator.address !== address),
          player: { ...prev.player, active1v1Id: null, balance: typeof data.balance === 'number' ? data.balance : prev.player.balance },
        };
      });
      void refreshFlipState();
    }
    return { ok: res.ok };
    } finally {
      if (actionLockRef.current === 'cancel') actionLockRef.current = null;
    }
  }, [address, applyBalanceFromServer, refreshFlipState]);

  return {
    state,
    connected,
    sessionReady,
    flip,
    revenge,
    cancelWaiting,
    setBalanceHold,
    refreshFlipState,
    walletConnected: !!address,
    holdsBlackballs,
  };
}
