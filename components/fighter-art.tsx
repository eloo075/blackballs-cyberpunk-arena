'use client';

import { FIGHTERS } from '@/lib/fighters';
import { fighterVisualTier } from '@/lib/fighter-stats';

type Tier = 1 | 2 | 3 | 4 | 5;

interface NeonDefsProps {
  id: string;
  glow: string;
  tier: Tier;
}

function NeonDefs({ id, glow, tier }: NeonDefsProps) {
  return (
    <defs>
      <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={tier >= 4 ? 3.2 : 2.2} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <radialGradient id={`${id}-bg`} cx="50%" cy="32%" r="72%">
        <stop offset="0%" stopColor={glow} stopOpacity={0.22 + tier * 0.04} />
        <stop offset="45%" stopColor={glow} stopOpacity="0.08" />
        <stop offset="100%" stopColor="#020308" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.75" />
      </linearGradient>
      <linearGradient id={`${id}-armor`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={glow} stopOpacity="0.35" />
        <stop offset="100%" stopColor="#111" stopOpacity="0.9" />
      </linearGradient>
    </defs>
  );
}

interface ArtProps {
  size?: number;
  glowColor?: string;
  className?: string;
  fill?: boolean;
  tier?: Tier;
}

interface FighterArtProps extends ArtProps {
  fighterId: string;
}

function HudFrame({ glow, tier }: { glow: string; tier: Tier }) {
  const o = tier >= 3 ? 0.55 : 0.35;
  return (
    <g opacity={o}>
      <path d="M4 14 L4 4 L14 4" stroke={glow} strokeWidth="1.5" fill="none" />
      <path d="M116 14 L116 4 L106 4" stroke={glow} strokeWidth="1.5" fill="none" />
      <path d="M4 146 L4 156 L14 156" stroke={glow} strokeWidth="1.5" fill="none" />
      <path d="M116 146 L116 156 L106 156" stroke={glow} strokeWidth="1.5" fill="none" />
      {tier >= 4 && (
        <>
          <circle cx="60" cy="8" r="2" fill={glow} opacity="0.8" />
          <rect x="52" y="150" width="16" height="3" rx="1" fill={glow} opacity="0.5" />
        </>
      )}
    </g>
  );
}

function PowerAura({ glow, tier }: { glow: string; tier: Tier }) {
  if (tier < 3) return null;
  return (
    <g opacity={tier >= 5 ? 0.45 : 0.28}>
      <ellipse cx="60" cy="88" rx={28 + tier * 2} ry={36 + tier * 2} stroke={glow} strokeWidth="1" fill="none" />
      {tier >= 4 && (
        <ellipse cx="60" cy="88" rx="38" ry="48" stroke={glow} strokeWidth="0.6" fill="none" strokeDasharray="4 6" />
      )}
      {tier >= 5 && (
        <>
          <circle cx="60" cy="88" r="44" stroke={glow} strokeWidth="0.5" fill="none" opacity="0.6" />
          {[0, 60, 120, 180, 240, 300].map(deg => {
            const r = (deg * Math.PI) / 180;
            const x = 60 + Math.cos(r) * 40;
            const y = 88 + Math.sin(r) * 40;
            return <circle key={deg} cx={x} cy={y} r="1.5" fill={glow} />;
          })}
        </>
      )}
    </g>
  );
}

function LeatherJacket({ glow }: { glow: string }) {
  return (
    <g opacity="0.85">
      <path d="M38 108 L44 132 L76 132 L82 108" fill="#0a0a0c" stroke={glow} strokeWidth="1.6" />
      <path d="M44 112 L48 128 M76 112 L72 128" stroke={glow} strokeWidth="0.8" opacity="0.4" />
      <path d="M52 108 L60 118 L68 108" fill="none" stroke={glow} strokeWidth="1" opacity="0.5" />
      <circle cx="60" cy="122" r="2" fill={glow} opacity="0.6" />
    </g>
  );
}

function Pauldrons({ glow, tier }: { glow: string; tier: Tier }) {
  if (tier < 3) return null;
  return (
    <g>
      <path d="M28 78 L22 98 L34 102 L38 82 Z" fill="#141414" stroke={glow} strokeWidth="1.4" />
      <path d="M92 78 L98 98 L86 102 L82 82 Z" fill="#141414" stroke={glow} strokeWidth="1.4" />
      {tier >= 4 && (
        <>
          <path d="M24 88 L18 92" stroke={glow} strokeWidth="1.2" />
          <path d="M96 88 L102 92" stroke={glow} strokeWidth="1.2" />
        </>
      )}
    </g>
  );
}

function Frame({
  id,
  glow,
  tier,
  children,
  size,
  fill,
  className = '',
}: {
  id: string;
  glow: string;
  tier: Tier;
  children: React.ReactNode;
  size: number;
  fill?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={fill ? '100%' : size}
      height={fill ? '100%' : size}
      viewBox="0 0 120 160"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <NeonDefs id={id} glow={glow} tier={tier} />
      <rect width="120" height="160" fill="#030508" />
      <rect width="120" height="160" fill={`url(#${id}-bg)`} />
      {/* grid */}
      {[20, 40, 60, 80, 100, 120, 140].map(y => (
        <line key={`h${y}`} x1="0" y1={y} x2="120" y2={y} stroke={glow} strokeOpacity="0.035" strokeWidth="0.5" />
      ))}
      {[30, 60, 90].map(x => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="160" stroke={glow} strokeOpacity="0.025" strokeWidth="0.5" />
      ))}
      <PowerAura glow={glow} tier={tier} />
      <HudFrame glow={glow} tier={tier} />
      <rect width="120" height="160" fill={`url(#${id}-floor)`} />
      {children}
      {tier >= 2 && (
        <text x="60" y="152" textAnchor="middle" fill={glow} fontSize="6" opacity="0.35" fontFamily="monospace">
          {'T'.concat(String(tier), ' // PWR TIER')}
        </text>
      )}
    </svg>
  );
}

