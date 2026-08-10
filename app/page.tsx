'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Nav } from '@/components/nav';
import { CrashView } from '@/components/crash-view';
import { ArenaView } from '@/components/arena-view';
import { FlipView } from '@/components/flip-view';
import { LeaderboardView } from '@/components/leaderboard-view';
import { LaunchCampaignView } from '@/components/launch-campaign-view';
import { isLaunchCampaignActive } from '@/lib/launch-campaign';
import { isLikelyMobileDevice } from '@/hooks/use-page-visibility';

type Tab = 'crash' | 'flip' | 'arena' | 'leaderboard';

export default function Page() {
  if (isLaunchCampaignActive()) {
    return <LaunchCampaignView />;
  }

  return <GameHome />;
}

function GameHome() {
  const [tab, setTab] = useState<Tab>('crash');
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isLikelyMobileDevice());
  }, []);

  return (
    <div
      className={`bg-[#141518] flex flex-col font-arcade ${
        mobile && tab === 'crash' ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-screen'
      }`}
    >
      <Nav activeTab={tab} onTabChange={setTab} />
      <main
        className={`flex-1 min-h-0 ${
          mobile && tab === 'crash' ? 'overflow-hidden flex flex-col' : ''
        }`}
      >
        {mobile ? (
          <>
            {tab === 'crash' && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <CrashView visible />
              </div>
            )}
            {tab === 'flip' && <FlipView visible />}
          </>
        ) : (
          <>
            {/* Keep Crash + Flip mounted on desktop so SSE/session stay warm across tab switches */}
            <div className={tab === 'crash' ? '' : 'hidden'} aria-hidden={tab !== 'crash'}>
              <CrashView visible={tab === 'crash'} />
            </div>
            <div className={tab === 'flip' ? '' : 'hidden'} aria-hidden={tab !== 'flip'}>
              <FlipView visible={tab === 'flip'} />
            </div>
          </>
        )}
        <AnimatePresence mode="wait">
          {tab === 'arena' && (
            <motion.div key="arena" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
              <ArenaView />
            </motion.div>
          )}
          {tab === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
              <LeaderboardView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <footer
        className={`text-center text-[10px] text-white/30 py-3 px-3 border-t border-white/5 safe-bottom ${
          mobile && tab === 'crash' ? 'hidden' : ''
        }`}
      >
        $BlackBalls · Degen Arcade ·{' '}
        <Link href="/guide" className="text-sky-400/70 hover:text-sky-300">
          Player Guide
        </Link>
      </footer>
    </div>
  );
}
