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
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-[#07091c] border border-cp-cyan/30 sm:rounded-lg shadow-[0_0_40px_rgba(0,240,255,0.15)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-center justify-between px-3 py-2 bg-[#07091c]/95 border-b border-white/10 backdrop-blur">
              <span className="text-[10px] font-black tracking-widest text-cp-yellow">GUIDE</span>
              <button
                type="button"
                onClick={onClose}
                className="cp-btn px-3 py-1.5 text-[10px] border border-cp-magenta/40 text-cp-magenta hover:bg-cp-magenta/10"
              >
                CLOSE
              </button>
            </div>
            <HowToPlayGuide />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
