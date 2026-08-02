'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import {
  formatResultAmount,
  lossDurationMs,
  particleSeed,
  type ResultFeedbackEvent,
  winDurationMs,
} from '@/lib/result-feedback-utils';

interface ResultFeedbackProps {
  event: ResultFeedbackEvent | null;
  onComplete: () => void;
}

function WinParticles({ id, count }: { id: string; count: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = particleSeed(id, i);
        const seed2 = particleSeed(id, i + 100);
        const seed3 = particleSeed(id, i + 200);
        return {
          left: `${8 + seed * 84}%`,
          delay: seed2 * 0.35,
          duration: 1.4 + seed3 * 0.9,
          size: 10 + Math.floor(seed * 14),
          rotate: seed * 720 - 360,
        };
      }),
    [id, count],
  );

  return (
    <div className="result-feedback-particles" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="result-feedback-coin"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--coin-rot' as string]: `${p.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

function WinBurst({ intensity }: { intensity: ResultFeedbackEvent['intensity'] }) {
  const rings = intensity === 'mega' ? 3 : intensity === 'big' ? 2 : 1;
  return (
    <div className="result-feedback-win-burst" aria-hidden>
      {Array.from({ length: rings }, (_, i) => (
        <div
          key={i}
          className="result-feedback-win-ring"
          style={{ animationDelay: `${i * 0.12}s` }}
        />
      ))}
      <div className="result-feedback-win-glow" />
    </div>
  );
}

export function ResultFeedback({ event, onComplete }: ResultFeedbackProps) {
  useEffect(() => {
    if (!event) return;
    const ms = event.won ? winDurationMs(event.intensity) : lossDurationMs();
    const t = window.setTimeout(onComplete, ms);
    return () => window.clearTimeout(t);
  }, [event, onComplete]);

  const particleCount =
    event?.intensity === 'mega' ? 36 : event?.intensity === 'big' ? 26 : 18;

  const amountClass =
    event?.intensity === 'mega'
      ? 'result-feedback-amount-mega'
      : event?.intensity === 'big'
        ? 'result-feedback-amount-big'
        : 'result-feedback-amount-normal';

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`result-feedback-overlay ${event.won ? 'result-feedback-win' : 'result-feedback-loss'}`}
          aria-live="polite"
          role="status"
        >
          {!event.won && <div className="result-feedback-loss-vignette" aria-hidden />}

          {event.won && (
            <>
              <WinBurst intensity={event.intensity} />
              <WinParticles id={event.id} count={particleCount} />
            </>
          )}

          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: event.won ? 30 : 0 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: -12 }}
            transition={{
              type: 'spring',
              stiffness: event.won ? 280 : 360,
              damping: event.won ? 18 : 22,
            }}
            className={`result-feedback-card ${event.won ? 'result-feedback-card-win' : 'result-feedback-card-loss'}`}
          >
            <div className={`result-feedback-label ${event.won ? 'text-amber-200' : 'text-rose-300'}`}>
              {event.won
                ? event.intensity === 'mega'
                  ? '🚀 MOON WIN'
                  : event.intensity === 'big'
                    ? '💰 BIG WIN'
                    : '✨ WIN'
                : event.subtitle?.toLowerCase().includes('rug')
                  ? '💀 RUGGED'
                  : '📉 LOSS'}
            </div>
            <div
              className={`result-feedback-amount tabular-nums ${amountClass} ${
                event.won ? 'result-feedback-amount-win' : 'result-feedback-amount-loss'
              }`}
            >
              {formatResultAmount(event.amount)}
            </div>
            {event.subtitle && (
              <div className="result-feedback-subtitle">{event.subtitle}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