export function FighterArt({ fighterId, size = 120, glowColor = '#00f0ff', className = '', fill }: FighterArtProps) {
  const fighter = FIGHTERS.find(f => f.id === fighterId);
  const tier = fighterVisualTier(fighter?.power ?? 50);
  const glow = fighter?.glowColor ?? glowColor;

  const map: Record<string, (p: ArtProps) => React.ReactElement> = {
    pepe_prime: PepePrimeArt,
    street_rat: StreetRatArt,
    dogelord: DogelordArt,
    mewtrix: MewtrixArt,
    based_frog: BasedFrogArt,
    giga_chad: GigaChadArt,
    wojak: WojakArt,
    bullx: BullxArt,
    diamond_degen: DiamondDegenArt,
    pingu: PinguArt,
    rug_reaper: RugReaperArt,
    zog: ZogArt,
  };
  const Comp = map[fighterId] ?? PepePrimeArt;
  const props = { size, glowColor: glow, className, fill, tier };
  if (fill) return <Comp {...props} />;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: size, height: size }}>
      <Comp {...props} fill className="absolute inset-0 w-full h-full" />
    </div>
  );
}

function PepePrimeArt({ size = 120, glowColor = '#00ff66', className, fill, tier = 1 }: ArtProps) {
  const id = 'pepe';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="124" rx="36" ry="9" fill={g} opacity="0.15" />
        <path d="M32 56 Q60 34 88 56 L90 104 Q60 126 30 104 Z" fill="#081810" stroke={g} strokeWidth="2.2" />
        <path d="M38 62 Q60 52 82 62" fill="none" stroke={g} strokeWidth="0.8" opacity="0.35" />
        <ellipse cx="46" cy="74" rx="11" ry="12" fill="#061410" stroke={g} strokeWidth="2" />
        <ellipse cx="74" cy="74" rx="11" ry="12" fill="#061410" stroke={g} strokeWidth="2" />
        <circle cx="46" cy="74" r="4" fill={g} opacity="0.5" />
        <circle cx="74" cy="74" r="4" fill={g} opacity="0.5" />
        <rect x="36" y="68" width="24" height="7" rx="2" fill="#0a0a0a" stroke={g} strokeWidth="1.4" />
        <rect x="60" y="68" width="24" height="7" rx="2" fill="#0a0a0a" stroke={g} strokeWidth="1.4" />
        <path d="M40 98 Q60 112 80 98" fill="none" stroke={g} strokeWidth="2" strokeLinecap="round" />
        <LeatherJacket glow={g} />
      </g>
    </Frame>
  );
}

