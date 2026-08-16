import type { Metadata } from 'next';
import Link from 'next/link';
import { HowToPlayGuide } from '@/components/how-to-play-guide';
import { GuideShareBar } from '@/components/guide-share-bar';

const SITE_URL = 'https://game.blackballs.site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Player Guide — $BlackBalls Degen Arcade',
  description:
    'Crash Standard guide: presale + live buys, stacked entries, cash-out, and the First 500 believers airdrop.',
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/guide`,
    siteName: '$BlackBalls',
    title: 'Player Guide — $BlackBalls Degen Arcade',
    description:
      'Learn Crash Standard (buy live, stack, cash out) and the First 500 believers airdrop. Share with your degens.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: '$BlackBalls Degen Arcade Guide' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Player Guide — $BlackBalls Degen Arcade',
    description: 'Crash Standard mechanics and the First 500 believers airdrop for $BlackBalls.',
    images: ['/og-image.png'],
  },
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#141518] font-arcade">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#1f2025]/95 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center justify-between gap-2">
          <Link href="/" className="text-sm font-extrabold text-white hover:text-amber-300 transition-colors">
            ← Play
          </Link>
          <span className="text-xs font-extrabold text-white/60 uppercase tracking-wide">Player Guide</span>
          <GuideShareBar />
        </div>
      </header>

      <main className="py-6 px-3 flex flex-col items-center">
        <HowToPlayGuide variant="poster" />
        <div className="mt-5 flex flex-col items-center gap-3 max-w-[420px] w-full">
          <GuideShareBar variant="full" />
          <Link
            href="/"
            className="w-full text-center py-3 text-sm font-black bg-amber-500 hover:bg-amber-400 text-black rounded-xl border-b-4 border-amber-700 active:border-b-0 active:translate-y-1 transition-all"
          >
            Launch Game →
          </Link>
          <p className="text-[10px] text-white/30 font-bold text-center">
            Send <span className="text-sky-400/80">game.blackballs.site/guide</span> to your group chat
          </p>
        </div>
      </main>
    </div>
  );
}
