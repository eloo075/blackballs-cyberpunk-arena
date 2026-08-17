'use client';

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
      <div className="p-3 text-xs leading-relaxed text-white/70 font-bold space-y-2">{children}</div>
    </section>
  );
}

function InfoBox({ children, variant = 'amber' }: { children: React.ReactNode; variant?: 'amber' | 'cyan' | 'rose' | 'emerald' }) {
  const styles = {
    amber: 'bg-amber-400/10 border-amber-400/20 text-amber-200',
    cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200',
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-200',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
  };
  return <div className={`px-3 py-2 rounded-xl border text-[11px] leading-relaxed ${styles[variant]}`}>{children}</div>;
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
            <div className="text-2xl font-extrabold text-white">BlackBalls</div>
            <div className="text-[11px] text-white/45 mt-0.5 font-bold">Crash live · Flip coming soon</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-[360px] mx-auto font-bold">
          Crash Standard: a live candle chart that moves until it rugs. BUY in presale @ 1.00x or BUY live at the
          current price, stack entries, then SELL / cash out before the hard rug.
        </p>
      </header>

      <div className={`relative z-10 space-y-3 ${isPoster ? 'p-3 pb-5' : 'p-2 sm:p-3'}`}>
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-sky-500/5 border border-emerald-500/20 px-3 py-2 text-center">
          <span className="text-xs font-extrabold text-emerald-300 tracking-wide">
            📈 CRASH STANDARD — HOW TO PLAY
          </span>
        </div>

        {/* Round flow */}
        <GuideSection emoji="⏱️" title="Round Flow" accentClass="from-violet-500/15 to-transparent">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded-xl bg-[#1f2025] border border-cyan-500/20 p-2 text-center">
              <div className="font-extrabold text-cyan-400">Presale · ~12s</div>
              <div className="text-white/45 mt-1">Countdown. BUY locks @ 1.00x. Cancel anytime before start.</div>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-emerald-500/20 p-2 text-center">
              <div className="font-extrabold text-emerald-400">Live</div>
              <div className="text-white/45 mt-1">Chart runs. BUY more, SELL, or partial cash-out. Auto TP works.</div>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-rose-500/20 p-2 text-center">
              <div className="font-extrabold text-rose-400">Rug</div>
              <div className="text-white/45 mt-1">Hard rug to ~0.01x. Open longs lose remaining margin.</div>
            </div>
          </div>
          <InfoBox variant="amber">
            <strong>Standard = 1x long only.</strong> No shorts, no leverage on Crash Demo. Profit is simply how far
            price moves above <em>each</em> of your entry prices.
          </InfoBox>
        </GuideSection>

        {/* How to bet */}
        <GuideSection emoji="🎯" title="How to Play Crash" accentClass="from-cyan-500/15 to-transparent">
          <ol className="space-y-1.5 list-none">
            <li>
              <span className="text-cyan-400">1.</span> Connect wallet (demo credits or real vault).
            </li>
            <li>
              <span className="text-cyan-400">2.</span> Set your <span className="text-amber-300">Wager</span> in
              BlackBalls (presets or custom).
            </li>
            <li>
              <span className="text-cyan-400">3.</span> Optional: set <span className="text-amber-300">Auto TP</span>{' '}
              (e.g. 1.8x / 2.0x) so the server sells for you when hit.
            </li>
            <li>
              <span className="text-cyan-400">4.</span>{' '}
              <span className="text-emerald-400">BUY</span> in <strong>presale</strong> (guaranteed 1.00x) or{' '}
              <strong>live</strong> at the current candle price.
            </li>
            <li>
              <span className="text-cyan-400">5.</span> Stack more BUYs anytime while live — each fill keeps its own
              entry. A dashed entry line marks every buy on your chart.
            </li>
            <li>
              <span className="text-cyan-400">6.</span> Exit with <span className="text-rose-400">SELL</span> (full close)
              or <span className="text-emerald-300">CASH OUT</span> 25% / 50% / 75% / 100%. Holders of BlackBalls get{' '}
              <span className="text-amber-300">stimmy</span> on winning exits.
            </li>
          </ol>
          <InfoBox variant="cyan">
            Changed your mind in <strong>presale</strong>? Hit Cancel / SELL before the round starts — you get your
            stake back at 0 PnL. After the round is live, cancel is gone: you must cash out or ride the rug.
          </InfoBox>
        </GuideSection>

        {/* Presale vs live */}
        <GuideSection emoji="🛒" title="Presale vs Live Buy" accentClass="from-sky-500/15 to-transparent">
          <div className="grid grid-cols-1 gap-2 text-[11px]">
            <div className="rounded-xl bg-[#1f2025] border border-cyan-500/25 p-2.5">
              <div className="font-extrabold text-cyan-300">Presale BUY</div>
              <ul className="mt-1 space-y-1 text-white/55 list-none">
                <li>• During the ~12s countdown only</li>
                <li>• Fills at <span className="text-white">1.00x</span> when the round starts</li>
                <li>• One countdown entry per round — cancel before start to unlock stake</li>
              </ul>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-emerald-500/25 p-2.5">
              <div className="font-extrabold text-emerald-300">Live BUY</div>
              <ul className="mt-1 space-y-1 text-white/55 list-none">
                <li>• Anytime the candle chart is running</li>
                <li>• Fills at the <span className="text-white">live multiplier</span> you click</li>
                <li>• Stack as many buys as your balance allows</li>
              </ul>
            </div>
          </div>
          <InfoBox variant="emerald">
            Public activity shows an <strong>orange BlackBalls coin</strong> on buys and a <strong>bear</strong> on
            sells — pinned to the exact candle time of the trade.
          </InfoBox>
        </GuideSection>

        {/* PnL */}
        <GuideSection emoji="🟢" title="PnL — Stacked Entries" accentClass="from-emerald-500/15 to-transparent">
          <p>
            Crash Standard is <span className="text-emerald-400">1x long</span>. Each buy is its own lot. Your live PnL
            is the <strong>sum of every lot</strong> — not a fake average that hides a bad fill.
          </p>
          <div className="rounded-xl bg-[#1f2025] border border-emerald-500/20 p-2.5 text-[11px] font-mono text-white/80">
            Lot profit = amount × (exit ÷ entry − 1)
            <br />
            Total PnL = sum of all open lots
            <br />
            Max loss = remaining open stake (rugs to ~0.01x)
          </div>
          <p className="text-[11px] text-white/55">Example: two buys, exit @ 1.50x</p>
          <div className="grid grid-cols-1 gap-1.5 text-[10px]">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
              <div className="text-emerald-400 font-extrabold">10 BB @ 1.00x → exit 1.50x</div>
              <div className="text-white/60 mt-0.5">+5.000 profit</div>
            </div>
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
              <div className="text-rose-300 font-extrabold">10 BB @ 2.00x → exit 1.50x</div>
              <div className="text-white/60 mt-0.5">−2.500 loss on that lot</div>
            </div>
            <div className="rounded-lg bg-amber-400/10 border border-amber-400/20 p-2">
              <div className="text-amber-300 font-extrabold">Net = +2.500</div>
              <div className="text-white/55 mt-0.5">
                Avg-entry math would wrongly show 0 — Crash uses per-lot PnL instead
              </div>
            </div>
          </div>
        </GuideSection>

        {/* Exit */}
        <GuideSection emoji="💰" title="SELL & Cash-Out" accentClass="from-rose-500/15 to-transparent">
          <p>
            <span className="text-rose-400">SELL</span> closes your full live long at the current price.{' '}
            <span className="text-emerald-300">CASH OUT</span> lets you peel 25% / 50% / 75% / 100% and leave a runner.
          </p>
          <ul className="space-y-1 text-[11px] list-none">
            <li>
              <span className="text-sky-400">Auto TP</span> — set a target mult; server sells when price hits it
            </li>
            <li>
              <span className="text-emerald-400">Partial cash-out</span> — banks profit lot-by-lot (FIFO) and keeps the
              rest open
            </li>
            <li>
              <span className="text-rose-400">Hard rug</span> — anything still open settles as a full loss of remaining
              margin
            </li>
          </ul>
          <InfoBox variant="rose">
            Don&apos;t wait for the rug hoping for one more candle. If you&apos;re green, peel size. If you&apos;re still
            in when it dumps to 0.01x, that stake is gone.
          </InfoBox>
        </GuideSection>

        {/* Chart & markets */}
        <GuideSection emoji="📊" title="Chart, Markers & Markets" accentClass="from-amber-500/15 to-transparent">
          <ul className="space-y-1.5 text-[11px] list-none">
            <li>
              <span className="text-amber-300">Entry lines</span> — every buy (presale + live) draws a dashed line from
              that candle across the chart
            </li>
            <li>
              <span className="text-orange-300">Live feed markers</span> — orange coin = buy, bear = sell, with username
            </li>
            <li>
              <span className="text-sky-300">Markets</span> — live majors (HOOD, BTC, ETH, SOL…) beside the board
            </li>
            <li>
              <span className="text-violet-300">Last 100</span> — mini sparkline thumbs of recent rounds
            </li>
          </ul>
        </GuideSection>

        {/* Provably fair */}
        <GuideSection emoji="💥" title="The Rug & Provably Fair" accentClass="from-rose-500/15 to-transparent">
          <p>
            The whole candle path (including when it rugs) is <strong>pre-determined from the seed</strong> before the
            round starts. Buys and sells do <strong>not</strong> move the price — they only size your position.
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
              <div className="text-rose-400 font-extrabold">Escalating rug risk</div>
              <div className="text-white/50 mt-0.5">Hazard ramps the longer the round runs</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
              <div className="text-amber-300 font-extrabold">Hard cap ~2.25 min</div>
              <div className="text-white/50 mt-0.5">No infinite farms — late rounds get rugged</div>
            </div>
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2 col-span-2">
              <div className="text-violet-300 font-extrabold">Verify after every rug</div>
              <div className="text-white/50 mt-0.5">
                Seed hash is shown before play; seed reveals after — one-click Verify on the board
              </div>
            </div>
          </div>
        </GuideSection>

        {/* Hold bonuses */}
        <GuideSection emoji="💎" title="Hold Bonuses" accentClass="from-amber-500/15 to-transparent">
          <p className="text-[11px]">Hold BlackBalls in your wallet for a Crash payout boost:</p>
          <ul className="space-y-1 text-[11px] list-none">
            <li>
              <span className="text-amber-300">BlackBalls</span> — stimmy on Crash winning exits
            </li>
            <li>
              <span className="text-white/50">Crash Standard stays 1x</span> — stimmy boosts profit, it does not add
              leverage
            </li>
          </ul>
        </GuideSection>

        <GuideSection emoji="🏆" title="Weekly prizes" accentClass="from-amber-500/15 to-transparent">
          <p>
            Crash is play-money credits. Connecting a wallet creates a persistent account: credits, stats, and rank
            restore when you reconnect. Weekly standings are computed on the server from settled rounds only. Token
            prizes are reviewed and paid off-platform — nothing here withdraws or converts credits.
          </p>
          <ul className="space-y-1 text-[11px] list-none">
            <li>
              <span className="text-emerald-400">✓</span> Best 40 rounds per week count toward rank (volume grind does not win)
            </li>
            <li>
              <span className="text-emerald-400">✓</span> Daily credit refill if you are broke, once per 24h per wallet
            </li>
            <li>
              <span className="text-rose-400">✗</span> No vault, no deposits, no cashing out credits
            </li>
          </ul>
        </GuideSection>

        <GuideSection emoji="🚫" title="Common Rekt Moves" accentClass="from-orange-500/15 to-transparent">
          <ul className="space-y-1.5 text-[11px] list-none">
            <li>
              <span className="text-rose-400">✗</span> Buying live at a peak then praying — stack only if you have an exit plan
            </li>
            <li>
              <span className="text-rose-400">✗</span> Never cashing out / no Auto TP — the hard rug takes everything left
            </li>
            <li>
              <span className="text-rose-400">✗</span> Thinking cancels work after the round is live — only presale refunds
            </li>
            <li>
              <span className="text-rose-400">✗</span> Ignoring Verify after a rug — trust but verify
            </li>
            <li>
              <span className="text-emerald-400">✓</span> Crash: presale @ 1.00x, stack live buys, peel with cash-out / Auto TP
            </li>
          </ul>
        </GuideSection>

        <div className="rounded-2xl bg-gradient-to-r from-orange-500/10 via-transparent to-orange-500/5 border border-orange-500/20 px-3 py-2 text-center">
          <span className="text-xs font-extrabold text-orange-300 tracking-wide">🪙 BLACK FLIP — COMING SOON</span>
        </div>

        <GuideSection emoji="🪙" title="Black Flip" accentClass="from-orange-500/15 to-transparent">
          <p>
            Flip is a 50/50 coin match that will ship later. It is <strong>not playable</strong> at launch: you cannot
            enter a match or move balance through Flip. The tab is a teaser only.
          </p>
        </GuideSection>

        <section className="rounded-2xl bg-[#25262c] border border-white/5 overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-amber-500/15 to-transparent border-b border-white/5">
            <h3 className="text-sm font-extrabold text-white">Quick Start Checklist</h3>
          </div>
          <ol className="p-3 text-xs space-y-2 text-white/70 font-bold">
            <li>
              <span className="text-amber-300">1.</span> Connect wallet · free play-money credits
            </li>
            <li>
              <span className="text-amber-300">2.</span> Set wager + optional Auto TP
            </li>
            <li>
              <span className="text-amber-300">3.</span> Presale → BUY @ 1.00x (or wait and BUY live)
            </li>
            <li>
              <span className="text-amber-300">4.</span> Live → stack more buys · watch entry lines + coin/bear markers
            </li>
            <li>
              <span className="text-amber-300">5.</span> SELL / CASH OUT (25–100%) before the rug · or ride Auto TP
            </li>
            <li>
              <span className="text-amber-300">6.</span> After rug → Verify round · check Last 100 / markets
            </li>
          </ol>
        </section>
      </div>

      <footer className="relative z-10 border-t border-white/5 bg-[#25262c] px-4 py-3 text-center">
        <div className="text-[10px] text-white/40 font-bold">
          Provably fair · seed path · 1x Crash Standard · NFA · DYOR · touch grass occasionally
        </div>
        <div className="text-xs font-extrabold text-amber-300 mt-1">game.blackballs.site</div>
      </footer>
    </div>
  );
}
