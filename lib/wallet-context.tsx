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
  WALLET_STORAGE_KEY,
  walletHoldings,
  type WalletState,
} from '@/lib/wallet-types';
import { DEMO_REFILL_BB, DEMO_MIN_BALANCE } from '@/lib/demo-credits';
import {
  bootGameSessionsForWallet,
  clearGameSessionBoot,
} from '@/lib/sync-game-sessions';
import { resolveClientSyncBalance } from '@/lib/session-balance';
import {
  heartbeatDemoTabLeader,
  isDemoTabLeader,
  notifyDemoBalance,
  subscribeDemoTabMessages,
} from '@/lib/demo-tab-coordinator';

interface WalletContextValue {
  wallet: WalletState;
  holdBonuses: HoldBonuses;
  hydrated: boolean;
  connect: () => void;
  connectRealWallet: (address: string) => void;
  disconnect: () => void;
  displayAddress: string | null;
  setBlackballsBalance: (balance: number) => void;
  adjustBlackballsBalance: (delta: number) => void;
  refillDemoCredits: () => number;
  addArenaXp: (amount: number) => void;
  recordArenaResult: (won: boolean) => void;
  refreshHoldings: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function makeDemoWallet(): WalletState {
  const solBalance = parseFloat((Math.random() * 50 + 5).toFixed(2));
  const gotAirdrop = Math.random() < 0.05;
  const airdropRank = gotAirdrop ? Math.floor(Math.random() * 500) + 1 : null;
  const blackballsBalance = DEMO_REFILL_BB;
  const ansemBalance = 100;
  const cashcatBalance = 50;

  const xp = Math.floor(Math.random() * 30000 + 5000);

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
    xp,
    rank: rankTitleFromXp(xp),
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
        const connected = w.connected ?? false;
        const isRealWallet = w.isRealWallet ?? false;
        let blackballsBalance =
          w.blackballsBalance ?? parseFloat((Math.random() * 1200 + 180).toFixed(1));
        if (connected && !isRealWallet && blackballsBalance < DEMO_MIN_BALANCE) {
          blackballsBalance = DEMO_REFILL_BB;
        }
        setWallet({
          ...DEFAULT_WALLET,
          ...w,
          connected,
          solBalance: w.solBalance ?? parseFloat((Math.random() * 50 + 5).toFixed(2)),
          blackballsBalance,
          ansemBalance: w.ansemBalance ?? 0,
          cashcatBalance: w.cashcatBalance ?? 0,
          arenaWins: w.arenaWins ?? 0,
          arenaLosses: w.arenaLosses ?? 0,
          xp: w.xp ?? 0,
          rank: rankTitleFromXp(w.xp ?? 0),
          isRealWallet,
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

  const refillDemoCredits = useCallback((): number => {
    let newBalance = DEMO_REFILL_BB;
    updateWallet(prev => {
      if (!prev.connected || prev.isRealWallet) return prev;
      newBalance = DEMO_REFILL_BB;
      return { ...prev, blackballsBalance: newBalance };
    });
    return newBalance;
  }, [updateWallet]);

  useEffect(() => {
    if (hydrated && wallet.connected) {
      void refreshHoldings();
    }
  }, [hydrated, wallet.connected, wallet.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Boot Crash + Flip server sessions once — leader tab only (avoids multi-tab overwrite).
  useEffect(() => {
    if (!hydrated || !wallet.connected || !wallet.address) return;
    if (!wallet.isRealWallet && !isDemoTabLeader(wallet.address)) return;

    const bonuses = computeHoldBonuses(walletHoldings(wallet));
    const holdsBb = bonuses.active.some(b => b.token === 'BLACKBALLS');
    const balance = resolveClientSyncBalance(wallet, { allowRefill: true });
    void bootGameSessionsForWallet(
      wallet.address,
      balance,
      bonuses.stimmy,
      bonuses.frenzy,
      holdsBb,
      wallet.isRealWallet,
    ).catch(err => console.warn('[wallet] game session boot failed', err));
  }, [hydrated, wallet.connected, wallet.address, wallet.isRealWallet]);

  useEffect(() => {
    if (!hydrated || !wallet.connected || !wallet.address || wallet.isRealWallet) return;
    const timer = setInterval(() => heartbeatDemoTabLeader(wallet.address), 2000);
    return () => clearInterval(timer);
  }, [hydrated, wallet.connected, wallet.address, wallet.isRealWallet]);

  useEffect(() => {
    if (!hydrated || !wallet.connected || !wallet.address || wallet.isRealWallet) return;
    return subscribeDemoTabMessages(wallet.address, msg => {
      if (msg.type === 'balance' && typeof msg.balance === 'number') {
        setWallet(prev =>
          prev.connected && prev.address === msg.address
            ? { ...prev, blackballsBalance: parseFloat(msg.balance.toFixed(3)) }
            : prev,
        );
      }
    });
  }, [hydrated, wallet.connected, wallet.address, wallet.isRealWallet]);

  // No auto-refill to 100 when balance hits 0 — that minted free BB after all-in / rug.
  // Demo top-up is explicit via the "+100 Demo" button only.

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
      rank: rankTitleFromXp(0),
      arenaWins: 0,
      arenaLosses: 0,
      isRealWallet: true,
    };
    setWallet(next);
    persistWallet(next);
  }, []);

  const disconnect = useCallback(() => {
    if (wallet.address) clearGameSessionBoot(wallet.address);
    setWallet(DEFAULT_WALLET);
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, [wallet.address]);

  const setBlackballsBalance = useCallback(
    (balance: number) => {
      updateWallet(prev => {
        if (!prev.connected) return prev;
        const next = { ...prev, blackballsBalance: parseFloat(balance.toFixed(3)) };
        if (!prev.isRealWallet && prev.address) {
          notifyDemoBalance(prev.address, next.blackballsBalance);
        }
        return next;
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
      hydrated,
      connect,
      connectRealWallet,
      disconnect,
      displayAddress: hydrated ? displayAddress : null,
      setBlackballsBalance,
      adjustBlackballsBalance,
      refillDemoCredits,
      addArenaXp,
      recordArenaResult,
      refreshHoldings,
    }),
    [
      resolvedWallet,
      holdBonuses,
      hydrated,
      connect,
      connectRealWallet,
      disconnect,
      displayAddress,
      hydrated,
      setBlackballsBalance,
      adjustBlackballsBalance,
      refillDemoCredits,
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
