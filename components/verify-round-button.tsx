'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { handleVerifyRound } from '@/lib/handle-verify-round';

interface VerifyRoundButtonProps {
  round: {
    id: number;
    serverSeedHash: string;
    serverSeed: string | null;
    clientSeed: string;
    nonce: number;
    crashPoint: number | null;
    mode?: 'classic' | 'continuous';
    rugTick?: number | null;
  };
}

export function VerifyRoundButton({ round }: VerifyRoundButtonProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [detail, setDetail] = useState<string | null>(null);
  const [showValidatedModal, setShowValidatedModal] = useState(false);
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setDetail(null);
    setShowValidatedModal(false);
    if (verifyTimerRef.current) {
      clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
  }, [round.id]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    };
  }, []);

  if (round.crashPoint == null || !round.serverSeed) return null;

  const verify = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setStatus('checking');
    setDetail(null);
    setShowValidatedModal(false);
    if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    verifyTimerRef.current = setTimeout(() => {
      ac.abort();
      setStatus('invalid');
      setDetail('Verification timed out — try again');
      verifyTimerRef.current = null;
    }, 8000);

    try {
      const result = await handleVerifyRound(
        {
          serverSeed: round.serverSeed!,
          serverSeedHash: round.serverSeedHash,
          clientSeed: round.clientSeed,
          nonce: round.nonce,
          expectedCrashPoint: round.crashPoint!,
          mode: round.mode,
          expectedRugTick: round.rugTick,
        },
        ac.signal,
      );

      if (ac.signal.aborted) return;
      if (verifyTimerRef.current) {
        clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }

      if (result.valid) {
        setStatus('valid');
        setDetail(`Verified @ ${(result.crashPoint ?? round.crashPoint ?? 0).toFixed(2)}x`);
        setShowValidatedModal(true);
      } else {
        setStatus('invalid');
        setDetail(result.reason ?? 'Hash mismatch: Verification failed');
      }
    } catch {
      if (ac.signal.aborted) return;
      setStatus('invalid');
      setDetail('Network error');
    } finally {
      if (verifyTimerRef.current) {
        clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = null;
      }
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-2 sm:mx-0 cp-panel p-3 border-2 border-emerald-500/40 bg-emerald-500/10 font-arcade"
      >
        <div className="text-xs font-extrabold text-emerald-300 mb-1">🔐 Provably Fair — Round #{round.id}</div>
        <div className="text-[10px] text-white/50 font-mono mb-2 break-all">
          Hash: {round.serverSeedHash.slice(0, 24)}…
        </div>
        <button
          type="button"
          onClick={verify}
          disabled={status === 'checking' || status === 'valid'}
          className="w-full touch-manipulation min-h-[44px] py-2.5 text-sm font-black bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:hover:bg-emerald-500"
        >
          {status === 'checking'
            ? 'VERIFYING…'
            : status === 'valid'
              ? '✓ VERIFIED — WAIT FOR NEXT ROUND'
              : '✓ VERIFY THIS ROUND (1-CLICK)'}
        </button>
        {detail && status === 'valid' && (
          <div className="mt-2 text-[11px] font-bold text-center text-emerald-300">{detail}</div>
        )}
        {detail && status === 'invalid' && (
          <div className="mt-2 text-[11px] font-bold text-center text-rose-300">{detail}</div>
        )}
      </motion.div>

      <AnimatePresence>
        {showValidatedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowValidatedModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="cp-panel max-w-sm w-full p-6 text-center border-2 border-emerald-500/50 bg-[#141518] font-arcade"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-2xl font-extrabold text-emerald-300 mb-2">Provably Fair Validated ✓</div>
              <div className="text-sm text-white/70 mb-1">
                Round #{round.id} @ {(round.crashPoint ?? 0).toFixed(2)}x
              </div>
              <div className="text-xs text-white/45 mb-4">Revealed seed matches the committed hash.</div>
              <button
                type="button"
                onClick={() => setShowValidatedModal(false)}
                className="w-full min-h-[44px] py-2.5 text-sm font-black bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all"
              >
                GOT IT
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
