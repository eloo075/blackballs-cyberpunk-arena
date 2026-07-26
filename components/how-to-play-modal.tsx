'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { HowToPlayGuide } from '@/components/how-to-play-guide';

interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
}

export function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#141518]/85 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#1f2025] border border-white/5 sm:rounded-2xl font-arcade"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5 bg-[#1f2025]/95 border-b border-white/5 backdrop-blur">
              <span className="text-sm font-extrabold text-amber-300">Guide</span>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-extrabold rounded-xl bg-[#2a2c33] border border-white/10 text-white/70 hover:text-white"
              >
                Close
              </button>
            </div>
            <HowToPlayGuide />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
