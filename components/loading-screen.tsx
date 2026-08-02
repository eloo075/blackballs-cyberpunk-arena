'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isLaunchCampaignActive } from '@/lib/launch-campaign';

const LOGO_SRC = '/blackballs-logo-transparent.png';
const DURATION_MS = 6000;
const HYPE_INTERVAL_MS = 1200;
const SESSION_KEY = 'bb_boot_done';

const HYPE_LINES = [
  'INITIALIZING CRASH ENGINE...',
  'PREPARING REVENUE BUYBACKS... 🔥',
  'BURNING PAPER HAND SUPPLY... 📉',
  'HOLD $BLACKBALLS FOR +30% PAYOUT BOOST 💰',
  'READY TO GET RUGGED? 🟢',
] as const;

export function LoadingScreen() {
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (isLaunchCampaignActive()) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      /* private browsing */
    }

    setActive(true);
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      setProgress(Math.min(100, (elapsed / DURATION_MS) * 100));
      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);

    const hypeTimer = window.setInterval(() => {
      setLineIndex(i => (i + 1) % HYPE_LINES.length);
    }, HYPE_INTERVAL_MS);

    const finishTimer = window.setTimeout(() => {
      setProgress(100);
      setExiting(true);
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setActive(false), 550);
    }, DURATION_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(hypeTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  if (!active) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0A0A0A] px-6"
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      aria-live="polite"
      aria-busy={!exiting}
      role="status"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(90vw,520px)] h-[min(90vw,520px)] rounded-full bg-teal-500/5 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-40 h-40 rounded-full bg-orange-500/5 blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <motion.div
          className="w-28 h-28 sm:w-32 sm:h-32 mb-8 flex items-center justify-center animate-pulse"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <img
            src={LOGO_SRC}
            alt="$BlackBalls"
            className="w-full h-full object-contain drop-shadow-[0_0_24px_rgba(45,212,191,0.35)]"
            onError={e => {
              (e.target as HTMLImageElement).src = '/fallback-blackball-logo.svg';
            }}
          />
        </motion.div>

        <div className="text-center mb-6">
          <div className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-arcade">$BlackBalls</div>
          <div className="text-[11px] text-white/40 font-bold mt-1 tracking-widest uppercase">Degen Arcade</div>
        </div>

        <div className="w-full h-2 rounded-full bg-zinc-900 border border-white/10 overflow-hidden shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-orange-400 shadow-[0_0_16px_rgba(45,212,191,0.65),0_0_8px_rgba(251,146,60,0.4)]"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'linear', duration: 0.05 }}
          />
        </div>

        <div className="mt-2 w-full flex justify-between text-[10px] font-mono text-white/30 tabular-nums">
          <span>BOOT</span>
          <span>{Math.round(progress)}%</span>
        </div>

        <div className="mt-5 h-6 w-full flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={lineIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-mono text-green-400/80 text-center tracking-wide"
            >
              {HYPE_LINES[lineIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
