'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { useWallet } from '@/lib/wallet-context';
import { isVaultConfigured } from '@/lib/chain/public-config';
import { VaultModal } from '@/components/VaultModal';

const LOGO_SRC = '/blackballs-neon-logo.png';

interface NavProps {
  activeTab: 'crash' | 'arena' | 'leaderboard';
  onTabChange: (t: 'crash' | 'arena' | 'leaderboard') => void;
}

const TABS: { id: NavProps['activeTab']; label: string }[] = [
  { id: 'crash', label: 'CRASH' },
  { id: 'arena', label: 'ARENA' },
  { id: 'leaderboard', label: 'RANKING' },
];

export function Nav({ activeTab, onTabChange }: NavProps) {
  const { wallet, connect, disconnect, displayAddress } = useWallet();
  const [vaultOpen, setVaultOpen] = useState(false);
  const vaultEnabled = isVaultConfigured();

  const vaultButton = vaultEnabled ? (
    <button
      onClick={() => setVaultOpen(true)}
      className="cp-btn touch-manipulation touch-target px-3 py-2 text-[10px] font-black border border-cp-yellow/50 text-cp-yellow hover:bg-cp-yellow/10 shrink-0"
    >
      VAULT
    </button>
  ) : null;

  const walletAction = wallet.connected ? (
    <>
      {vaultButton}
      <button
        onClick={disconnect}
        className="cp-btn touch-manipulation touch-target px-3 py-2 text-[10px] border border-cp-magenta/40 text-cp-magenta hover:bg-cp-magenta/10 shrink-0"
      >
        DISCONNECT
      </button>
    </>
  ) : (
    <>
      {vaultButton}
      <button
        onClick={() => (vaultEnabled ? setVaultOpen(true) : connect())}
        className="cp-btn touch-manipulation touch-target px-4 py-2 text-[10px] font-black bg-gradient-to-r from-cp-cyan to-cp-purple text-white shrink-0"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 75%, 92% 100%, 0 100%)',
          boxShadow: '0 0 10px rgba(0,240,255,0.4)',
        }}
      >
        {vaultEnabled ? 'CONNECT' : 'CONNECT'}
      </button>
    </>
  );

  const mobileWalletChip = wallet.connected && (
    <div className="flex flex-col items-end min-w-0 md:hidden mr-1">
      <span className="text-[10px] font-bold neon-cyan truncate max-w-[120px]">{displayAddress}</span>
      <span className="text-[9px] text-white/50 whitespace-nowrap">
        {wallet.blackballsBalance.toFixed(0)} $BlackBalls · <span className="neon-yellow">{wallet.rank}</span>
      </span>
    </div>
  );

  const desktopWalletDetails = wallet.connected && (
    <div className="hidden md:flex flex-col items-end">
      <span className="text-[10px] font-bold neon-cyan">{displayAddress}</span>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-white/50">
          {wallet.solBalance.toFixed(2)} SOL · {wallet.blackballsBalance.toFixed(1)} $BlackBalls ·{' '}
          {wallet.xp.toLocaleString('en-US')} XP · <span className="neon-yellow">{wallet.rank}</span>
          {wallet.isRealWallet ? '' : ' · BETA'}
        </span>
        {wallet.airdropped && (
          <span className="text-[9px] font-black px-2 py-0.5 bg-cp-yellow/10 text-cp-yellow border border-cp-yellow/30">
            AIRDROP
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <VaultModal open={vaultOpen} onClose={() => setVaultOpen(false)} />
      <header className="sticky top-0 z-40 border-b border-cp-cyan/20 bg-cp-bg/90 backdrop-blur-md safe-bottom">
      {/* mobile: brand row */}
      <div className="md:hidden max-w-[1700px] mx-auto px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 relative shrink-0">
            <div className="absolute inset-0 rounded-full bg-cp-purple/30 blur-xl cp-pulse" />
            <div className="relative w-full h-full rounded-full bg-black/80 border border-cp-magenta/50 shadow-[0_0_16px_rgba(157,0,255,0.45)] overflow-hidden">
              <img src={LOGO_SRC} alt="Blackballs Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="min-w-0">
            <div
              className="text-xs font-black tracking-[0.12em] neon-cyan truncate"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              $BlackBalls
            </div>
            <div className="text-[7px] text-white/40 tracking-[0.15em] truncate">DEGEN ARENA</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {mobileWalletChip}
          <div className="flex items-center gap-1">{walletAction}</div>
        </div>
      </div>

      {/* mobile: full-width tab bar */}
      <nav className="md:hidden flex border-t border-cp-cyan/10 max-w-[1700px] mx-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className="relative flex-1 touch-manipulation touch-target py-3 text-[11px] font-bold tracking-wider transition-colors"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              color: activeTab === t.id ? '#00f0ff' : 'rgba(255,255,255,0.45)',
            }}
          >
            {t.label}
            {activeTab === t.id && (
              <motion.div
                layoutId="nav-underline-mobile"
                className="absolute inset-x-2 bottom-0 h-0.5 bg-cp-cyan rounded-full"
                style={{ boxShadow: '0 0 8px #00f0ff' }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* desktop: single row */}
      <div className="hidden md:flex max-w-[1700px] mx-auto px-3 py-2 items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-10 h-10 relative">
            <div className="absolute inset-0 rounded-full bg-cp-purple/30 blur-xl cp-pulse" />
            <div className="relative w-full h-full rounded-full bg-black/80 border border-cp-magenta/50 shadow-[0_0_16px_rgba(157,0,255,0.45)] overflow-hidden">
              <img src={LOGO_SRC} alt="Blackballs Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <div
              className="text-sm font-black tracking-[0.15em] neon-cyan"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              $BlackBalls
            </div>
            <div className="text-[8px] text-white/40 tracking-[0.2em] -mt-1">CYBERPUNK DEGEN ARENA</div>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className="relative px-4 py-2 text-xs font-bold tracking-wider transition-colors touch-manipulation"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                color: activeTab === t.id ? '#00f0ff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t.label}
              {activeTab === t.id && (
                <motion.div
                  layoutId="nav-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-cp-cyan"
                  style={{ boxShadow: '0 0 8px #00f0ff' }}
                />
              )}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {desktopWalletDetails}
          <div className="flex items-center gap-1">{walletAction}</div>
        </div>
      </div>
    </header>
    </>
  );
}
