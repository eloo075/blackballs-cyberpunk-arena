'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { CampaignChartBackdrop } from '@/components/campaign-chart-backdrop';
import { CampaignProofCard } from '@/components/campaign-proof-card';
import { CampaignNav } from '@/components/campaign-nav';
import { useCrashVault } from '@/hooks/useCrashVault';
import {
  LAUNCH_CAMPAIGN_SPOTS,
  normalizeCampaignWallet,
  shortenWallet,
} from '@/lib/launch-campaign';
import type { CampaignStatusResult } from '@/lib/launch-campaign-store';

type Step = 'form' | 'card';

const STEPS = [
  'Like + RT the launch post',
  'Follow @BlackBalls on X',
  'Join the Telegram war room',
  'Submit your wallet below',
  'Screenshot your proof card',
  'Reply on X with your screenshot',
] as const;

export function LaunchCampaignView() {
  const { address: connectedAddress, isConnected } = useAccount();
  const vault = useCrashVault();

  const [manualWallet, setManualWallet] = useState('');
  const [status, setStatus] = useState<CampaignStatusResult | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [spotNumber, setSpotNumber] = useState<number | null>(null);
  const [registeredWallet, setRegisteredWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedWallet = manualWallet.trim();
  const resolvedWallet =
    normalizeCampaignWallet(connectedAddress ?? '') ??
    normalizeCampaignWallet(trimmedWallet);
  const hasWalletInput = trimmedWallet.length > 0 || Boolean(connectedAddress);
  const walletInvalid = hasWalletInput && !resolvedWallet;

  const refreshStatus = useCallback(async (wallet?: string | null) => {
    const query = wallet ? `?address=${encodeURIComponent(wallet)}` : '';
    const res = await fetch(`/api/campaign/status${query}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as CampaignStatusResult;
    setStatus(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshStatus(null);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (!resolvedWallet) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const data = await refreshStatus(resolvedWallet);
      if (cancelled || !data) return;
      if (data.registered && data.spotNumber != null) {
        setSpotNumber(data.spotNumber);
        setRegisteredWallet(resolvedWallet);
        setStep('card');
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshStatus, resolvedWallet]);

  useEffect(() => {
    if (isConnected && connectedAddress) {
      setManualWallet(connectedAddress);
    }
  }, [isConnected, connectedAddress]);

  const handleSubmit = async () => {
    setError(null);
    const wallet = resolvedWallet;
    if (!wallet) {
      setError('Connect your wallet or paste a valid 0x address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/campaign/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Registration failed');
        await refreshStatus(wallet);
        return;
      }

      setSpotNumber(data.spotNumber);
      setRegisteredWallet(wallet);
      setStep('card');
      await refreshStatus(wallet);
    } catch {
      setError('Network error — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const spotsRemaining = status?.spotsRemaining ?? LAUNCH_CAMPAIGN_SPOTS;
  const totalClaimed = status?.totalClaimed ?? 0;
  const campaignFull = status?.full ?? false;
  const progressPct = Math.min(100, (totalClaimed / LAUNCH_CAMPAIGN_SPOTS) * 100);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#141518] font-arcade">
      <CampaignNav />

      <div className="relative flex flex-1 flex-col">
        <CampaignChartBackdrop />

        <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:py-10">
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait">
              {step === 'card' && registeredWallet && spotNumber != null ? (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-5"
                >
                  <CampaignProofCard walletAddress={registeredWallet} spotNumber={spotNumber} />

                  <div className="rounded-2xl border border-white/10 bg-[#1f2025]/90 p-4 text-center backdrop-blur-sm">
                    <p className="text-xs font-bold text-white/60">
                      Screenshot the card above and reply on the launch post on X.
                    </p>
                    <a
                      href="https://x.com/BlackBalls"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex touch-manipulation items-center justify-center rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-sky-400"
                    >
                      Post proof on X
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="rounded-[1.75rem] border border-white/10 bg-[#1f2025]/92 p-5 shadow-2xl backdrop-blur-md sm:p-6"
                >
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-200">
                      Pre-launch whitelist
                    </div>
                    <h1 className="mt-3 text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                      Join the First {LAUNCH_CAMPAIGN_SPOTS}
                    </h1>
                    <p className="mt-2 text-sm font-bold text-white/50">
                      Crash is running live behind the curtain. Submit your wallet to claim a spot
                      and unlock your proof card.
                    </p>
                  </div>

                  {/* spots progress */}
                  <div className="mt-5">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] font-extrabold">
                      <span className="text-white/45">{totalClaimed} claimed</span>
                      <span className={campaignFull ? 'text-rose-300' : 'text-emerald-300'}>
                        {campaignFull ? 'FULL' : `${spotsRemaining} left`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>

                  {/* steps */}
                  <ol className="mt-5 space-y-1.5 text-[11px] font-bold text-white/45">
                    {STEPS.map((label, i) => (
                      <li key={label} className="flex gap-2">
                        <span className="shrink-0 text-amber-300/80">{i + 1}.</span>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ol>

                  {campaignFull ? (
                    <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-center text-xs font-extrabold text-rose-200">
                      All {LAUNCH_CAMPAIGN_SPOTS} spots are claimed. Follow X for the public launch.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {vault.vaultConfigured && !isConnected && (
                        <button
                          type="button"
                          onClick={() => void vault.connectWallet()}
                          disabled={vault.isConnecting}
                          className="w-full touch-manipulation rounded-xl border border-sky-400/30 bg-gradient-to-r from-sky-500 to-sky-600 py-3 text-xs font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                        >
                          {vault.isConnecting ? 'Connecting…' : 'Connect wallet'}
                        </button>
                      )}

                      {isConnected && connectedAddress && (
                        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-center text-[11px] font-extrabold text-emerald-200">
                          Connected: {shortenWallet(connectedAddress)}
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="campaign-wallet"
                          className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-white/40"
                        >
                          Wallet address (0x…)
                        </label>
                        <input
                          id="campaign-wallet"
                          type="text"
                          value={manualWallet}
                          onChange={e => {
                            setManualWallet(e.target.value);
                            setError(null);
                          }}
                          placeholder="0x1234567890123456789012345678901234567890"
                          spellCheck={false}
                          autoComplete="off"
                          className={`w-full rounded-xl border bg-[#141518] px-4 py-3 font-mono text-sm text-white outline-none ring-sky-400/40 placeholder:text-white/20 focus:ring-2 ${
                            walletInvalid
                              ? 'border-rose-400/50 focus:border-rose-400/50'
                              : resolvedWallet
                                ? 'border-emerald-400/40 focus:border-emerald-400/40'
                                : 'border-white/10 focus:border-sky-400/40'
                          }`}
                        />
                        {walletInvalid && (
                          <p className="mt-1.5 text-[11px] font-bold text-rose-300">
                            Must start with 0x and be 42 characters (example above).
                          </p>
                        )}
                        {!hasWalletInput && (
                          <p className="mt-1.5 text-[11px] font-bold text-white/35">
                            Paste your EVM wallet or click Connect wallet.
                          </p>
                        )}
                      </div>

                      {error && (
                        <p className="text-center text-xs font-extrabold text-rose-300">{error}</p>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={submitting || loading || campaignFull}
                        className="w-full touch-manipulation rounded-xl border-b-4 border-amber-700 bg-gradient-to-r from-amber-400 to-orange-500 py-3.5 text-sm font-extrabold text-black transition-transform active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {submitting
                          ? 'Claiming spot…'
                          : loading
                            ? 'Loading…'
                            : 'Claim my spot & get proof card'}
                      </button>
                    </div>
                  )}

                  <p className="mt-4 text-center text-[10px] font-bold text-white/30">
                    Full game unlocks after airdrop distribution · Crash live in background
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/5 py-3 text-center text-[10px] text-white/30">
        $BlackBalls · First {LAUNCH_CAMPAIGN_SPOTS} campaign · game.blackballs.site
      </footer>
    </div>
  );
}