function StreetRatArt({ size = 120, glowColor = '#c0c0c0', className, fill, tier = 1 }: ArtProps) {
  const id = 'rat';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="90" rx="30" ry="26" fill="#121212" stroke={g} strokeWidth="2.2" />
        <path d="M32 58 L24 32 L40 50 M88 58 L96 32 L80 50" stroke={g} strokeWidth="2" strokeLinecap="round" />
        <circle cx="47" cy="84" r="5" fill={g} /><circle cx="47" cy="84" r="2" fill="#000" />
        <circle cx="73" cy="84" r="5" fill={g} /><circle cx="73" cy="84" r="2" fill="#000" />
        <path d="M54 100 L60 106 L66 100" stroke={g} strokeWidth="1.6" fill="none" />
        <path d="M42 108 L78 108 L74 130 L46 130 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.5" />
        <path d="M48 114 L72 114" stroke={g} strokeWidth="0.8" opacity="0.4" />
      </g>
    </Frame>
  );
}

function DogelordArt({ size = 120, glowColor = '#00a8ff', className, fill, tier = 2 }: ArtProps) {
  const id = 'doge';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="88" rx="32" ry="28" fill="#1a1208" stroke={g} strokeWidth="2.2" />
        <path d="M34 48 L28 28 L50 42 Z M86 48 L92 28 L70 42 Z" fill="#1a1208" stroke={g} strokeWidth="2" />
        <rect x="34" y="68" width="52" height="14" rx="4" fill="#040810" stroke={g} strokeWidth="2" />
        <rect x="38" y="71" width="16" height="8" rx="1" fill={g} opacity="0.9" />
        <rect x="66" y="71" width="16" height="8" rx="1" fill={g} opacity="0.9" />
        <path d="M38 82 L82 82" stroke={g} strokeWidth="0.6" opacity="0.5" />
        <ellipse cx="48" cy="94" rx="6" ry="7" fill="#1a1208" stroke={g} strokeWidth="1.4" />
        <ellipse cx="72" cy="94" rx="6" ry="7" fill="#1a1208" stroke={g} strokeWidth="1.4" />
        <LeatherJacket glow={g} />
        <Pauldrons glow={g} tier={tier} />
      </g>
    </Frame>
  );
}

function MewtrixArt({ size = 120, glowColor = '#b026ff', className, fill, tier = 2 }: ArtProps) {
  const id = 'mew';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <path d="M36 48 L28 24 L54 42 Z M84 48 L92 24 L66 42 Z" fill="#100818" stroke={g} strokeWidth="2.2" />
        <ellipse cx="60" cy="86" rx="30" ry="26" fill="#100818" stroke={g} strokeWidth="2.2" />
        <path d="M34 72 L86 72 L82 84 L38 84 Z" fill="#060010" stroke={g} strokeWidth="1.8" />
        <rect x="40" y="74" width="12" height="6" fill={g} opacity="0.95" />
        <rect x="68" y="74" width="12" height="6" fill={g} opacity="0.95" />
        <path d="M52 96 L60 104 L68 96" stroke={g} strokeWidth="1.6" fill="none" />
        <path d="M44 72 L76 72" stroke={g} strokeWidth="0.5" opacity="0.4" />
        <LeatherJacket glow={g} />
        <Pauldrons glow={g} tier={tier} />
      </g>
    </Frame>
  );
}

function BasedFrogArt({ size = 120, glowColor = '#ffd700', className, fill, tier = 2 }: ArtProps) {
  const id = 'bfrog';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <rect x="38" y="46" width="44" height="32" rx="8" fill={`url(#${id}-armor)`} stroke={g} strokeWidth="2.4" />
        <path d="M32 76 L24 108 L38 114 Z M88 76 L96 108 L82 114 Z" fill="#2a2008" stroke={g} strokeWidth="2" />
        <ellipse cx="60" cy="86" rx="28" ry="24" fill="#1a1606" stroke={g} strokeWidth="2" />
        <circle cx="50" cy="78" r="5" fill={g} /><circle cx="70" cy="78" r="5" fill={g} />
        <path d="M42 52 L78 52 M44 58 L76 58 M46 64 L74 64" stroke={g} strokeWidth="0.6" opacity="0.45" />
        <path d="M46 98 L74 98 L70 122 L50 122 Z" fill="#141006" stroke={g} strokeWidth="1.8" />
        <Pauldrons glow={g} tier={Math.max(tier, 3) as Tier} />
      </g>
    </Frame>
  );
}

