'use client';

import { FighterArt } from '@/components/fighter-art';

const LOGO_SRC = '/blackballs-neon-logo.png';

interface HowToPlayGuideProps {
  /** poster = fixed portrait layout for screenshots / sharing */
  variant?: 'inline' | 'poster';
  className?: string;
}

function SpeedLines() {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" preserveAspectRatio="none">
      {[...Array(24)].map((_, i) => (
        <line
          key={i}
          x1={`${(i * 17) % 100}%`}
          y1="0"
          x2={`${((i * 17) % 100) + 8}%`}
          y2="100%"
          stroke="#fff"
          strokeWidth={i % 3 === 0 ? 2 : 1}
        />
      ))}
    </svg>
  );
}

function MangaPanel({
  num,
  title,
  accent,
  children,
  className = '',
}: {
  num: string;
  title: string;
  accent: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative manga-panel ${className}`}
      style={{ ['--panel-accent' as string]: accent }}
    >
      <div className="manga-panel-head">
        <span className="manga-panel-num">{num}</span>
        <h3 className="manga-panel-title">{title}</h3>
      </div>
      <div className="manga-panel-body">{children}</div>
    </section>
  );
}

function FlowStep({ label, sub, color }: { label: string; sub: string; color: string }) {
  return (
    <div className="manga-flow-step" style={{ borderColor: color, boxShadow: `4px 4px 0 ${color}` }}>
      <div className="text-[11px] font-black tracking-wider" style={{ color }}>
        {label}
      </div>
      <div className="text-[8px] text-white/55 mt-1 leading-snug">{sub}</div>
    </div>
  );
}

export function HowToPlayGuide({ variant = 'inline', className = '' }: HowToPlayGuideProps) {
  const isPoster = variant === 'poster';

  return (
    <div
      className={`relative overflow-hidden font-mono text-white ${
        isPoster ? 'w-[min(100vw,420px)] mx-auto manga-poster' : ''
      } ${className}`}
    >
      <SpeedLines />
      <div className="manga-halftone absolute inset-0 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 text-center px-4 pt-5 pb-4 border-b-[3px] border-black bg-[#0a0c18]">
        <div className="inline-block manga-burst px-6 py-1 mb-3 text-[10px] font-black tracking-[0.35em] text-black bg-cp-yellow">
          HOW TO PLAY
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full border-[3px] border-black bg-black overflow-hidden shadow-[4px_4px_0_#00f0ff]">
            <img src={LOGO_SRC} alt="" className="w-full h-full object-cover" onError={e => {
              (e.target as HTMLImageElement).src = '/fallback-blackball-logo.svg';
            }} />
          </div>
          <div>
            <div className="text-2xl font-black text-cp-cyan manga-outline-text" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              $BlackBalls
            </div>
            <div className="text-[9px] tracking-[0.25em] text-white/50 mt-0.5">CYBERPUNK DEGEN ARENA</div>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/65 leading-relaxed max-w-[340px] mx-auto">
          Ride the live multiplier chart, stack leverage, and battle meme fighters — all on $BlackBalls.
        </p>
      </header>

      <div className={`relative z-10 space-y-3 ${isPoster ? 'p-3 pb-5' : 'p-2 sm:p-3'}`}>
        <MangaPanel num="01" title="THE CRASH" accent="#00f0ff">
          <p className="text-[10px] leading-relaxed text-white/75">
            Each round, a <span className="text-cp-cyan font-bold">live multiplier</span> climbs on the chart.
            Enter before or during the round — then close your position before the chart{' '}
            <span className="text-cp-magenta font-bold">CRASHES</span> to lock profit.
          </p>
          <div className="mt-2 manga-speech text-[9px] text-black font-bold bg-cp-yellow">
            Chart moves with round buy &amp; sell pressure!
          </div>
        </MangaPanel>

        <MangaPanel num="02" title="ROUND FLOW" accent="#9d00ff">
          <div className="flex items-stretch gap-1.5">
            <FlowStep label="WAITING" sub="Countdown · set your trade" color="#00f0ff" />
            <span className="text-cp-yellow font-black self-center text-lg">▶</span>
            <FlowStep label="RUNNING" sub="Multiplier climbs live" color="#00ff9c" />
            <span className="text-cp-yellow font-black self-center text-lg">▶</span>
            <FlowStep label="CRASHED" sub="Round ends · positions settle" color="#ff003c" />
          </div>
        </MangaPanel>

        <div className="grid grid-cols-2 gap-2">
          <MangaPanel num="03" title="BUY LONG" accent="#00ff9c" className="!mb-0">
            <p className="text-[9px] leading-relaxed text-white/70">
              <span className="text-cp-green font-black">BUY</span> opens a long or closes a short.
              You win when the multiplier rises above your entry.
            </p>
            <div className="mt-2 text-[20px] text-center">📈</div>
          </MangaPanel>
          <MangaPanel num="04" title="SELL SHORT" accent="#ff003c" className="!mb-0">
            <p className="text-[9px] leading-relaxed text-white/70">
              <span className="text-cp-magenta font-black">SELL</span> opens a short or closes a long.
              You win when the multiplier drops below your entry.
            </p>
            <div className="mt-2 text-[20px] text-center">📉</div>
          </MangaPanel>
        </div>

        <MangaPanel num="05" title="WAGER & LEVERAGE" accent="#fcee0a">
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div className="border-2 border-black bg-[#12182a] p-2 shadow-[3px_3px_0_#fcee0a]">
              <div className="font-black text-cp-yellow mb-1">WAGER</div>
              <div className="text-white/65">Risk $BlackBalls per trade. Use % shortcuts or type amount.</div>
            </div>
            <div className="border-2 border-black bg-[#12182a] p-2 shadow-[3px_3px_0_#ff003c]">
              <div className="font-black text-cp-magenta mb-1">LEVERAGE 1x–50x</div>
              <div className="text-white/65">Amplify gains <span className="text-cp-magenta">and</span> losses. Degen responsibly.</div>
            </div>
          </div>
        </MangaPanel>

        <MangaPanel num="06" title="ARENA FIGHTERS" accent="#e040ff">
          <div className="flex gap-2 items-center">
            <div className="flex -space-x-2 shrink-0">
              {(['pepe_prime', 'zog', 'bullx'] as const).map(id => (
                <div key={id} className="w-10 h-12 border-2 border-black bg-[#050714] overflow-hidden shadow-[2px_2px_0_#000]">
                  <FighterArt fighterId={id} fill className="w-full h-full" />
                </div>
              ))}
            </div>
            <p className="text-[9px] leading-relaxed text-white/70 flex-1">
              Pick from <span className="text-cp-purple font-bold">12 fighters</span>. Two weakest are free — stronger cards cost more $BlackBalls to unlock.
              Win battles for <span className="text-cp-yellow font-bold">XP</span>, fight coins, and rank up.
            </p>
          </div>
        </MangaPanel>

        <section className="manga-panel border-cp-cyan">
          <div className="manga-panel-head">
            <span className="manga-panel-num">★</span>
            <h3 className="manga-panel-title">QUICK START</h3>
          </div>
          <ol className="manga-steps text-[9px] space-y-1.5 text-white/75">
            <li><strong className="text-cp-cyan">1.</strong> Connect wallet</li>
            <li><strong className="text-cp-cyan">2.</strong> Set wager + leverage on CRASH</li>
            <li><strong className="text-cp-cyan">3.</strong> BUY long or SELL short — before or during the round</li>
            <li><strong className="text-cp-cyan">4.</strong> Close position before the crash</li>
            <li><strong className="text-cp-cyan">5.</strong> Hit ARENA — pick a fighter, battle, earn XP</li>
          </ol>
        </section>
      </div>

      <footer className="relative z-10 border-t-[3px] border-black bg-black px-4 py-3 text-center">
        <div className="text-[8px] tracking-[0.2em] text-white/40">PROVABLY FAIR · 4% HOUSE EDGE · DEGEN RESPONSIBLY</div>
        <div className="text-[10px] font-black text-cp-cyan mt-1 tracking-wider">game.blackballs.site</div>
      </footer>
    </div>
  );
}
