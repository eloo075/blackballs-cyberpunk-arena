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
            <div className="text-[11px] text-white/45 mt-0.5 font-bold">Crash · Flip · Arena</div>
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
          <p className="text-[11px]">Hold BlackBalls in your wallet for payout / combat boosts:</p>
          <ul className="space-y-1 text-[11px] list-none">
            <li>
              <span className="text-amber-300">BlackBalls</span> — stimmy on Crash winning exits + Arena damage/loot
            </li>
            <li>
              <span className="text-white/50">Crash Standard stays 1x</span> — stimmy boosts profit, it does not add
              leverage
            </li>
          </ul>
        </GuideSection>

        {/* ── ARENA ── */}
        <div className="rounded-2xl bg-gradient-to-r from-fuchsia-500/10 via-transparent to-fuchsia-500/5 border border-fuchsia-500/20 px-3 py-2 text-center">
          <span className="text-xs font-extrabold text-fuchsia-300 tracking-wide">🥊 ARENA — FULL GUIDE</span>
        </div>

        <GuideSection emoji="⚔️" title="Arena Overview" accentClass="from-fuchsia-500/15 to-transparent">
          <p>
            Arena is a turn-based <span className="text-fuchsia-300">meme fighter battle</span> mode — separate from Crash.
            Pick a fighter, face a random opponent (or the daily boss), and brawl for{' '}
            <span className="text-amber-300">XP</span>, <span className="text-sky-400">BlackBalls loot</span>, and{' '}
            <span className="text-yellow-300">fight coins</span> to level your fighter up.
          </p>
          <div className="flex gap-2 items-center mt-1">
            <div className="flex -space-x-2 shrink-0">
              {(['pepe_prime', 'zog', 'bullx'] as const).map(id => (
                <div key={id} className="w-10 h-12 rounded-lg border border-white/10 bg-[#1f2025] overflow-hidden">
                  <FighterArt fighterId={id} fill className="w-full h-full" />
                </div>
              ))}
            </div>
            <p className="flex-1 text-[11px] text-white/55">
              12 fighters · ATK / HP / SPD / LCK stats · PWR = average of all four
            </p>
          </div>
        </GuideSection>

        <GuideSection emoji="🃏" title="Picking & Unlocking Fighters" accentClass="from-violet-500/15 to-transparent">
          <ul className="space-y-1.5 text-[11px] list-none">
            <li>
              <span className="text-emerald-400">Free:</span> 2 weakest fighters (Pepe Prime & Street Rat) — no cost
            </li>
            <li>
              <span className="text-amber-300">Locked fighters:</span> unlock when your{' '}
              <strong>BlackBalls balance</strong> hits the threshold — stronger = pricier
            </li>
            <li>
              <span className="text-white/50">Formula:</span>{' '}
              <span className="font-mono text-[10px]">PWR³ × 25</span> (balance held, not spent)
            </li>
          </ul>
          <InfoBox variant="cyan">
            Unlocking is a balance gate — you keep your BlackBalls. Hold more to access stronger fighters with higher
            base stats.
          </InfoBox>
        </GuideSection>

        <GuideSection emoji="📊" title="Stat Points & Equipment" accentClass="from-yellow-500/15 to-transparent">
          <p>Every <span className="text-amber-300">2 levels</span> you earn stat points to allocate into ATK / HP / SPD / LCK.</p>
          <ul className="space-y-1 text-[11px] list-none">
            <li><span className="text-rose-400">ATK</span> +2 per point · <span className="text-emerald-400">HP</span> +5 per point</li>
            <li><span className="text-cyan-400">SPD</span> +1 · <span className="text-amber-300">LCK</span> +1</li>
            <li><span className="text-violet-300">Equipment:</span> Weapon / Armor / Accessory slots — drops from wins or buy with fight coins</li>
          </ul>
        </GuideSection>

        <GuideSection emoji="📊" title="Fighter Leveling" accentClass="from-yellow-500/15 to-transparent">
          <p>Each fighter has their own level (max <span className="text-amber-300">25</span>) and fight coin bank.</p>
          <ul className="space-y-1 text-[11px] list-none">
            <li>
              <span className="text-yellow-300">+4% stats per level</span> above 1 (ATK, HP, SPD, LCK all scale)
            </li>
            <li>
              <span className="text-yellow-300">Fight coins</span> earned every battle — spend to level up
            </li>
            <li>
              Level-up cost: <span className="font-mono text-[10px]">floor(40 × level^1.45)</span> coins
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
              <div className="text-emerald-400 font-extrabold">Win coins</div>
              <div className="text-white/55 mt-0.5">Based on loot + opponent PWR</div>
            </div>
            <div className="rounded-lg bg-[#1f2025] border border-white/10 p-2">
              <div className="text-white/60 font-extrabold">Loss coins</div>
              <div className="text-white/45 mt-0.5">Small consolation — keep grinding</div>
            </div>
          </div>
        </GuideSection>

        <GuideSection emoji="🎮" title="How a Battle Works (Auto + Manual)" accentClass="from-sky-500/15 to-transparent">
          <ol className="space-y-1 list-none text-[11px]">
            <li><span className="text-sky-400">1.</span> Select an unlocked fighter · toggle <strong>Auto</strong> (default) or <strong>Manual</strong></li>
            <li><span className="text-sky-400">2.</span> Wager: presets or custom 0–500 BlackBalls</li>
            <li><span className="text-sky-400">3.</span> Challenge a leaderboard player for 15 BlackBalls (optional)</li>
            <li><span className="text-sky-400">4.</span> Manual mode: pick skills each turn — Heavy Strike, Defensive Stance, Quick Heal, Crit Boost, Stun, Life Steal</li>
            <li><span className="text-sky-400">5.</span> Fast rounds (~2.5–3s) · first to 0 HP loses</li>
          </ol>
          <div className="rounded-xl bg-[#1f2025] border border-white/10 p-2.5 text-[10px] space-y-1">
            <div><span className="text-emerald-400">Your dodge:</span> 12% chance opponent misses</div>
            <div><span className="text-rose-400">Enemy dodge:</span> 10% chance</div>
            <div><span className="text-amber-300">Your crit:</span> 20% (+ CASHCAT frenzy bonus)</div>
            <div><span className="text-white/50">Damage:</span> ATK × (0.8–1.2 random, ×1.5 on crit) × stimmy</div>
            <div><span className="text-fuchsia-300">Frenzy proc:</span> CASHCAT holders — 15% extra hit</div>
          </div>
        </GuideSection>

        <GuideSection emoji="🏆" title="Arena Rewards — XP, Loot & Wagers" accentClass="from-emerald-500/15 to-transparent">
          <p className="text-[11px] font-extrabold text-white/80">Player XP (climbs your rank):</p>
          <div className="rounded-xl bg-[#1f2025] border border-emerald-500/20 p-2 font-mono text-[10px] text-white/70">
            Win: 50 + floor(opponent PWR × 1.2)
            <br />
            Loss: 15 + floor(opponent PWR × 0.25)
          </div>
          <p className="text-[11px] text-white/55 mt-1">Win multipliers stack:</p>
          <ul className="space-y-1 text-[10px] list-none">
            <li><span className="text-violet-300">Upset</span> (you&apos;re 20+ PWR weaker): XP ×1.5</li>
            <li><span className="text-orange-300">3-win streak:</span> ×1.5 · <span className="text-orange-300">5-win:</span> ×2 · <span className="text-orange-300">10-win:</span> ×3</li>
            <li><span className="text-rose-400">Boss fight:</span> ×3 on XP, loot & coins</li>
          </ul>
          <p className="text-[11px] font-extrabold text-white/80 mt-2">BlackBalls loot (win only):</p>
          <p className="text-[11px] text-white/55">
            Base 5–19 BlackBalls × stimmy hold bonus × streak × boss multiplier. Credited to your balance instantly.
          </p>
          <p className="text-[11px] font-extrabold text-white/80 mt-2">Arena wager (optional):</p>
          <p className="text-[11px] text-white/55">
            Free-form 0–500 BlackBalls (presets for speed). <span className="text-emerald-400">Win → 2× wager back</span>. Lose → gone.
          </p>
        </GuideSection>

        <GuideSection emoji="⚔️" title="Challenge System" accentClass="from-amber-500/15 to-transparent">
          <p className="text-[11px]">
            Spend <span className="text-amber-300">15 BlackBalls</span> to challenge a specific player from the leaderboard.
            Higher PWR opponents = bigger bragging rights and XP.
          </p>
        </GuideSection>

        <GuideSection emoji="💀" title="Daily Boss & Challenges" accentClass="from-rose-500/15 to-transparent">
          <p className="text-[11px]">
            A <span className="text-rose-400">rotating daily boss</span> (Zog, Rug Reaper, Pingu, or BullX) appears at
            level 6 with <span className="text-amber-300">3× rewards</span>.
          </p>
          <ul className="space-y-1 text-[11px] list-none">
            <li><span className="text-emerald-400">1 free attempt</span> per day</li>
            <li><span className="text-amber-300">Retries:</span> 50 BlackBalls each</li>
          </ul>
          <p className="text-[11px] font-extrabold text-white/70 mt-2">Daily challenges (reset every day):</p>
          <div className="grid grid-cols-1 gap-1 text-[10px]">
            {[
              ['Win 2 arena fights', '200 XP'],
              ['Upset: beat +20 PWR foe', '350 XP'],
              ['Fight 3 battles', '100 XP'],
              ['Crash cashout 2x+', '150 XP'],
              ['Hit a 3-win streak', '250 XP'],
            ].map(([label, xp]) => (
              <div key={label} className="flex justify-between rounded-lg bg-[#1f2025] border border-white/5 px-2 py-1">
                <span className="text-white/60">{label}</span>
                <span className="text-amber-300 font-extrabold">{xp}</span>
              </div>
            ))}
          </div>
        </GuideSection>

        {/* Leaderboard & Airdrop */}
        <GuideSection emoji="🏅" title="Ranking, Leaderboard & Airdrops" accentClass="from-amber-500/15 to-transparent">
          <p className="text-[11px]">
            Your <span className="text-amber-300">Player XP</span> sets your rank title and leaderboard position. Grind
            Arena wins, daily challenges, and Crash activity to climb.
          </p>
          <div className="rounded-xl bg-[#1f2025] border border-white/10 overflow-hidden text-[10px]">
            <div className="grid grid-cols-2 gap-px bg-white/5 font-extrabold text-white/50 text-center py-1.5">
              <div>Rank Title</div>
              <div>XP Required</div>
            </div>
            {[
              ['NPC', '0'],
              ['DEGEN', '12,000'],
              ['APE', '24,000'],
              ['CHAD', '36,000'],
              ['WHALE', '48,000'],
              ['LEGEND', '60,000+'],
            ].map(([rank, xp]) => (
              <div key={rank} className="grid grid-cols-2 gap-px bg-white/5 text-center py-1.5">
                <div className="text-cyan-400 font-extrabold">{rank}</div>
                <div className="text-white/60">{xp}</div>
              </div>
            ))}
          </div>
          <InfoBox variant="amber">
            <strong>🪂 Bi-Weekly Leaderboard Airdrop (every 15 days):</strong> At the end of each 15-day season
            snapshot, the <strong>top-ranked players on the leaderboard</strong> by total XP receive a{' '}
            <span className="text-amber-100">BlackBalls airdrop</span> to their connected wallet. Higher rank = bigger
            drop. Play Arena, complete dailies, and stack XP before each snapshot to qualify.
          </InfoBox>
          <ul className="space-y-1 text-[10px] list-none text-white/50">
            <li>• Rankings tracked on the <span className="text-white/70">Ranking</span> tab</li>
            <li>• Snapshot locks XP at season end — no last-second cope</li>
            <li>• Airdrops sent to the wallet connected at snapshot time</li>
            <li>• Keep fighting — seasons reset, rankings refresh, rewards go again</li>
          </ul>
        </GuideSection>

        {/* Common mistakes */}
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
              <span className="text-rose-400">✗</span> Fighting the boss with a level 1 free fighter
            </li>
            <li>
              <span className="text-rose-400">✗</span> Ignoring daily challenges — free XP for the airdrop grind
            </li>
            <li>
              <span className="text-emerald-400">✓</span> Crash: presale @ 1.00x, stack live buys, peel with cash-out / Auto TP
            </li>
            <li>
              <span className="text-emerald-400">✓</span> Arena: level fighters, chase upsets & streaks, stack XP before the 15-day snapshot
            </li>
          </ul>
        </GuideSection>

        {/* ── BLACK FLIP ── */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-500/10 via-transparent to-orange-500/5 border border-orange-500/20 px-3 py-2 text-center">
          <span className="text-xs font-extrabold text-orange-300 tracking-wide">🪙 BLACK FLIP — 50/50 PvP</span>
        </div>

        <GuideSection emoji="🪙" title="Black Flip — How to Play" accentClass="from-orange-500/15 to-transparent">
          <p>
            Pure <span className="text-orange-400">50/50</span> coin flip PvP. Pick{' '}
            <span className="text-orange-300">HEADS</span> or <span className="text-amber-200">TAILS</span>, set your bet,
            and flip the official BlackBalls coin. Winner takes the pot minus rake.
          </p>
          <ol className="space-y-1 list-none text-[11px]">
            <li><span className="text-orange-400">1.</span> Connect wallet (real vault or demo)</li>
            <li><span className="text-orange-400">2.</span> Choose <strong>1v1 Instant</strong> or <strong>Dogpile Pot</strong></li>
            <li><span className="text-orange-400">3.</span> Pick HEADS or TAILS + wager (+ optional taunt)</li>
            <li><span className="text-orange-400">4.</span> Watch the coin flip — provably fair commit-reveal</li>
            <li><span className="text-orange-400">5.</span> Win → pot minus rake · Lose → wager gone</li>
          </ol>
        </GuideSection>

        <GuideSection emoji="💸" title="Flip Rake & BlackBalls Perks" accentClass="from-amber-500/15 to-transparent">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg bg-[#1f2025] border border-white/10 p-2">
              <div className="text-white/50 font-extrabold">Base rake</div>
              <div className="text-rose-300 font-extrabold">3%</div>
            </div>
            <div className="rounded-lg bg-amber-400/10 border border-amber-400/25 p-2">
              <div className="text-amber-200/70 font-extrabold">BlackBalls holder</div>
              <div className="text-amber-300 font-extrabold">1.5% rake · 500 BlackBalls max</div>
            </div>
          </div>
          <InfoBox variant="amber">
            Hold BlackBalls in your wallet — UI shows: &quot;You&apos;re paying only 1.5% rake because you hold
            BlackBalls.&quot; Rake is configurable server-side (can go to 0% for promos).
          </InfoBox>
        </GuideSection>

        <GuideSection emoji="⚔️" title="1v1 vs Dogpile" accentClass="from-violet-500/15 to-transparent">
          <p className="text-[11px] font-extrabold text-white/80">1v1 Instant:</p>
          <p className="text-[11px] text-white/55">
            Open a match or join an open opposite-side lobby at the same wager. Matched → flip → winner takes ~2× wager
            minus rake. Bot fills empty slots after ~6s so demo always feels live.
          </p>
          <p className="text-[11px] font-extrabold text-white/80 mt-2">Dogpile Pot:</p>
          <p className="text-[11px] text-white/55">
            Multiple players stack on HEADS or TAILS. Every ~30s the pot flips if both sides have bets. Winners split
            proportionally. One-sided pots refund when timer ends.
          </p>
        </GuideSection>

        <GuideSection emoji="🎯" title="Flip Tips & Social" accentClass="from-cyan-500/15 to-transparent">
          <ul className="space-y-1 text-[11px] list-none">
            <li><span className="text-emerald-400">✓</span> Drop a taunt when joining — shows in live feed</li>
            <li><span className="text-emerald-400">✓</span> Hit <strong>Revenge</strong> after a loss to re-challenge last opponent</li>
            <li><span className="text-emerald-400">✓</span> Win streaks show on the panel — ride the heater</li>
            <li><span className="text-emerald-400">✓</span> Big wins (50+ BlackBalls profit) hit Hall of Fame + chat highlight</li>
            <li><span className="text-rose-400">✗</span> Don&apos;t flip your entire stack on tilt — 50/50 is still 50/50</li>
          </ul>
          <InfoBox variant="cyan">
            Every flip is provably fair — server seed hash committed before the flip, seed revealed after. Verify via the
            same HMAC scheme as Crash.
          </InfoBox>
        </GuideSection>

        {/* Quick start */}
        <section className="rounded-2xl bg-[#25262c] border border-white/5 overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-amber-500/15 to-transparent border-b border-white/5">
            <h3 className="text-sm font-extrabold text-white">Quick Start Checklist</h3>
          </div>
          <ol className="p-3 text-xs space-y-2 text-white/70 font-bold">
            <li>
              <span className="text-amber-300">1.</span> Connect wallet · demo credits or deposit
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
            <li>
              <span className="text-amber-300">7.</span> Black Flip → 1v1 or Dogpile
            </li>
            <li>
              <span className="text-amber-300">8.</span> Arena → level · challenge · stack XP for the 15-day airdrop
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