function GigaChadArt({ size = 120, glowColor = '#ffaa00', className, fill, tier = 3 }: ArtProps) {
  const id = 'chad';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <path d="M36 44 Q60 32 84 44 L88 70 L82 110 Q60 122 38 110 L32 70 Z" fill="#141010" stroke={g} strokeWidth="2.4" />
        <path d="M38 68 L50 92 L70 92 L82 68" fill="none" stroke={g} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M44 56 Q60 62 76 56" fill="none" stroke={g} strokeWidth="2" />
        <path d="M50 98 Q60 104 70 98" fill="none" stroke={g} strokeWidth="1.6" />
        <path d="M42 108 L78 108 L74 130 L46 130 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.6" />
        <Pauldrons glow={g} tier={tier} />
        <line x1="88" y1="60" x2="104" y2="48" stroke={g} strokeWidth="1.5" opacity="0.6" />
      </g>
    </Frame>
  );
}

function WojakArt({ size = 120, glowColor = '#ff4da6', className, fill, tier = 3 }: ArtProps) {
  const id = 'wojak';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="86" rx="28" ry="30" fill="#141018" stroke={g} strokeWidth="2.2" />
        <path d="M34 54 Q60 42 86 54 L84 66 Q60 58 36 66 Z" fill="#0a0810" stroke={g} strokeWidth="1.8" />
        <path d="M36 62 L84 62" stroke={g} strokeWidth="2" opacity="0.7" />
        <ellipse cx="48" cy="80" rx="6" ry="7" fill="#141018" stroke={g} strokeWidth="1.4" />
        <ellipse cx="72" cy="80" rx="6" ry="7" fill="#141018" stroke={g} strokeWidth="1.4" />
        <path d="M52 98 Q60 106 68 98" stroke={g} strokeWidth="1.6" fill="none" />
        <LeatherJacket glow={g} />
        <Pauldrons glow={g} tier={tier} />
      </g>
    </Frame>
  );
}

function BullxArt({ size = 120, glowColor = '#ff4400', className, fill, tier = 3 }: ArtProps) {
  const id = 'bull';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <path d="M30 62 Q24 38 36 28 Q40 44 38 56" fill={g} stroke={g} strokeWidth="1.8" />
        <path d="M90 62 Q96 38 84 28 Q80 44 82 56" fill={g} stroke={g} strokeWidth="1.8" />
        <ellipse cx="60" cy="86" rx="32" ry="28" fill="#180606" stroke={g} strokeWidth="2.4" />
        <circle cx="47" cy="78" r="6" fill="#ff2200" filter={`url(#${id}-soft)`} />
        <circle cx="73" cy="78" r="6" fill="#ff2200" filter={`url(#${id}-soft)`} />
        <ellipse cx="60" cy="96" rx="14" ry="9" fill="#100404" stroke={g} strokeWidth="1.6" />
        <path d="M40 108 L80 108 L76 130 L44 130 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.6" />
        <Pauldrons glow={g} tier={Math.max(tier, 4) as Tier} />
        <path d="M16 70 L28 82" stroke={g} strokeWidth="2" opacity="0.5" />
      </g>
    </Frame>
  );
}

function DiamondDegenArt({ size = 120, glowColor = '#00ffff', className, fill, tier = 4 }: ArtProps) {
  const id = 'diamond';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <path d="M60 36 L88 68 L60 124 L32 68 Z" fill="#041018" stroke={g} strokeWidth="2.6" />
        <path d="M60 36 L60 124 M32 68 L88 68 M44 52 L76 84 M76 52 L44 84" stroke={g} strokeWidth="0.7" opacity="0.45" />
        <path d="M48 56 L72 56 L60 76 Z" fill={g} opacity="0.3" />
        <circle cx="60" cy="68" r="8" fill={g} opacity="0.55" filter={`url(#${id}-soft)`} />
        <path d="M42 108 L78 108 L74 130 L46 130 Z" fill="#061018" stroke={g} strokeWidth="1.6" />
        <Pauldrons glow={g} tier={tier} />
      </g>
    </Frame>
  );
}

