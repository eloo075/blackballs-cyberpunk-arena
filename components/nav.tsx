'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/wallet-context';
import { useCompetitive } from '@/hooks/use-competitive';
import { isVaultConfigured } from '@/lib/chain/public-config';
import { VaultModal } from '@/components/VaultModal';
import { PlayerXpCounter } from '@/components/player-xp-counter';
import { HowToPlayModal } from '@/components/how-to-play-modal';

const LOGO_SRC = '/blackballs-logo-transparent.png';

interface NavProps {
  activeTab: 'crash' | 'arena' | 'leaderboard';
  onTabChange: (t: 'crash' | 'arena' | 'leaderboard') => void;
}

const TABS: { id: NavProps['activeTab']; label: string }[] = [
  { id: 'crash', label: 'Crash' },
  { id: 'arena', label: 'Arena' },
  { id: 'leaderboard', label: 'Ranking' },
];

const pillBtn =
  'touch-manipulation touch-target px-3 py-2 text-xs font-extrabold rounded-xl bg-[#2a2c33] border border-white/10 text-white/80 hover:bg-[#353842] transition-colors';

export function Nav({ activeTab, onTabChange }: NavProps) {
  const { wallet, connect, disconnect, displayAddress } = useWallet();
  const { state: compState } = useCompetitive();
  const [vaultOpen, setVaultOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const vaultEnabled = isVaultConfigured();

  const guideButton = (
    <>
      <button type="button" onClick={() => setGuideOpen(true)} className={`${pillBtn} hidden sm:inline-flex`}>
        Guide
      </button>
      <Link href="/guide" className={`${pillBtn} sm:hidden`}>
        Guide
      </Link>
    </>
  );

  const vaultButton = vaultEnabled ? (
    <button onClick={() => setVaultOpen(true)} className={`${pillBtn} text-amber-300`}>
      Vault
    </button>
  ) : null;

  const walletAction = wallet.connected ? (
    <>
      {guideButton}
      {vaultButton}
      <button onClick={disconnect} className={`${pillBtn} text-rose-300`}>
        Disconnect
      </button>
    </>
  ) : (
    <>
      {guideButton}
      {vaultButton}
      <button
        onClick={() => (vaultEnabled ? setVaultOpen(true) : connect())}
        className="touch-manipulation touch-target px-4 py-2 text-xs font-extrabold bg-sky-500 hover:bg-sky-400 text-white rounded-xl border-b-4 border-sky-700 active:border-b-0 active:translate-y-1 transition-all shrink-0"
      >
        Connect
      </button>
    </>
  );

  const mobileWalletChip = wallet.connected && (
    <div className="flex flex-col items-end min-w-0 md:hidden mr-1 gap-1">
      <span className="text-[11px] font-extrabold text-white/70 truncate max-w-[120px]">{displayAddress}</span>
      <span className="text-[10px] text-white/45 whitespace-nowrap font-bold">
        {wallet.blackballsBalance.toFixed(0)} $BlackBalls
      </span>
      <PlayerXpCounter variant="compact" />
    </div>
  );

  const desktopWalletDetails = wallet.connected && (
    <div className="hidden md:flex flex-col items-end">
      <span className="text-[11px] font-extrabold text-white/70">{displayAddress}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-white/45 font-bold whitespace-nowrap">
          {wallet.solBalance.toFixed(2)} SOL · {wallet.blackballsBalance.toFixed(1)} $BlackBalls
          {compState.arenaWinStreak >= 2 && (
            <span className="text-rose-400 font-extrabold"> · 🔥{compState.arenaWinStreak}</span>
          )}
        </span>
        {wallet.airdropped && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 bg-amber-400/15 text-amber-300 rounded-full border border-amber-400/25">
            AIRDROP
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <VaultModal open={vaultOpen} onClose={() => setVaultOpen(false)} />
      <HowToPlayModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#1f2025]/95 backdrop-blur-md safe-bottom font-arcade">
        {/* mobile: brand row */}
        <div className="md:hidden max-w-[1700px] mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 shrink-0 flex items-center justify-center">
              <img src={LOGO_SRC} alt="Blackballs Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-white truncate">$BlackBalls</div>
              <div className="text-[10px] text-white/40 font-bold truncate">Degen Arcade</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {mobileWalletChip}
            <div className="flex items-center gap-1">{walletAction}</div>
          </div>
        </div>

        {/* mobile: tab bar */}
        <nav className="md:hidden flex border-t border-white/5 max-w-[1700px] mx-auto bg-[#25262c]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`relative flex-1 touch-manipulation touch-target py-3 text-xs font-extrabold rounded-xl transition-all ${
                activeTab === t.id
                  ? 'bg-amber-500 text-black'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              {t.label}
              {activeTab === t.id && (
                <motion.div
                  layoutId="nav-underline-mobile"
                  className="absolute inset-x-3 bottom-1 h-0.5 bg-black/20 rounded-full"
                />
              )}
            </button>
          ))}
        </nav>

        {/* desktop */}
        <div className="hidden md:flex max-w-[1700px] mx-auto px-4 py-2.5 items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <img src={LOGO_SRC} alt="Blackballs Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white">$BlackBalls</div>
              <div className="text-[10px] text-white/40 font-bold -mt-0.5">Degen Arcade</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-[#25262c] rounded-xl p-1 border border-white/5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`relative px-4 py-2 text-sm font-extrabold rounded-lg transition-all touch-manipulation ${
                  activeTab === t.id
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-white/45 hover:text-white/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {wallet.connected && <PlayerXpCounter variant="compact" className="hidden md:flex" />}
            {desktopWalletDetails}
            <div className="flex items-center gap-1">{walletAction}</div>
          </div>
        </div>
      </header>
    </>
  );
}
