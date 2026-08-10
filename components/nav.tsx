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

type TabId = NavProps['activeTab'];

const TABS: { id: TabId; label: string }[] = [
  { id: 'crash', label: 'Crash' },
  { id: 'flip', label: 'Flip' },
  { id: 'arena', label: 'Arena' },
  { id: 'leaderboard', label: 'Ranking' },
];

function TabIcon({ id, active }: { id: TabId; active: boolean }) {
  const stroke = active ? '#0a0a0a' : 'currentColor';
  const fill = active ? '#0a0a0a' : 'currentColor';
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true as const,
  };

  switch (id) {
    case 'crash':
      return (
        <svg {...common}>
          <path
            d="M4 16 L8 10 L11 13 L15 6 L20 14"
            stroke={stroke}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M4 18h16" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
        </svg>
      );
    case 'flip':
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="8" ry="8" stroke={stroke} strokeWidth="2" />
          <ellipse cx="12" cy="12" rx="3.2" ry="8" stroke={stroke} strokeWidth="1.6" opacity="0.7" />
          <path d="M4 12h16" stroke={stroke} strokeWidth="1.4" opacity="0.35" />
        </svg>
      );
    case 'arena':
      return (
        <svg {...common}>
          <path
            d="M7 4h3l1 3 1-3h3v3.5c0 3.2-1.6 5.5-4 6.8-2.4-1.3-4-3.6-4-6.8V4z"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9 20h6M12 14.3V20" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'leaderboard':
      return (
        <svg {...common}>
          <path d="M5 20V11h4v9H5zM10 20V6h4v14h-4zM15 20v-7h4v7h-4z" fill={fill} opacity={active ? 1 : 0.85} />
          <path d="M8 6l2.2-3L12.5 5 15 3.2" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function GuideIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.2c0 .7-.7 1.2-1.4.9L12 18.2l-3.6 1.9c-.7.3-1.4-.2-1.4-.9V7A2.5 2.5 0 0 1 9.5 4.5H5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 9h5M9 12.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

function DemoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v9M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 7H7.5A3.5 3.5 0 0 0 4 10.5v3A3.5 3.5 0 0 0 7.5 17H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M14 12h6M17.5 9.5 20 12l-2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavTabButton({
  tab,
  active,
  onClick,
  compact,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nav-tab-btn relative touch-manipulation font-extrabold transition-all duration-200 ${
          compact
            ? 'flex-1 flex flex-col items-center gap-0.5 py-1.5 px-1 text-[10px] rounded-lg'
            : 'flex items-center gap-2 px-4 py-2.5 text-[13px] rounded-xl'
      } ${
        active
          ? 'nav-tab-active text-black'
          : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]'
      }`}
    >
      {active && (
        <motion.span
          layoutId={compact ? 'nav-tab-glow-mobile' : 'nav-tab-glow-desktop'}
          className="nav-tab-glow-cadre absolute inset-0 rounded-xl pointer-events-none"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        />
      )}
      <span className={`relative z-[1] ${active ? 'text-black' : ''}`}>
        <TabIcon id={tab.id} active={active} />
      </span>
      <span className="relative z-[1] tracking-wide">{tab.label}</span>
    </button>
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

  return (
    <>
      <VaultModal open={vaultOpen} onClose={() => setVaultOpen(false)} />
      <HowToPlayModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <header className="sticky top-0 z-40 border-b border-amber-500/10 bg-[#0a0b0f]/94 backdrop-blur-xl safe-bottom font-arcade shadow-[0_8px_32px_rgba(0,0,0,0.45)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
          aria-hidden
        />

        {/* mobile */}
        <div className="md:hidden max-w-[1700px] mx-auto w-full px-3 pt-1.5">
          <div className="flex justify-between items-center w-full gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 shrink">
              <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/15 to-transparent border border-amber-400/25">
                <img src={LOGO_SRC} alt="Blackballs Logo" className="w-5 h-5 object-contain" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-white truncate leading-tight tracking-tight">
                  BlackBalls
                </div>
              </div>
            </div>

            {wallet.connected ? (
              <div className="flex items-center gap-2 min-w-0 max-w-[55%] justify-end">
                <span className="text-[10px] font-extrabold text-white/50 truncate min-w-0 font-mono">
                  {displayAddress}
                </span>
                <button
                  type="button"
                  onClick={disconnect}
                  className="nav-action-chip nav-action-disconnect shrink-0 !min-h-[30px] !px-2.5 !text-[10px]"
                >
                  <DisconnectIcon />
                  Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (vaultEnabled ? setVaultOpen(true) : connect())}
                className="touch-manipulation shrink-0 px-3.5 py-1.5 text-[11px] font-extrabold bg-emerald-500 text-white rounded-lg border-b-2 border-emerald-700 shadow-[0_0_16px_rgba(16,185,129,0.25)]"
              >
                Connect
              </button>
            )}
          </div>

          {wallet.connected && activeTab !== 'crash' && (
            <div className="flex flex-wrap items-center justify-between gap-2 w-full mt-3 min-w-0">
              <PlayerXpCounter variant="nav" className="min-w-0" />
              <WalletBalanceCards
                solBalance={wallet.solBalance}
                blackballsBalance={wallet.blackballsBalance}
                arenaWinStreak={compState.arenaWinStreak}
                variant="nav"
                className="shrink-0"
              />
            </div>
          )}

          {/* Crash: keep chrome minimal so chart + BUY/SELL fit one screen (rugs.fun). */}
          {activeTab !== 'crash' && (
          <div className="flex gap-1.5 w-full mt-2.5 mb-2 min-w-0">
            {wallet.connected && !wallet.isRealWallet && (
              <button
                type="button"
                onClick={() => void handleDemoRefill()}
                className="flex-1 nav-action-chip nav-action-demo"
                title={`Top up to ${DEMO_REFILL_BB} demo BlackBalls`}
              >
                <DemoIcon />
                +{DEMO_REFILL_BB} Demo
              </button>
            )}
            {wallet.connected && wallet.airdropped && (
              <span className="nav-action-chip text-amber-300 border-amber-400/35 bg-amber-400/10 shrink-0">
                AIRDROP
              </span>
            )}
            <Link href="/guide" className="nav-action-chip nav-action-guide shrink-0">
              <GuideIcon />
              Guide
            </Link>
            {vaultEnabled && (
              <button
                type="button"
                onClick={() => setVaultOpen(true)}
                className="nav-action-chip shrink-0 text-amber-300/90 border-amber-400/25"
              >
                Vault
              </button>
            )}
          </div>
          )}

          <nav
            className={`flex gap-1.5 border-t border-white/[0.05] -mx-3 px-2 bg-[#08090c]/70 ${
              activeTab === 'crash' ? 'mt-1.5 py-1.5' : 'py-2'
            }`}
          >
            {TABS.map(t => (
              <NavTabButton
                key={t.id}
                tab={t}
                active={activeTab === t.id}
                onClick={() => onTabChange(t.id)}
                compact
              />
            ))}
          </nav>
        </div>

        {/* desktop */}
        <div className="hidden md:flex max-w-[1700px] mx-auto px-5 py-3 items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl bg-gradient-to-br from-amber-400/20 via-amber-500/5 to-transparent border border-amber-400/30 shadow-[0_0_24px_rgba(251,191,36,0.15)]">
              <img src={LOGO_SRC} alt="Blackballs Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white tracking-tight leading-none">
                BlackBalls
              </div>
              <div className="text-[9px] text-amber-300/45 font-bold uppercase tracking-[0.18em] mt-1">
                Degen Arcade
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 rounded-2xl p-1.5 bg-[#12141a]/90 border border-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {TABS.map(t => (
              <NavTabButton
                key={t.id}
                tab={t}
                active={activeTab === t.id}
                onClick={() => onTabChange(t.id)}
              />
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0 min-w-0">
            {wallet.connected ? (
              <>
                <PlayerXpCounter variant="nav" className="hidden lg:flex" />

                <div className="nav-wallet-chip hidden xl:flex items-center gap-2 px-2.5 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  <span className="text-[11px] font-extrabold text-white/70 font-mono tracking-tight max-w-[118px] truncate">
                    {displayAddress}
                  </span>
                  {wallet.airdropped && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-400 text-black tracking-wide shadow-[0_0_12px_rgba(251,191,36,0.35)]">
                      AIRDROP
                    </span>
                  )}
                </div>

                <WalletBalanceCards
                  solBalance={wallet.solBalance}
                  blackballsBalance={wallet.blackballsBalance}
                  arenaWinStreak={compState.arenaWinStreak}
                  variant="nav"
                />

                <div className="flex items-center gap-1.5 pl-2 ml-0.5 border-l border-white/[0.08]">
                  {!wallet.isRealWallet && (
                    <button
                      type="button"
                      onClick={() => void handleDemoRefill()}
                      className="nav-action-chip nav-action-demo"
                      title={`Top up to ${DEMO_REFILL_BB} demo BlackBalls`}
                    >
                      <DemoIcon />
                      +{DEMO_REFILL_BB} Demo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setGuideOpen(true)}
                    className="nav-action-chip nav-action-guide"
                  >
                    <GuideIcon />
                    Guide
                  </button>
                  {vaultEnabled && (
                    <button
                      type="button"
                      onClick={() => setVaultOpen(true)}
                      className="nav-action-chip text-amber-300 border-amber-400/30 hover:bg-amber-400/10"
                    >
                      Vault
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={disconnect}
                    className="nav-action-chip nav-action-disconnect"
                  >
                    <DisconnectIcon />
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="nav-action-chip nav-action-guide"
                >
                  <GuideIcon />
                  Guide
                </button>
                {vaultEnabled && (
                  <button
                    type="button"
                    onClick={() => setVaultOpen(true)}
                    className="nav-action-chip text-amber-300 border-amber-400/30"
                  >
                    Vault
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (vaultEnabled ? setVaultOpen(true) : connect())}
                  className="touch-manipulation touch-target px-5 py-2.5 text-[12px] font-black bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl border-b-[3px] border-emerald-700 active:border-b-0 active:translate-y-0.5 transition-all shadow-[0_0_24px_rgba(16,185,129,0.28)]"
                >
                  Connect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