function PinguArt({ size = 120, glowColor = '#00e5ff', className, fill, tier = 4 }: ArtProps) {
  const id = 'pingu';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="90" rx="30" ry="32" fill="#0a1018" stroke={g} strokeWidth="2.4" />
        <ellipse cx="60" cy="98" rx="18" ry="20" fill="#eef6ff" opacity="0.95" />
        <rect x="34" y="64" width="52" height="14" rx="5" fill="#030810" stroke={g} strokeWidth="2" />
        <rect x="40" y="67" width="14" height="8" rx="1" fill={g} opacity="0.95" />
        <rect x="66" y="67" width="14" height="8" rx="1" fill={g} opacity="0.95" />
        <path d="M52 48 Q60 38 68 48 L66 56 L54 56 Z" fill="#ff8800" stroke={g} strokeWidth="1.2" />
        <LeatherJacket glow={g} />
        <Pauldrons glow={g} tier={tier} />
        <line x1="100" y1="72" x2="112" y2="64" stroke={g} strokeWidth="1.2" opacity="0.5" />
      </g>
    </Frame>
  );
}

function RugReaperArt({ size = 120, glowColor = '#aa00ff', className, fill, tier = 4 }: ArtProps) {
  const id = 'reaper';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <path d="M32 48 Q60 38 88 48 L84 110 Q60 120 36 110 Z" fill="#0a0810" stroke={g} strokeWidth="2.4" />
        <ellipse cx="46" cy="74" rx="8" ry="9" fill="#020204" stroke={g} strokeWidth="1.2" />
        <ellipse cx="74" cy="74" rx="8" ry="9" fill="#020204" stroke={g} strokeWidth="1.2" />
        <circle cx="46" cy="74" r="3.5" fill="#ff003c" filter={`url(#${id}-soft)`} />
        <circle cx="74" cy="74" r="3.5" fill="#ff003c" filter={`url(#${id}-soft)`} />
        <line x1="92" y1="28" x2="40" y2="124" stroke={g} strokeWidth="2.5" />
        <path d="M92 28 Q106 22 104 42 Q96 32 92 30" fill="#0a0810" stroke={g} strokeWidth="2" />
        <path d="M104 38 Q112 34 110 48" fill={g} opacity="0.25" />
        <Pauldrons glow={g} tier={tier} />
      </g>
    </Frame>
  );
}

function ZogArt({ size = 120, glowColor = '#e040ff', className, fill, tier = 5 }: ArtProps) {
  const id = 'zog';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className}>
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="84" rx="32" ry="34" fill="#100818" stroke={g} strokeWidth="2.6" />
        <ellipse cx="44" cy="76" rx="12" ry="16" fill="#080410" stroke={g} strokeWidth="2" />
        <ellipse cx="76" cy="76" rx="12" ry="16" fill="#080410" stroke={g} strokeWidth="2" />
        <ellipse cx="44" cy="76" rx="6" ry="10" fill="#1a0020" />
        <ellipse cx="76" cy="76" rx="6" ry="10" fill="#1a0020" />
        <circle cx="44" cy="73" r="2.5" fill={g} filter={`url(#${id}-soft)`} />
        <circle cx="76" cy="73" r="2.5" fill={g} filter={`url(#${id}-soft)`} />
        <path d="M50 100 Q60 108 70 100" stroke={g} strokeWidth="1.6" fill="none" />
        <path d="M40 108 L80 108 L76 130 L44 130 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.8" />
        <Pauldrons glow={g} tier={5} />
        <path d="M60 34 L60 44 M48 38 L72 38" stroke={g} strokeWidth="1" opacity="0.5" />
        <circle cx="60" cy="30" r="3" fill={g} opacity="0.7" />
      </g>
    </Frame>
  );
}
