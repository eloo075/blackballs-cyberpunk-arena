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
import { WalletBalanceCards } from '@/components/wallet-balance-cards';
import { DEMO_REFILL_BB } from '@/lib/demo-credits';
import { syncGameSessionBalances } from '@/lib/sync-game-sessions';

const LOGO_SRC = '/blackballs-logo-transparent.png';

interface NavProps {
  activeTab: 'crash' | 'flip' | 'arena' | 'leaderboard';
  onTabChange: (t: 'crash' | 'flip' | 'arena' | 'leaderboard') => void;
}

const TABS: { id: NavProps['activeTab']; label: string }[] = [
  { id: 'crash', label: 'Crash' },
  { id: 'flip', label: 'Flip' },
  { id: 'arena', label: 'Arena' },
  { id: 'leaderboard', label: 'Ranking' },
];

const pillBtn =
  'touch-manipulation touch-target px-3 py-2 text-xs font-extrabold rounded-xl bg-[#2a2c33] border border-white/10 text-white/80 hover:bg-[#353842] transition-colors';

const mobileDisconnectBtn =
  'touch-manipulation shrink-0 px-2 py-1.5 text-[10px] font-extrabold rounded-lg bg-[#2a2c33] border border-white/10 text-rose-300 hover:bg-[#353842] transition-colors';

