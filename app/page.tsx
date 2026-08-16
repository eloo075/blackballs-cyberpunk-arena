'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { CrashView } from '@/components/crash-view';
import { FlipComingSoon } from '@/components/flip-coming-soon';
import { LaunchCampaignView } from '@/components/launch-campaign-view';
import { isLaunchCampaignActive } from '@/lib/launch-campaign';
import { isLikelyMobileDevice } from '@/hooks/use-page-visibility';

type Tab = 'crash' | 'flip';

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

  const onTabChange = (t: Tab) => {
    setTab(t === 'flip' ? 'flip' : 'crash');
  };

  return (
    <div
      className={`bg-[#141518] flex flex-col font-arcade ${
        mobile && tab === 'crash' ? 'h-dvh max-h-dvh' : 'min-h-screen'
      }`}
    >
      <Nav activeTab={tab} onTabChange={onTabChange} />
      <main
        className={`flex-1 min-h-0 ${
          mobile && tab === 'crash' ? 'overflow-y-auto overscroll-contain' : ''
        }`}
      >
        {mobile ? (
          <>
            {tab === 'crash' && (
              <div className="min-h-0">
                <CrashView visible />
              </div>
            )}
            {tab === 'flip' && <FlipComingSoon />}
          </>
        ) : (
          <>
            <div className={tab === 'crash' ? '' : 'hidden'} aria-hidden={tab !== 'crash'}>
              <CrashView visible={tab === 'crash'} />
            </div>
            {tab === 'flip' && <FlipComingSoon />}
          </>
        )}
      </main>
      <footer
        className={`text-center text-[10px] text-white/30 py-3 px-3 border-t border-white/5 safe-bottom ${
          mobile && tab === 'crash' ? 'hidden' : ''
        }`}
      >
        $BlackBalls · Crash ·{' '}
        <Link href="/guide" className="text-sky-400/70 hover:text-sky-300">
          Player Guide
        </Link>
      </footer>
    </div>
  );
}
