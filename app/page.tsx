'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Nav } from '@/components/nav';
import { CrashView } from '@/components/crash-view';
import { ArenaView } from '@/components/arena-view';
import { LeaderboardView } from '@/components/leaderboard-view';

type Tab = 'crash' | 'arena' | 'leaderboard';

export default function Page() {
  const [tab, setTab] = useState<Tab>('crash');
  return (
    <div className="min-h-screen bg-[#141518] flex flex-col font-arcade">
      <Nav activeTab={tab} onTabChange={setTab} />
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            {tab === 'crash' && <CrashView />}
            {tab === 'arena' && <ArenaView />}
            {tab === 'leaderboard' && <LeaderboardView />}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="text-center text-[10px] text-white/30 py-3 px-3 border-t border-white/5 safe-bottom">
        $BlackBalls · Degen Arcade ·{' '}
        <Link href="/guide" className="text-sky-400/70 hover:text-sky-300">
          Player Guide
        </Link>
      </footer>
    </div>
  );
}
