'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FullState } from '@/lib/crash-types';
import { useWallet } from '@/lib/wallet-context';
import { resolveClientSyncBalance, shouldApplyServerBalance, normalizeCrashStreamState, guardPendingEntryOnStream, guardLivePositionOnStream, guardCancelledPositionOnStream, resetPlayerViewForNewRound, isNewRoundTransition } from '@/lib/session-balance';
import { shouldSkipSessionSync, markSessionSynced } from '@/lib/sync-session-debounce';
import { teardownEventSource } from '@/lib/crash-event-source';
import { fetchJsonWithTimeout, actionErrorMessage } from '@/lib/action-timeout';

async function syncCrashSession(
  address: string,
  balance: number,
  stimmy: number,
  frenzy: number,
  isRealWallet: boolean,
  boot = false,
  force = false,
) {
  if (!force && !boot && shouldSkipSessionSync(address)) {
    return null;
  }
  const res = await fetch('/api/crash/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, balance, stimmy, frenzy, isRealWallet, boot }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    console.warn('[crash/session] sync failed', res.status, data.error ?? data);
    return null;
  }
  const data = await res.json();
  const bal = typeof data.balance === 'number' ? data.balance : null;
  markSessionSynced(address);
  return { balance: bal, view: data.view as CrashClientView | undefined };
}

const STALE_FEED_MS =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? 15000 : 8000;

/** Seconds before round start when new entries are blocked (avoids countdown-end race). */
const COUNTDOWN_ENTRY_BUFFER_SEC = 1.0;

type CrashClientView = {
  phase?: FullState['phase'];
  gameId?: number;
  waitLeft?: number;
  hasPosition?: boolean;
  hasLivePosition?: boolean;
  entryPending?: boolean;
  positionSide?: FullState['positionSide'];
  positionAmount?: number;
  positionLeverage?: number;
  positionEntryPrice?: number;
  balance?: number;
};

function mergeCrashClientView(prev: FullState | null, view?: CrashClientView | null): FullState | null {
  if (!prev || !view) return prev;
  return {
    ...prev,
    ...(view.phase != null ? { phase: view.phase } : {}),
    ...(view.gameId != null ? { gameId: view.gameId } : {}),
    ...(view.waitLeft != null ? { waitLeft: view.waitLeft } : {}),
    ...(view.hasPosition != null ? { hasPosition: view.hasPosition } : {}),
    ...(view.hasLivePosition != null ? { hasLivePosition: view.hasLivePosition } : {}),
    ...(view.entryPending != null ? { entryPending: view.entryPending } : {}),
    ...(view.positionSide != null ? { positionSide: view.positionSide } : {}),
    ...(view.positionAmount != null ? { positionAmount: view.positionAmount } : {}),
    ...(view.positionLeverage != null ? { positionLeverage: view.positionLeverage } : {}),
    ...(view.positionEntryPrice != null ? { positionEntryPrice: view.positionEntryPrice } : {}),
    ...(view.balance != null ? { balance: view.balance } : {}),
  };
}

const POSITION_MISS_RE =
  /no open position|no position|no pending entry|enter during the countdown|cancel failed/i;

