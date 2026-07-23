'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useCrashSpectator } from '@/components/crash-spectator-provider';

/** Global Hall of Fame / Hall of Shame toast stack for all connected clients. */
export function SpectatorToastHost() {
  const { toasts, dismissToast } = useCrashSpectator();

  return (
    <div className="fixed top-16 right-3 z-[70] flex flex-col gap-2 pointer-events-none max-w-sm w-full sm:w-80">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            className={`pointer-events-auto cp-panel p-3 font-mono border backdrop-blur-md ${
              toast.kind === 'fame'
                ? 'border-cp-yellow/60 bg-cp-yellow/10 shadow-[0_0_24px_rgba(252,238,10,0.25)]'
                : 'border-cp-magenta/60 bg-cp-magenta/10 shadow-[0_0_24px_rgba(255,0,60,0.25)]'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div
                  className={`text-[10px] font-black tracking-[0.2em] ${
                    toast.kind === 'fame' ? 'text-cp-yellow' : 'text-cp-magenta'
                  }`}
                >
                  {toast.kind === 'fame' ? '🏆' : '💀'} {toast.title}
                </div>
                <div className="text-[11px] text-white/80 mt-1 leading-snug">{toast.body}</div>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-white/30 hover:text-white text-[10px] shrink-0"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
