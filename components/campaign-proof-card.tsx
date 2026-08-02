'use client';

import { motion } from 'framer-motion';
import { LAUNCH_CAMPAIGN_SPOTS, shortenWallet } from '@/lib/launch-campaign';

const LOGO_SRC = '/blackballs-logo-transparent.png';

interface CampaignProofCardProps {
  walletAddress: string;
  spotNumber: number;
  className?: string;
}

export function CampaignProofCard({ walletAddress, spotNumber, className = '' }: CampaignProofCardProps) {
  const displayWallet = shortenWallet(walletAddress);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 24, rotateX: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`relative w-full max-w-[340px] mx-auto ${className}`}
      data-proof-card
    >
      {/* glow */}
      <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-amber-400/30 via-orange-500/20 to-rose-500/25 blur-2xl opacity-80" />

      <div className="relative overflow-hidden rounded-[1.75rem] border-[3px] border-black bg-[#0a0a0c] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        {/* confetti dots */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 18 }, (_, i) => (
            <motion.span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full"
              style={{
                left: `${8 + ((i * 17) % 84)}%`,
                top: `${6 + ((i * 23) % 88)}%`,
                background:
                  i % 3 === 0 ? '#facc15' : i % 3 === 1 ? '#fb7185' : '#38bdf8',
              }}
              animate={{ y: [0, -6, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 2 + (i % 3) * 0.4, repeat: Infinity, delay: i * 0.08 }}
            />
          ))}
        </div>

        <div className="relative px-5 pt-5 pb-6 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Proof card · screenshot this
          </div>

          <motion.div
            initial={{ scale: 0.5, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.15, stiffness: 300, damping: 16 }}
            className="mx-auto mt-4 flex h-20 w-20 items-center justify-center"
          >
            <img
              src={LOGO_SRC}
              alt="BlackBalls"
              className="h-full w-full object-contain drop-shadow-[0_8px_24px_rgba(251,191,36,0.35)]"
            />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-3 text-2xl font-extrabold leading-tight text-white"
          >
            CONGRATS, DEGEN!
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-2 text-sm font-bold text-amber-200/90"
          >
            You&apos;re in the{' '}
            <span className="text-amber-300">First {LAUNCH_CAMPAIGN_SPOTS} Balls Club</span>{' '}
            <span aria-hidden>🤌</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-4 rounded-2xl border-2 border-amber-400/40 bg-gradient-to-b from-amber-400/15 to-orange-500/5 px-4 py-3"
          >
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-200/60">
              Spot #{spotNumber} / {LAUNCH_CAMPAIGN_SPOTS}
            </div>
            <div className="mt-2 break-all font-mono text-sm font-bold text-amber-100">{displayWallet}</div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-4 text-[11px] font-bold leading-relaxed text-white/45"
          >
            Reply on X with this screenshot to lock your spot.
            <br />
            <span className="text-white/30">game.blackballs.site</span>
          </motion.p>
        </div>

        {/* bottom stripe */}
        <div className="h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
      </div>
    </motion.div>
  );
}