function WalletAvatar({ label }: { label: string }) {
  const initials = label.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  return (
    <div
      className="w-9 h-9 shrink-0 rounded-full bg-amber-500/15 border border-amber-400/35 flex items-center justify-center text-[11px] font-extrabold text-amber-300"
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function Nav({ activeTab, onTabChange }: NavProps) {
  const { wallet, connect, disconnect, displayAddress, refillDemoCredits, holdBonuses } = useWallet();
  const { state: compState } = useCompetitive();
  const [vaultOpen, setVaultOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const vaultEnabled = isVaultConfigured();

  const handleDemoRefill = async () => {
    if (!wallet.connected || wallet.isRealWallet || !wallet.address) return;
    const balance = refillDemoCredits();
    const holdsBb = holdBonuses.active.some(b => b.token === 'BLACKBALLS');
    await syncGameSessionBalances(
      wallet.address,
      balance,
      holdBonuses.stimmy,
      holdBonuses.frenzy,
      holdsBb,
      wallet.isRealWallet,
    );
  };

  const demoRefillButton =
    wallet.connected && !wallet.isRealWallet ? (
      <button
        type="button"
        onClick={() => void handleDemoRefill()}
        className={`${pillBtn} text-emerald-300 border-emerald-500/30`}
        title={`Top up to ${DEMO_REFILL_BB} demo BlackBalls`}
      >
        +{DEMO_REFILL_BB} Demo BlackBalls
      </button>
    ) : null;

  const desktopWalletDetails = wallet.connected && (
    <div className="hidden md:flex flex-col items-end gap-1">
      <span className="text-[11px] font-extrabold text-white/70">{displayAddress}</span>
      <div className="flex items-center gap-2">
        <WalletBalanceCards
          solBalance={wallet.solBalance}
          blackballsBalance={wallet.blackballsBalance}
          arenaWinStreak={compState.arenaWinStreak}
        />
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
        {/* mobile — 3-row layout */}
        <div className="md:hidden max-w-[1700px] mx-auto w-full px-3 pt-2.5">
          {/* Row 1: Brand & session */}
          <div className="flex justify-between items-center w-full gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 shrink">
              <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                <img src={LOGO_SRC} alt="Blackballs Logo" className="w-full h-full object-contain drop-shadow-sm" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white truncate leading-tight">BlackBalls</div>
                <div className="text-[10px] text-white/40 font-bold truncate">Degen Arcade</div>
              </div>
            </div>

            {wallet.connected ? (
              <div className="flex items-center gap-2 min-w-0 max-w-[55%] justify-end">
                <span className="text-[10px] font-extrabold text-white/60 truncate min-w-0">
                  {displayAddress}
                </span>
                <button type="button" onClick={disconnect} className={mobileDisconnectBtn}>
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (vaultEnabled ? setVaultOpen(true) : connect())}
                className="touch-manipulation shrink-0 px-3 py-1.5 text-[10px] font-extrabold bg-sky-500 hover:bg-sky-400 text-white rounded-lg border-b-2 border-sky-700 active:border-b-0"
              >
                Connect
              </button>
            )}
          </div>

          {/* Row 2: Stats & balances */}
          {wallet.connected && (
            <div className="flex flex-wrap items-center justify-between gap-2 w-full mt-4 min-w-0">
              <div className="flex flex-row items-center gap-2 min-w-0 shrink">
                <WalletAvatar label={displayAddress ?? wallet.address ?? '?'} />
                <PlayerXpCounter variant="compact" className="min-w-0" />
              </div>
              <WalletBalanceCards
                solBalance={wallet.solBalance}
                blackballsBalance={wallet.blackballsBalance}
                arenaWinStreak={compState.arenaWinStreak}
                className="shrink-0 min-w-0 [&>div]:min-w-0 [&>div]:px-2 [&>div]:py-1"
              />
            </div>
          )}

          {/* Row 3: Action buttons */}
          <div className="flex gap-2 w-full mt-3 mb-2 min-w-0">
            {wallet.connected && !wallet.isRealWallet && (
              <button
                type="button"
                onClick={() => void handleDemoRefill()}
                className={`${pillBtn} flex-1 min-w-0 whitespace-nowrap text-emerald-300 border-emerald-500/30 justify-center`}
                title={`Top up to ${DEMO_REFILL_BB} demo BlackBalls`}
              >
                +{DEMO_REFILL_BB} Demo BlackBalls
              </button>
            )}
            {!wallet.connected && vaultEnabled && (
              <button
                type="button"
                onClick={() => setVaultOpen(true)}
                className={`${pillBtn} flex-1 min-w-0 whitespace-nowrap text-amber-300 justify-center`}
              >
                Vault
              </button>
            )}
            <Link
              href="/guide"
              className={`${pillBtn} shrink-0 w-auto px-4 inline-flex items-center justify-center whitespace-nowrap`}
            >
              Guide
            </Link>
            {wallet.connected && vaultEnabled && (
              <button
                type="button"
                onClick={() => setVaultOpen(true)}
                className={`${pillBtn} shrink-0 w-auto px-3 text-amber-300 whitespace-nowrap`}
              >
                Vault
              </button>
            )}
          </div>

          {/* tab bar */}
          <nav className="flex border-t border-white/5 bg-[#25262c] -mx-3">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
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
        </div>

        {/* desktop */}
        <div className="hidden md:flex max-w-[1700px] mx-auto px-4 py-2.5 items-center justify-between gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <img src={LOGO_SRC} alt="Blackballs Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white">BlackBalls</div>
              <div className="text-[10px] text-white/40 font-bold -mt-0.5">Degen Arcade</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-[#25262c] rounded-xl p-1 border border-white/5">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
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
            <div className="flex items-center gap-1">
              {wallet.connected ? (
                <>
                  {demoRefillButton}
                  <button type="button" onClick={() => setGuideOpen(true)} className={pillBtn}>
                    Guide
                  </button>
                  {vaultEnabled && (
                    <button type="button" onClick={() => setVaultOpen(true)} className={`${pillBtn} text-amber-300`}>
                      Vault
                    </button>
                  )}
                  <button type="button" onClick={disconnect} className={`${pillBtn} text-rose-300`}>
                    Disconnect
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setGuideOpen(true)} className={pillBtn}>
                    Guide
                  </button>
                  {vaultEnabled && (
                    <button type="button" onClick={() => setVaultOpen(true)} className={`${pillBtn} text-amber-300`}>
                      Vault
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (vaultEnabled ? setVaultOpen(true) : connect())}
                    className="touch-manipulation touch-target px-4 py-2 text-xs font-extrabold bg-sky-500 hover:bg-sky-400 text-white rounded-xl border-b-4 border-sky-700 active:border-b-0 active:translate-y-1 transition-all shrink-0"
                  >
                    Connect
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