function clientViewFromState(state: FullState | null): CrashClientView | undefined {
  if (!state) return undefined;
  return {
    phase: state.phase,
    gameId: state.gameId,
    hasPosition: state.hasPosition,
    hasLivePosition: state.hasLivePosition,
    entryPending: state.entryPending,
    positionSide: state.positionSide,
    positionAmount: state.positionAmount,
    positionLeverage: state.positionLeverage,
    positionEntryPrice: state.positionEntryPrice,
    balance: state.balance,
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useCrashStream() {
  const { wallet, holdBonuses, hydrated, setBlackballsBalance } = useWallet();
  const address = wallet.connected && hydrated ? wallet.address : null;
  const [state, setState] = useState<FullState | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  /** Increments each time a new countdown round begins — drives UI reset in controls. */
  const [roundEpoch, setRoundEpoch] = useState(0);
  /** Bumps on each SSE (re)connect so chart/canvas can re-mount with fresh state. */
  const [streamEpoch, setStreamEpoch] = useState(0);
  const sessionReadyRef = useRef(false);
  const walletBalanceRef = useRef(wallet.blackballsBalance);
  const walletRef = useRef(wallet);
  const holdRef = useRef(holdBonuses);
  const stateRef = useRef(state);
  const cancelSuppressUntilRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    walletBalanceRef.current = wallet.blackballsBalance;
    walletRef.current = wallet;
    holdRef.current = holdBonuses;
  }, [wallet, holdBonuses]);

  const syncBalance = useCallback(async (boot = false, force = false) => {
    const addr = walletRef.current.connected && walletRef.current.address;
    if (!addr) return null;
    const balance = resolveClientSyncBalance(walletRef.current);
    return syncCrashSession(
      addr,
      balance,
      holdRef.current.stimmy,
      holdRef.current.frenzy,
      walletRef.current.isRealWallet,
      boot,
      force,
    );
  }, []);

  const applyStreamPayload = useCallback(
    (parsed: FullState) => {
      const walletBal = resolveClientSyncBalance(walletRef.current);
      const prevSnap = stateRef.current;
      const roundChanged = isNewRoundTransition(prevSnap, parsed);
      let walletBalanceToApply: number | null = null;

      setState(prev => {
        let next = normalizeCrashStreamState(parsed, prev, walletBal);
        if (roundChanged) {
          next = resetPlayerViewForNewRound(next);
        }
        next = guardPendingEntryOnStream(prev, next);
        next = guardLivePositionOnStream(prev, next);
        next = guardCancelledPositionOnStream(prev, next, cancelSuppressUntilRef.current);
        stateRef.current = next;
        if (
          sessionReadyRef.current &&
          typeof next.balance === 'number' &&
          shouldApplyServerBalance(
            next.balance,
            walletBalanceRef.current,
            !walletRef.current.isRealWallet,
          )
        ) {
          walletBalanceToApply = next.balance;
        }
        return next;
      });

      if (roundChanged) {
        setRoundEpoch(n => n + 1);
      }

      if (walletBalanceToApply != null) {
        setBlackballsBalance(walletBalanceToApply);
        walletBalanceRef.current = walletBalanceToApply;
      }
    },
    [syncBalance, setBlackballsBalance],
  );

  const refreshGameState = useCallback(async () => {
    const addr = walletRef.current.connected && walletRef.current.address;
    const url = addr
      ? `/api/crash/state?address=${encodeURIComponent(addr)}`
      : '/api/crash/state';
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const parsed = (await res.json()) as FullState;
      applyStreamPayload(parsed);
    } catch (err) {
      console.warn('[crash/state] reconnect refresh failed', err);
    }
  }, [applyStreamPayload]);

  // Live SSE — single stable effect; spectators (no wallet) and players.
  useEffect(() => {
    if (!hydrated) {
      setConnected(false);
      setReconnecting(false);
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let staleTimer: ReturnType<typeof setInterval> | null = null;
    let lastMsgAt = Date.now();
    let hasOpened = false;

    const streamUrl = address
      ? `/api/crash/stream?address=${encodeURIComponent(address)}`
      : '/api/crash/stream';

    const scheduleReconnect = (delayMs: number) => {
      if (cancelled) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(connectStream, delayMs);
    };

    const connectStream = () => {
      if (cancelled) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      teardownEventSource(es);
      es = null;

      const nextEs = new EventSource(streamUrl);
      es = nextEs;
      lastMsgAt = Date.now();

      nextEs.onopen = () => {
        if (cancelled || es !== nextEs) return;
        setConnected(true);
        setReconnecting(false);
        retry = 0;
        lastMsgAt = Date.now();
        setStreamEpoch(n => n + 1);
        if (hasOpened) {
          void refreshGameState();
        }
        hasOpened = true;
      };

      nextEs.onmessage = e => {
        if (cancelled || es !== nextEs) return;
        lastMsgAt = Date.now();
        try {
          const parsed = JSON.parse(e.data) as FullState;
          applyStreamPayload(parsed);
        } catch (err) {
          console.warn('[crash/stream] parse failed — reconnecting', err);
          teardownEventSource(nextEs);
          if (es === nextEs) es = null;
          setConnected(false);
          setReconnecting(stateRef.current != null);
          scheduleReconnect(500);
        }
      };

      nextEs.onerror = () => {
        if (cancelled || es !== nextEs) return;
        setConnected(false);
        setReconnecting(stateRef.current != null);
        teardownEventSource(nextEs);
        if (es === nextEs) es = null;
        retry++;
        scheduleReconnect(Math.min(1000 * retry, 5000));
      };
    };

    connectStream();
    staleTimer = setInterval(() => {
      if (cancelled || !es) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - lastMsgAt > STALE_FEED_MS) {
        console.warn('[crash/stream] stale feed — reconnecting');
        setConnected(false);
        setReconnecting(stateRef.current != null);
        teardownEventSource(es);
        es = null;
        scheduleReconnect(250);
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (staleTimer) clearInterval(staleTimer);
      teardownEventSource(es);
      es = null;
    };
  }, [hydrated, address, applyStreamPayload, refreshGameState]);

  // Reset player-specific state when wallet address changes (not on first mount).
  const prevAddressRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevAddressRef.current != null && prevAddressRef.current !== address) {
      setState(null);
      stateRef.current = null;
    }
    prevAddressRef.current = address;
  }, [address]);

  // If SSE connected but no snapshot yet, pull one immediately.
  useEffect(() => {
    if (!hydrated || state != null || !connected) return;
    void refreshGameState();
  }, [hydrated, connected, state, refreshGameState]);

  const hadLivePositionRef = useRef(false);

  // Recover when a live position vanishes mid-round (serverless instance desync).
  useEffect(() => {
    if (!address || !state) return;
    const liveNow =
      state.hasLivePosition ||
      (state.hasPosition && state.phase === 'running' && !state.entryPending);

    if (state.phase === 'running' && hadLivePositionRef.current && !liveNow) {
      void refreshGameState();
    }
    hadLivePositionRef.current = liveNow;
  }, [
    address,
    state?.phase,
    state?.hasPosition,
    state?.hasLivePosition,
    state?.entryPending,
    refreshGameState,
  ]);

  // Poll authoritative state while a live position is open.
  useEffect(() => {
    if (!address || !state || state.phase !== 'running') return;
    const liveNow =
      state.hasLivePosition ||
      (state.hasPosition && !state.entryPending);
    if (!liveNow) return;

    const timer = setInterval(() => {
      void refreshGameState();
    }, 5000);
    return () => clearInterval(timer);
  }, [
    address,
    state?.phase,
    state?.hasPosition,
    state?.hasLivePosition,
    state?.entryPending,
    refreshGameState,
  ]);

  // Session sync — wallet-context boots once; here we only merge view in background.
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

    // Do not block BUY/SELL on session POST — SSE + enter API validate server-side.
    sessionReadyRef.current = true;
    setSessionReady(true);

    let cancelled = false;
    void (async () => {
      const synced = await syncBalance(false, true);
      if (cancelled || synced == null) return;
      if (typeof synced.balance === 'number') {
        setBlackballsBalance(synced.balance);
        walletBalanceRef.current = synced.balance;
      }
      if (synced.view) {
        setState(prev => mergeCrashClientView(prev, synced.view));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, address, syncBalance, setBlackballsBalance]);

  const ensureSession = useCallback(async () => {
    if (!address) return false;
    if (sessionReadyRef.current) return true;
    sessionReadyRef.current = true;
    setSessionReady(true);
    return true;
  }, [address]);

  const cancelActivePosition = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
      if (!address) return { ok: false, error: 'Connect wallet first' };

      const applyView = (view?: CrashClientView | null) => {
        if (!view) return;
        setState(prev => {
          const merged = mergeCrashClientView(prev, view);
          stateRef.current = merged;
          return merged;
        });
      };

      let lastErr = 'Cancel failed';

      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          await syncBalance(false, true);
          await refreshGameState();
          await sleep(120 * attempt);
        }

        const clientView = clientViewFromState(stateRef.current);

        try {
          const res = await fetchJsonWithTimeout('/api/crash/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, clientView }),
          });
          const data = await res.json().catch(() => ({}));

          if (typeof data.balance === 'number') {
            setBlackballsBalance(data.balance);
            walletBalanceRef.current = data.balance;
          }

          const view = data.view as CrashClientView | undefined;
          const serverCleared = view && !view.hasPosition && !view.entryPending;
          const success =
            (res.ok && (data.ok === true || data.action === 'close')) || serverCleared;

          if (success) {
            cancelSuppressUntilRef.current = Date.now() + 5000;
            const bal =
              typeof data.balance === 'number'
                ? data.balance
                : (stateRef.current?.balance ?? walletBalanceRef.current);
            setState(prev => {
              if (!prev) return prev;
              const next = {
                ...prev,
                hasPosition: false,
                hasLivePosition: false,
                entryPending: false,
                positionAmount: 0,
                positionLeverage: 1,
                balance: bal,
              };
              stateRef.current = next;
              return next;
            });
            return { ok: true };
          }

          if (data.view) {
            applyView(data.view as CrashClientView);
          }

          lastErr =
            typeof data.message === 'string'
              ? data.message
              : typeof data.error === 'string'
                ? data.error
                : 'Cancel failed';

          if (!POSITION_MISS_RE.test(lastErr)) {
            return { ok: false, error: lastErr };
          }
        } catch (err) {
          lastErr = actionErrorMessage(err, 'Network error — try again');
          if (attempt === 3) {
            void refreshGameState();
            return { ok: false, error: lastErr };
          }
        }
      }

      void refreshGameState();
      return { ok: false, error: lastErr };
    },
    [address, setBlackballsBalance, refreshGameState, syncBalance],
  );

  const trade = useCallback(
    async (side: 'buy' | 'sell', amount: number, leverage: number): Promise<{ ok: boolean; error?: string }> => {
      if (!address) return { ok: false, error: 'Connect wallet first' };
      await ensureSession();

      const wager = Math.floor(amount * 1000) / 1000;
      if (wager <= 0) return { ok: false, error: 'invalid amount' };

      const live = stateRef.current;
      if (
        live &&
        (live.phase !== 'waiting' || live.waitLeft <= COUNTDOWN_ENTRY_BUFFER_SEC)
      ) {
        return {
          ok: false,
          error: 'Wait for the next round — entries open during countdown (not in the last second).',
        };
      }
      if (live?.hasPosition && live.entryPending && live.positionSide === side) {
        return {
          ok: true,
          error: undefined,
        };
      }
      if (live?.hasPosition && live.entryPending && live.positionSide !== side) {
        return {
          ok: false,
          error: 'Use cancel via the opposite button — do not open a new position on top of a pending entry',
        };
      }

      try {
        const w = walletRef.current;
        const clientBalance = resolveClientSyncBalance(w);

        const res = await fetchJsonWithTimeout('/api/crash/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address,
            side,
            amount: wager,
            leverage,
            balance: clientBalance,
            isRealWallet: w.isRealWallet,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = typeof data.error === 'string' ? data.error : 'Trade rejected';
          console.warn('[crash/enter] rejected', res.status, data.error ?? data);
          if (data.view) {
            setState(prev => mergeCrashClientView(prev, data.view as CrashClientView));
          }
          return { ok: false, error: errMsg };
        }
        if (typeof data.balance === 'number') {
          setBlackballsBalance(data.balance);
          walletBalanceRef.current = data.balance;
        }
        if (data.view) {
          setState(prev => mergeCrashClientView(prev, data.view as CrashClientView));
        }
        if (data.ok !== true) {
          return { ok: false, error: typeof data.error === 'string' ? data.error : 'Trade failed' };
        }

        // Instant UI feedback — don't wait for the next SSE tick.
        setState(prev => {
          if (!prev) return prev;
          const bal = typeof data.balance === 'number' ? data.balance : prev.balance;
          if (data.action === 'close') {
            return {
              ...prev,
              hasPosition: false,
              hasLivePosition: false,
              entryPending: false,
              positionAmount: 0,
              positionLeverage: 1,
              balance: bal,
            };
          }
          if (data.action === 'open' && prev.phase === 'waiting') {
            return {
              ...prev,
              hasPosition: true,
              hasLivePosition: false,
              entryPending: true,
              positionSide: side,
              positionAmount: wager,
              positionLeverage: leverage,
              positionEntryPrice: 1.0,
              balance: bal,
            };
          }
          return { ...prev, balance: bal };
        });

        return { ok: true };
      } catch (err) {
        void refreshGameState();
        return { ok: false, error: actionErrorMessage(err, 'Network error — try again') };
      }
    },
    [address, ensureSession, setBlackballsBalance, refreshGameState],
  );

  const setAutoSell = useCallback(
    async (v: number | null) => {
      if (!address) return;
      await fetch('/api/crash/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, value: v }),
      });
    },
    [address],
  );

  const cashOut = useCallback(
    async (percent = 1): Promise<{ ok: boolean; error?: string; exitPrice?: number }> => {
      if (!address) return { ok: false, error: 'Connect wallet first' };
      const pct = Math.min(1, Math.max(0.25, percent));
      let lastErr = 'Cash-out rejected';

      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          await syncBalance(false, true);
          await refreshGameState();
          await sleep(120 * attempt);
        }

        const clientView = clientViewFromState(stateRef.current);

        try {
          const res = await fetchJsonWithTimeout('/api/crash/cashout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, percent: pct, clientView }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            lastErr = typeof data.error === 'string' ? data.error : 'Cash-out rejected';
            if (data.view) {
              setState(prev => mergeCrashClientView(prev, data.view as CrashClientView));
            }
            if (!POSITION_MISS_RE.test(lastErr)) {
              void refreshGameState();
              return { ok: false, error: lastErr };
            }
            continue;
          }
          if (typeof data.balance === 'number') setBlackballsBalance(data.balance);
          if (data.view) {
            setState(prev => mergeCrashClientView(prev, data.view as CrashClientView));
          }
          setState(prev => {
            if (!prev) return prev;
            const bal = typeof data.balance === 'number' ? data.balance : prev.balance;
            const fullClose = data.action === 'close' || (typeof data.cashedPct === 'number' && data.cashedPct >= 0.999);
            if (fullClose) {
              return {
                ...prev,
                hasPosition: false,
                hasLivePosition: false,
                entryPending: false,
                positionAmount: 0,
                positionLeverage: 1,
                balance: bal,
              };
            }
            const remaining = parseFloat((prev.positionAmount * (1 - (data.cashedPct as number))).toFixed(3));
            return {
              ...prev,
              hasLivePosition: true,
              entryPending: false,
              positionAmount: remaining,
              balance: bal,
            };
          });
          return { ok: true, exitPrice: typeof data.exitPrice === 'number' ? data.exitPrice : undefined };
        } catch (err) {
          lastErr = actionErrorMessage(err, 'Network error — try again');
          if (attempt === 3) break;
        }
      }

      void refreshGameState();
      return { ok: false, error: lastErr };
    },
    [address, setBlackballsBalance, refreshGameState, syncBalance],
  );

  return { state, connected, reconnecting, sessionReady, roundEpoch, streamEpoch, trade, cancelActivePosition, cashOut, setAutoSell, walletConnected: !!address };
}
