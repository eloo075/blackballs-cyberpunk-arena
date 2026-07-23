'use client';

import { rankTitleFromXp } from '@/lib/arena-rewards';
import { computeHoldBonuses, type HoldBonuses } from '@/lib/hold-bonuses';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_WALLET,
  RANKS,
  WALLET_STORAGE_KEY,
  walletHoldings,
  type WalletState,
} from '@/lib/wallet-types';

interface WalletContextValue {
  wallet: WalletState;
  holdBonuses: HoldBonuses;
  connect: () => void;
  connectRealWallet: (address: string) => void;
  disconnect: () => void;
  displayAddress: string | null;
  setBlackballsBalance: (balance: number) => void;
  adjustBlackballsBalance: (delta: number) => void;
  addArenaXp: (amount: number) => void;
  recordArenaResult: (won: boolean) => void;
  refreshHoldings: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function makeDemoWallet(): WalletState {
  const solBalance = parseFloat((Math.random() * 50 + 5).toFixed(2));
  const gotAirdrop = Math.random() < 0.05;
  const airdropRank = gotAirdrop ? Math.floor(Math.random() * 500) + 1 : null;
  const blackballsBalance = parseFloat((Math.random() * 1200 + 180).toFixed(1));
  const ansemBalance =
    Math.random() < 0.6 ? parseFloat((Math.random() * 5000 + 50).toFixed(0)) : 0;
  const cashcatBalance =
    Math.random() < 0.55 ? parseFloat((Math.random() * 8000 + 25).toFixed(0)) : 0;

  return {
    connected: true,
    address:
      '7xK' +
      Math.random().toString(36).slice(2, 8) +
      '...' +
      Math.random().toString(36).slice(2, 6),
    solBalance,
    blackballsBalance,
    ansemBalance,
    cashcatBalance,
    airdropped: gotAirdrop,
    airdropRank,
    xp: Math.floor(Math.random() * 30000 + 5000),
    rank: RANKS[Math.floor(Math.random() * RANKS.length)],
    arenaWins: Math.floor(Math.random() * 40),
    arenaLosses: Math.floor(Math.random() * 25),
    isRealWallet: false,
  };
}

function persistWallet(wallet: WalletState) {
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(DEFAULT_WALLET);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(WALLET_STORAGE_KEY);
    if (saved) {
      try {
        const w = JSON.parse(saved) as Partial<WalletState>;
        setWallet({
          ...DEFAULT_WALLET,
          ...w,
          connected: w.connected ?? false,
          solBalance: w.solBalance ?? parseFloat((Math.random() * 50 + 5).toFixed(2)),
          blackballsBalance:
            w.blackballsBalance ?? parseFloat((Math.random() * 1200 + 180).toFixed(1)),
          ansemBalance: w.ansemBalance ?? 0,
          cashcatBalance: w.cashcatBalance ?? 0,
          arenaWins: w.arenaWins ?? 0,
          arenaLosses: w.arenaLosses ?? 0,
          xp: w.xp ?? 0,
          rank: w.rank ?? RANKS[0],
          isRealWallet: w.isRealWallet ?? false,
        });
      } catch {
        /* ignore corrupt storage */
      }
    }
    setHydrated(true);
  }, []);

  const updateWallet = useCallback((updater: (prev: WalletState) => WalletState) => {
    setWallet(prev => {
      const next = updater(prev);
      if (next.connected) persistWallet(next);
      return next;
    });
  }, []);

  const refreshHoldings = useCallback(async () => {
    if (!wallet.connected || !wallet.address) return;
    try {
      const res = await fetch('/api/wallet/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: wallet.address,
          isRealWallet: wallet.isRealWallet,
          blackballsBalance: wallet.blackballsBalance,
          ansemBalance: wallet.ansemBalance,
          cashcatBalance: wallet.cashcatBalance,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      updateWallet(prev => {
        if (!prev.connected) return prev;
        return {
          ...prev,
          blackballsBalance: data.blackballs ?? prev.blackballsBalance,
          ansemBalance: data.ansem ?? prev.ansemBalance,
          cashcatBalance: data.cashcat ?? prev.cashcatBalance,
        };
      });
    } catch {
      /* demo holdings stay local */
    }
  }, [wallet.connected, wallet.address, wallet.isRealWallet, wallet.blackballsBalance, wallet.ansemBalance, wallet.cashcatBalance, updateWallet]);

  useEffect(() => {
    if (hydrated && wallet.connected) {
      void refreshHoldings();
    }
  }, [hydrated, wallet.connected, wallet.address]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(() => {
    const next = makeDemoWallet();
    setWallet(next);
    persistWallet(next);
  }, []);

  const connectRealWallet = useCallback((address: string) => {
    const next: WalletState = {
      connected: true,
      address,
      solBalance: 0,
      blackballsBalance: 0,
      ansemBalance: 0,
      cashcatBalance: 0,
      airdropped: false,
      airdropRank: null,
      xp: 0,
      rank: RANKS[0],
      arenaWins: 0,
      arenaLosses: 0,
      isRealWallet: true,
    };
    setWallet(next);
    persistWallet(next);
  }, []);

  const disconnect = useCallback(() => {
    setWallet(DEFAULT_WALLET);
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  const setBlackballsBalance = useCallback(
    (balance: number) => {
      updateWallet(prev => {
        if (!prev.connected) return prev;
        return { ...prev, blackballsBalance: parseFloat(balance.toFixed(3)) };
      });
    },
    [updateWallet],
  );

  const adjustBlackballsBalance = useCallback(
    (delta: number) => {
      updateWallet(prev => {
        if (!prev.connected) return prev;
        return {
          ...prev,
          blackballsBalance: parseFloat(Math.max(0, prev.blackballsBalance + delta).toFixed(3)),
        };
      });
    },
    [updateWallet],
  );

  const addArenaXp = useCallback(
    (amount: number) => {
      if (amount <= 0) return;
      updateWallet(prev => {
        if (!prev.connected) return prev;
        const xp = prev.xp + amount;
        return { ...prev, xp, rank: rankTitleFromXp(xp) };
      });
    },
    [updateWallet],
  );

  const recordArenaResult = useCallback(
    (won: boolean) => {
      updateWallet(prev => {
        if (!prev.connected) return prev;
        return won
          ? { ...prev, arenaWins: prev.arenaWins + 1 }
          : { ...prev, arenaLosses: prev.arenaLosses + 1 };
      });
    },
    [updateWallet],
  );

  const displayAddress = wallet.connected && wallet.address ? wallet.address : null;
  const resolvedWallet = hydrated ? wallet : DEFAULT_WALLET;
  const holdBonuses = useMemo(
    () => computeHoldBonuses(walletHoldings(resolvedWallet)),
    [resolvedWallet],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      wallet: resolvedWallet,
      holdBonuses,
      connect,
      connectRealWallet,
      disconnect,
      displayAddress: hydrated ? displayAddress : null,
      setBlackballsBalance,
      adjustBlackballsBalance,
      addArenaXp,
      recordArenaResult,
      refreshHoldings,
    }),
    [
      resolvedWallet,
      holdBonuses,
      connect,
      connectRealWallet,
      disconnect,
      displayAddress,
      hydrated,
      setBlackballsBalance,
      adjustBlackballsBalance,
      addArenaXp,
      recordArenaResult,
      refreshHoldings,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return ctx;
}
