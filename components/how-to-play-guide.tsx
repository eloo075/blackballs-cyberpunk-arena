'use client';

import { FighterArt } from '@/components/fighter-art';

const LOGO_SRC = '/blackballs-logo-transparent.png';

interface HowToPlayGuideProps {
  /** poster = fixed portrait layout for screenshots / sharing */
  variant?: 'inline' | 'poster';
  className?: string;
}

function GuideSection({
  emoji,
  title,
  accentClass,
  children,
}: {
  emoji: string;
  title: string;
  accentClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-[#25262c] border border-white/5 overflow-hidden">
      <div className={`px-3 py-2 bg-gradient-to-r ${accentClass} border-b border-white/5 flex items-center gap-2`}>
        <span className="text-base">{emoji}</span>
        <h3 className="text-sm font-extrabold text-white">{title}</h3>
      </div>
      <div className="p-3 text-xs leading-relaxed text-white/70 font-bold">{children}</div>
    </section>
  );
}

export function HowToPlayGuide({ variant = 'inline', className = '' }: HowToPlayGuideProps) {
  const isPoster = variant === 'poster';

  return (
    <div
      className={`relative overflow-hidden font-arcade text-white bg-[#1f2025] ${
        isPoster ? 'w-[min(100vw,420px)] mx-auto rounded-2xl border border-white/5' : ''
      } ${className}`}
    >
      <header className="relative z-10 text-center px-4 pt-5 pb-4 border-b border-white/5 bg-gradient-to-b from-amber-500/10 to-transparent">
        <div className="inline-block px-4 py-1 mb-3 text-[11px] font-extrabold tracking-wide text-black bg-amber-400 rounded-full">
          How to Play (for degens)
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 flex items-center justify-center">
            <img
              src={LOGO_SRC}
              alt=""
              className="w-full h-full object-contain drop-shadow-md"
              onError={e => {
                (e.target as HTMLImageElement).src = '/fallback-blackball-logo.svg';
              }}
            />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">$BlackBalls</div>
            <div className="text-[11px] text-white/45 mt-0.5 font-bold">Degen Arcade · Crash + Arena</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-[340px] mx-auto font-bold">
          Chart goes up. You get brave. Chart rugs. You cope. Repeat until rich or rekt — your call.
        </p>
      </header>

      <div className={`relative z-10 space-y-3 ${isPoster ? 'p-3 pb-5' : 'p-2 sm:p-3'}`}>
        <GuideSection emoji="📈" title="The Crash" accentClass="from-cyan-500/15 to-transparent">
          <p>
            Every round a <span className="text-cyan-400">multiplier</span> climbs on the chart like it&apos;s late for
            a bull run. You only enter during the <span className="text-amber-300">countdown</span> — hit{' '}
            <span className="text-emerald-400">BUY LONG</span> or <span className="text-rose-400">SELL SHORT</span>, then
            pray until the chart <span className="text-rose-400">crashes</span> and settles your fate.
          </p>
          <p className="mt-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-200">
            Pro tip: more degens buying = chart pumps harder. It&apos;s vibes + math. Mostly vibes.
          </p>
        </GuideSection>

        <GuideSection emoji="⏱️" title="Round Flow" accentClass="from-violet-500/15 to-transparent">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded-xl bg-[#1f2025] border border-cyan-500/20 p-2 text-center">
              <div className="font-extrabold text-cyan-400">Waiting</div>
              <div className="text-white/45 mt-1">Countdown · place bets</div>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-emerald-500/20 p-2 text-center">
              <div className="font-extrabold text-emerald-400">Running</div>
              <div className="text-white/45 mt-1">Multiplier climbs</div>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-rose-500/20 p-2 text-center">
              <div className="font-extrabold text-rose-400">Crashed</div>
              <div className="text-white/45 mt-1">Rugged · payouts</div>
            </div>
          </div>
        </GuideSection>

        <div className="grid grid-cols-2 gap-2">
          <GuideSection emoji="🟢" title="Buy Long" accentClass="from-emerald-500/15 to-transparent">
            <p>
              <span className="text-emerald-400">BUY</span> = you want number go up. Close a short or open a long. If
              the multiplier pumps past your entry, you eat. If it rugs first, welcome to the club.
            </p>
          </GuideSection>
          <GuideSection emoji="🔴" title="Sell Short" accentClass="from-rose-500/15 to-transparent">
            <p>
              <span className="text-rose-400">SELL</span> = you think it&apos;s going down. Close a long or open a
              short. Bear market enjoyer behavior, but legal here.
            </p>
          </GuideSection>
        </div>

        <GuideSection emoji="💰" title="Wager & Leverage" accentClass="from-amber-500/15 to-transparent">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-xl bg-[#1f2025] border border-amber-400/20 p-2">
              <div className="font-extrabold text-amber-300 mb-1">Wager</div>
              <div className="text-white/55">How many $BlackBalls you&apos;re willing to pretend you can afford to lose.</div>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-rose-500/20 p-2">
              <div className="font-extrabold text-rose-300 mb-1">Leverage 1x–50x</div>
              <div className="text-white/55">Turn a small win into a yacht or a small loss into a personality trait.</div>
            </div>
          </div>
        </GuideSection>

        <GuideSection emoji="🥊" title="Arena Fighters" accentClass="from-fuchsia-500/15 to-transparent">
          <div className="flex gap-2 items-center">
            <div className="flex -space-x-2 shrink-0">
              {(['pepe_prime', 'zog', 'bullx'] as const).map(id => (
                <div key={id} className="w-10 h-12 rounded-lg border border-white/10 bg-[#1f2025] overflow-hidden">
                  <FighterArt fighterId={id} fill className="w-full h-full" />
                </div>
              ))}
            </div>
            <p className="flex-1 text-[11px]">
              Pick from <span className="text-fuchsia-300">12 meme fighters</span>. Two weakest are free — the rest
              cost $BlackBalls because power has a price tag. Win battles →{' '}
              <span className="text-amber-300">XP</span>, coins, and bragging rights.
            </p>
          </div>
        </GuideSection>

        <section className="rounded-2xl bg-[#25262c] border border-white/5 overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-amber-500/15 to-transparent border-b border-white/5">
            <h3 className="text-sm font-extrabold text-white">Quick Start (60 seconds)</h3>
          </div>
          <ol className="p-3 text-xs space-y-2 text-white/70 font-bold">
            <li><span className="text-amber-300">1.</span> Connect wallet (or demo — we don&apos;t judge)</li>
            <li><span className="text-amber-300">2.</span> Set wager + leverage on Crash</li>
            <li><span className="text-amber-300">3.</span> During countdown only — BUY or SELL @ 1.00x</li>
            <li><span className="text-amber-300">4.</span> Round goes live — hold on and watch the multiplier</li>
            <li><span className="text-amber-300">5.</span> Hit Arena — pick a fighter, throw hands, stack XP</li>
          </ol>
        </section>
      </div>

      <footer className="relative z-10 border-t border-white/5 bg-[#25262c] px-4 py-3 text-center">
        <div className="text-[10px] text-white/40 font-bold">Provably fair · 4% house edge · touch grass occasionally</div>
        <div className="text-xs font-extrabold text-amber-300 mt-1">game.blackballs.site</div>
      </footer>
    </div>
  );
}
