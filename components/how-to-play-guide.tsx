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
            <div className="text-2xl font-extrabold text-white">$BlackBalls</div>
            <div className="text-[11px] text-white/45 mt-0.5 font-bold">Degen Arcade · Crash + Arena</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-[360px] mx-auto font-bold">
          Multiplier starts at 1.00x, climbs until it rugs. Go long if you want up, short if you want down. Set Auto TP
          or get rekt — the chart does not care about your feelings.
        </p>
      </header>

      <div className={`relative z-10 space-y-3 ${isPoster ? 'p-3 pb-5' : 'p-2 sm:p-3'}`}>
        {/* Round flow */}
        <GuideSection emoji="⏱️" title="Round Flow (read this first)" accentClass="from-violet-500/15 to-transparent">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="rounded-xl bg-[#1f2025] border border-cyan-500/20 p-2 text-center">
              <div className="font-extrabold text-cyan-400">Waiting · 10s</div>
              <div className="text-white/45 mt-1">Countdown. Only time you can open or cancel bets.</div>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-emerald-500/20 p-2 text-center">
              <div className="font-extrabold text-emerald-400">Running</div>
              <div className="text-white/45 mt-1">Multiplier climbs. Auto TP can cash you out.</div>
            </div>
            <div className="rounded-xl bg-[#1f2025] border border-rose-500/20 p-2 text-center">
              <div className="font-extrabold text-rose-400">Crashed · 5s</div>
              <div className="text-white/45 mt-1">RUGGED. All open positions settle.</div>
            </div>
          </div>
          <InfoBox variant="amber">
            <strong>Important:</strong> You cannot manually cash out during the live round. Use{' '}
            <span className="text-amber-100">Auto TP</span> before the round starts, or your position rides until crash /
            liquidation.
          </InfoBox>
        </GuideSection>

        {/* How to bet */}
        <GuideSection emoji="🎯" title="How to Place a Bet" accentClass="from-cyan-500/15 to-transparent">
          <ol className="space-y-1.5 list-none">
            <li>
              <span className="text-cyan-400">1.</span> Connect wallet (real vault or demo credits).
            </li>
            <li>
              <span className="text-cyan-400">2.</span> Set your <span className="text-amber-300">Wager</span> — how
              many $BlackBalls you put up as margin.
            </li>
            <li>
              <span className="text-cyan-400">3.</span> Pick <span className="text-amber-300">Leverage</span> (1x–50x).
              Higher = bigger wins <em>and</em> faster liquidation.
            </li>
            <li>
              <span className="text-cyan-400">4.</span> Optional: set <span className="text-amber-300">Auto TP</span>{' '}
              (e.g. 2.0x) to auto-cash out when the multiplier hits your target.
            </li>
            <li>
              <span className="text-cyan-400">5.</span> During the <span className="text-cyan-400">countdown only</span>
              , click <span className="text-emerald-400">BUY LONG</span> or <span className="text-rose-400">SELL SHORT</span>.
            </li>
            <li>
              <span className="text-cyan-400">6.</span> Round starts at <span className="text-white">1.00x</span> — your
              entry is always 1.00x for human players.
            </li>
          </ol>
          <InfoBox variant="cyan">
            Changed your mind before the round? Click the <strong>opposite</strong> button during countdown to cancel —
            you get your margin back at 0 profit / 0 loss.
          </InfoBox>
        </GuideSection>

        {/* Buy long */}
        <GuideSection emoji="🟢" title="BUY LONG — How Buyers Win" accentClass="from-emerald-500/15 to-transparent">
          <p>
            <span className="text-emerald-400">LONG</span> = you bet the multiplier goes <strong>UP</strong>. You profit
            when exit price is higher than your 1.00x entry.
          </p>
          <div className="rounded-xl bg-[#1f2025] border border-emerald-500/20 p-2.5 text-[11px] font-mono text-white/80">
            Profit = wager × leverage × (exit ÷ entry − 1)
            <br />
            Max loss = your full wager (margin)
          </div>
          <p className="text-[11px] text-white/55">Example: 1.0 $BlackBalls @ 2x leverage</p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
              <div className="text-emerald-400 font-extrabold">Exit @ 2.00x</div>
              <div className="text-white/60 mt-0.5">1 × 2 × (2−1) = +2.0 profit</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
              <div className="text-emerald-400 font-extrabold">Exit @ 1.50x</div>
              <div className="text-white/60 mt-0.5">1 × 2 × (1.5−1) = +1.0 profit</div>
            </div>
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 col-span-2">
              <div className="text-rose-400 font-extrabold">Rug @ 0.01x (still holding)</div>
              <div className="text-white/60 mt-0.5">Total loss — you lose your full 1.0 wager</div>
            </div>
          </div>
          <InfoBox variant="emerald">
            <strong>How to actually win as a buyer:</strong> Set Auto TP (e.g. 1.5x or 2x). If the chart hits your
            target during the run, you auto-cash out with profit. If you hold through the rug without Auto TP, you lose
            your margin.
          </InfoBox>
        </GuideSection>

        {/* Sell short */}
        <GuideSection emoji="🔴" title="SELL SHORT — How Sellers Win" accentClass="from-rose-500/15 to-transparent">
          <p>
            <span className="text-rose-400">SHORT</span> = you bet the multiplier goes <strong>DOWN</strong>. You profit
            when exit price is lower than your 1.00x entry.
          </p>
          <div className="rounded-xl bg-[#1f2025] border border-rose-500/20 p-2.5 text-[11px] font-mono text-white/80">
            Profit = wager × leverage × (1 − exit ÷ entry)
            <br />
            Max loss = your full wager (margin)
          </div>
          <p className="text-[11px] text-white/55">Example: 1.0 $BlackBalls @ 2x leverage</p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2">
              <div className="text-emerald-400 font-extrabold">Exit @ 0.50x</div>
              <div className="text-white/60 mt-0.5">1 × 2 × (1−0.5) = +1.0 profit</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 col-span-2">
              <div className="text-emerald-400 font-extrabold">Rug @ 0.01x (still holding short)</div>
              <div className="text-white/60 mt-0.5">1 × 2 × (1−0.01) ≈ +1.98 profit — shorts love rugs</div>
            </div>
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 col-span-2">
              <div className="text-rose-400 font-extrabold">Pump to 1.50x (still holding)</div>
              <div className="text-white/60 mt-0.5">1 × 2 × (1−1.5) = −1.0 (max loss)</div>
            </div>
          </div>
          <InfoBox variant="rose">
            <strong>Short strategy:</strong> Best on low / instant rugs. If the chart moons before crash, a short gets
            wrecked — especially with high leverage (liquidation hits sooner on the way up).
          </InfoBox>
        </GuideSection>

        {/* Leverage */}
        <GuideSection emoji="⚡" title="Leverage & Liquidation" accentClass="from-amber-500/15 to-transparent">
          <p>
            Leverage multiplies your exposure: <span className="text-amber-300">notional = wager × leverage</span>. Bigger
            leverage = bigger PnL swings.
          </p>
          <div className="rounded-xl bg-[#1f2025] border border-white/10 overflow-hidden text-[10px]">
            <div className="grid grid-cols-3 gap-px bg-white/5 font-extrabold text-white/50 text-center py-1.5">
              <div>Side</div>
              <div>Lev</div>
              <div>Liquidation @</div>
            </div>
            {[
              ['Long', '2x', '0.50x'],
              ['Long', '10x', '0.90x'],
              ['Short', '2x', '1.50x'],
              ['Short', '10x', '1.10x'],
            ].map(([side, lev, liq]) => (
              <div key={`${side}-${lev}`} className="grid grid-cols-3 gap-px bg-white/5 text-center py-1.5 text-white/65">
                <div className={side === 'Long' ? 'text-emerald-400' : 'text-rose-400'}>{side}</div>
                <div>{lev}</div>
                <div className="text-amber-300">{liq}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/50">
            At <span className="text-white/70">1x leverage</span> there is no mid-round liquidation — you only lose your
            full wager at crash (long) or win big (short on rug).
          </p>
        </GuideSection>

        {/* Auto TP */}
        <GuideSection emoji="🎚️" title="Auto Take-Profit (Auto TP)" accentClass="from-sky-500/15 to-transparent">
          <p>
            Set a target multiplier in the <span className="text-sky-400">Auto TP</span> field before the round (e.g.{' '}
            <span className="text-amber-300">2.0</span>).
          </p>
          <ul className="space-y-1 text-[11px] list-none">
            <li>
              <span className="text-emerald-400">Long:</span> auto-closes when multiplier ≥ entry × Auto TP (2.0 → cash
              out at 2.00x)
            </li>
            <li>
              <span className="text-rose-400">Short:</span> auto-closes when multiplier drops to your target on the way
              down
            </li>
          </ul>
          <InfoBox variant="cyan">
            This is your only way to take profit during a live round. No button mashing — set it and let the server do
            the work.
          </InfoBox>
        </GuideSection>

        {/* Crash & provably fair */}
        <GuideSection emoji="💥" title="The Rug & Provably Fair" accentClass="from-rose-500/15 to-transparent">
          <p>
            Every round&apos;s crash point is decided <strong>before</strong> the round starts using a committed server
            seed. The hash is shown before play; the seed is revealed after crash so you can verify the result.
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2">
              <div className="text-rose-400 font-extrabold">~5% instant rug</div>
              <div className="text-white/50 mt-0.5">Crashes at 1.00x</div>
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
              <div className="text-amber-300 font-extrabold">Most rounds</div>
              <div className="text-white/50 mt-0.5">1.01x – 9x range</div>
            </div>
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2 col-span-2">
              <div className="text-violet-300 font-extrabold">Rare moons</div>
              <div className="text-white/50 mt-0.5">Up to 25x max — don&apos;t bet the farm expecting these</div>
            </div>
          </div>
          <p className="text-[11px] text-white/45">
            Live buy/sell volume wiggles the chart visually but does <strong>not</strong> change the crash outcome — the
            path is pre-generated from the seed.
          </p>
        </GuideSection>

        {/* Hold bonuses */}
        <GuideSection emoji="💎" title="Hold Bonuses (Crash + Arena)" accentClass="from-amber-500/15 to-transparent">
          <p className="text-[11px]">Hold ecosystem tokens in your wallet for combat and payout boosts:</p>
          <ul className="space-y-1 text-[11px] list-none">
            <li>
              <span className="text-amber-300">$BlackBalls</span> — +30% stimmy (bigger crash payouts & arena damage/loot)
            </li>
            <li>
              <span className="text-cyan-400">ANSEM</span> — +20% stimmy
            </li>
            <li>
              <span className="text-fuchsia-300">CASHCAT</span> — +15% frenzy (bonus hit + crit chance in arena)
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
            <span className="text-amber-300">XP</span>, <span className="text-sky-400">$BlackBalls loot</span>, and{' '}
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
              <strong>$BlackBalls balance</strong> hits the threshold — stronger = pricier
            </li>
            <li>
              <span className="text-white/50">Formula:</span>{' '}
              <span className="font-mono text-[10px]">PWR³ × 25</span> (balance held, not spent)
            </li>
          </ul>
          <InfoBox variant="cyan">
            Unlocking is a balance gate — you keep your $BlackBalls. Hold more to access stronger fighters with higher
            base stats.
          </InfoBox>
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

        <GuideSection emoji="🎮" title="How a Battle Works" accentClass="from-sky-500/15 to-transparent">
          <ol className="space-y-1 list-none text-[11px]">
            <li><span className="text-sky-400">1.</span> Select an unlocked fighter from the roster</li>
            <li><span className="text-sky-400">2.</span> Optional: set an arena wager (0 / 10 / 25 / 50 / 100 BB)</li>
            <li><span className="text-sky-400">3.</span> Face a random opponent (level 1–3) or the daily boss</li>
            <li><span className="text-sky-400">4.</span> Turn-based combat — up to 10 rounds, 2.2s per round</li>
            <li><span className="text-sky-400">5.</span> First to 0 HP loses · timeout = higher HP wins</li>
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
          <p className="text-[11px] font-extrabold text-white/80 mt-2">$BlackBalls loot (win only):</p>
          <p className="text-[11px] text-white/55">
            Base 5–19 BB × stimmy hold bonus × streak × boss multiplier. Credited to your balance instantly.
          </p>
          <p className="text-[11px] font-extrabold text-white/80 mt-2">Arena wager (optional):</p>
          <p className="text-[11px] text-white/55">
            Put 10–100 BB on the line before a fight. <span className="text-emerald-400">Win → get 2× wager back</span>.
            Lose → wager is gone. Not available on boss fights.
          </p>
        </GuideSection>

        <GuideSection emoji="💀" title="Daily Boss & Challenges" accentClass="from-rose-500/15 to-transparent">
          <p className="text-[11px]">
            A <span className="text-rose-400">rotating daily boss</span> (Zog, Rug Reaper, Pingu, or BullX) appears at
            level 6 with <span className="text-amber-300">3× rewards</span>.
          </p>
          <ul className="space-y-1 text-[11px] list-none">
            <li><span className="text-emerald-400">1 free attempt</span> per day</li>
            <li><span className="text-amber-300">Retries:</span> 50 $BlackBalls each</li>
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
            <span className="text-amber-100">$BlackBalls airdrop</span> to their connected wallet. Higher rank = bigger
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
              <span className="text-rose-400">✗</span> Going long with no Auto TP and holding through the rug
            </li>
            <li>
              <span className="text-rose-400">✗</span> 10x long on instant rugs (liquidates at 0.90x)
            </li>
            <li>
              <span className="text-rose-400">✗</span> Shorting a moon round without understanding liquidation at 1.10x
              (10x short)
            </li>
            <li>
              <span className="text-rose-400">✗</span> Trying to click cash out mid-round — use Auto TP instead
            </li>
            <li>
              <span className="text-rose-400">✗</span> Fighting the boss with a level 1 free fighter and wondering why you got folded
            </li>
            <li>
              <span className="text-rose-400">✗</span> Ignoring daily challenges — free XP for the airdrop grind
            </li>
            <li>
              <span className="text-emerald-400">✓</span> Crash: wager + leverage + Auto TP during countdown
            </li>
            <li>
              <span className="text-emerald-400">✓</span> Arena: level fighters, chase upsets & streaks, stack XP before the 15-day snapshot
            </li>
          </ul>
        </GuideSection>

        {/* Quick start */}
        <section className="rounded-2xl bg-[#25262c] border border-white/5 overflow-hidden">
          <div className="px-3 py-2 bg-gradient-to-r from-amber-500/15 to-transparent border-b border-white/5">
            <h3 className="text-sm font-extrabold text-white">Quick Start Checklist</h3>
          </div>
          <ol className="p-3 text-xs space-y-2 text-white/70 font-bold">
            <li>
              <span className="text-amber-300">1.</span> Connect wallet · deposit or use demo
            </li>
            <li>
              <span className="text-amber-300">2.</span> Wager + leverage + Auto TP
            </li>
            <li>
              <span className="text-amber-300">3.</span> Countdown → BUY (long) or SELL (short) @ 1.00x
            </li>
            <li>
              <span className="text-amber-300">4.</span> Watch the chart — Auto TP cashes you out or you ride to rug
            </li>
            <li>
              <span className="text-amber-300">5.</span> Arena → pick fighter → battle → level up → stack XP
            </li>
            <li>
              <span className="text-amber-300">6.</span> Ranking tab → climb leaderboard → qualify for 15-day airdrop
            </li>
          </ol>
        </section>
      </div>

      <footer className="relative z-10 border-t border-white/5 bg-[#25262c] px-4 py-3 text-center">
        <div className="text-[10px] text-white/40 font-bold">Provably fair · 4% house edge · NFA · DYOR · touch grass occasionally</div>
        <div className="text-xs font-extrabold text-amber-300 mt-1">game.blackballs.site</div>
      </footer>
    </div>
  );
}
