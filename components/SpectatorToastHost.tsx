'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCrashSpectator } from '@/components/crash-spectator-provider';

/** Compact global toast stack — fixed size on all screens. */
export function SpectatorToastHost() {
  const { toasts, dismissToast } = useCrashSpectator();

  return (
    <div className="fixed top-14 right-2 z-[70] flex flex-col items-end gap-1 pointer-events-none sm:top-16 sm:right-3">
      <AnimatePresence>
        {toasts.map(toast => {
          const isFame = toast.kind === 'fame';
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 20, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.92 }}
              transition={{ duration: 0.15 }}
              className={`pointer-events-auto w-[172px] max-w-[172px] rounded-lg border px-2 py-1 font-mono backdrop-blur-sm ${
                isFame
                  ? 'border-amber-400/30 bg-black/60'
                  : 'border-rose-500/25 bg-black/55'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[8px] font-black uppercase tracking-wide ${
                      isFame ? 'text-amber-300/90' : 'text-rose-400/90'
                    }`}
                  >
                    {isFame ? '🏆 FAME' : '💀 SHAME'}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] leading-tight text-white/70">
                    {toast.body}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="shrink-0 text-[9px] leading-none text-white/25 hover:text-white/60"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
