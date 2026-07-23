'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { FullState } from '@/lib/crash-types';
import { useWallet } from '@/lib/wallet-context';

async function syncCrashSession(
  address: string,
  balance: number,
  stimmy: number,
  frenzy: number,
) {
  const res = await fetch('/api/crash/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, balance, stimmy, frenzy }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.balance === 'number' ? data.balance : null;
}

export function useCrashStream() {
  const { wallet, holdBonuses, setBlackballsBalance } = useWallet();
  const address = wallet.connected ? wallet.address : null;
  const [state, setState] = useState<FullState | null>(null);
  const [connected, setConnected] = useState(false);
  const balanceRef = useRef(wallet.blackballsBalance);

  useEffect(() => {
    balanceRef.current = wallet.blackballsBalance;
  }, [wallet.blackballsBalance]);

  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    const boot = async () => {
      const synced = await syncCrashSession(
        address,
        balanceRef.current,
        holdBonuses.stimmy,
        holdBonuses.frenzy,
      );
      if (cancelled) return;
      if (synced != null) setBlackballsBalance(synced);
    };
    void boot();

    return () => {
      cancelled = true;
    };
  }, [address, holdBonuses.stimmy, holdBonuses.frenzy, setBlackballsBalance]);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry = 0;

    const connect = () => {
      const url = address
        ? `/api/crash/stream?address=${encodeURIComponent(address)}`
        : '/api/crash/stream';
      es = new EventSource(url);
      es.onopen = () => {
        setConnected(true);
        retry = 0;
      };
      es.onmessage = e => {
        try {
          const next = JSON.parse(e.data) as FullState;
          setState(next);
          if (address && typeof next.balance === 'number') {
            setBlackballsBalance(next.balance);
          }
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry++;
        const delay = Math.min(1000 * retry, 5000);
        setTimeout(connect, delay);
      };
    };
    connect();

    return () => {
      es?.close();
    };
  }, [address, setBlackballsBalance]);

  const trade = useCallback(
    async (side: 'buy' | 'sell', amount: number, leverage: number) => {
      if (!address) return false;
      const res = await fetch('/api/crash/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, side, amount, leverage }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (typeof data.balance === 'number') setBlackballsBalance(data.balance);
      return data.ok === true;
    },
    [address, setBlackballsBalance],
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

  return { state, connected, trade, setAutoSell, walletConnected: !!address };
}
