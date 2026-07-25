'use client';

import { FIGHTERS } from '@/lib/fighters';
import { fighterVisualTier } from '@/lib/fighter-stats';

type Tier = 1 | 2 | 3 | 4 | 5;

interface NeonDefsProps {
  id: string;
  glow: string;
  tier: Tier;
  skin?: string;
  accent?: string;
}

function NeonDefs({ id, glow, tier, skin = '#1a2830', accent }: NeonDefsProps) {
  const ac = accent ?? glow;
  return (
    <defs>
      <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation={tier >= 4 ? 4 : 2.8} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${id}-strong`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation={tier >= 5 ? 8 : 5} result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <radialGradient id={`${id}-bg`} cx="50%" cy="28%" r="78%">
        <stop offset="0%" stopColor={glow} stopOpacity={0.32 + tier * 0.05} />
        <stop offset="40%" stopColor={ac} stopOpacity="0.12" />
        <stop offset="100%" stopColor="#020308" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-spot`} cx="50%" cy="72%" r="45%">
        <stop offset="0%" stopColor={glow} stopOpacity="0.18" />
        <stop offset="100%" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-skin`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0%" stopColor={skin} stopOpacity="1" />
        <stop offset="55%" stopColor="#0a0c10" stopOpacity="1" />
        <stop offset="100%" stopColor="#050508" stopOpacity="1" />
      </linearGradient>
      <linearGradient id={`${id}-armor`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={glow} stopOpacity="0.55" />
        <stop offset="45%" stopColor="#222" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#080808" stopOpacity="1" />
      </linearGradient>
      <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.82" />
      </linearGradient>
      <linearGradient id={`${id}-border`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={glow} />
        <stop offset="35%" stopColor={ac} />
        <stop offset="70%" stopColor={glow} />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={glow} stopOpacity="0.95" />
        <stop offset="100%" stopColor={glow} stopOpacity="0.35" />
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
  locked?: boolean;
}

interface FighterArtProps extends ArtProps {
  fighterId: string;
}

function CyberCardBorder({ glow, tier }: { glow: string; tier: Tier }) {
  const w = tier >= 4 ? 3.2 : tier >= 2 ? 2.6 : 2;
  return (
    <g filter={`url(#border-glow)`}>
      <rect x="2" y="2" width="116" height="156" rx="3" fill="none" stroke={`url(#card-border)`} strokeWidth={w} />
      <rect x="5" y="5" width="110" height="150" rx="2" fill="none" stroke={glow} strokeWidth="0.6" opacity="0.35" />
      {/* corner brackets */}
      {[
        'M6 18 L6 6 L18 6',
        'M114 18 L114 6 L102 6',
        'M6 142 L6 154 L18 154',
        'M114 142 L114 154 L102 154',
      ].map((d, i) => (
        <path key={i} d={d} stroke={glow} strokeWidth="2.2" fill="none" opacity="0.85" />
      ))}
      {tier >= 3 && (
        <>
          <circle cx="60" cy="4" r="2" fill={glow} opacity="0.9" />
          <rect x="54" y="153" width="12" height="2.5" rx="1" fill={glow} opacity="0.6" />
        </>
      )}
      {tier >= 5 && (
        <rect x="8" y="8" width="104" height="144" rx="1" fill="none" stroke={glow} strokeWidth="0.4" strokeDasharray="3 5" opacity="0.4" />
      )}
    </g>
  );
}

function Scanlines({ glow }: { glow: string }) {
  return (
    <g opacity="0.06">
      {Array.from({ length: 32 }, (_, i) => (
        <line key={i} x1="0" y1={i * 5} x2="120" y2={i * 5} stroke={glow} strokeWidth="0.5" />
      ))}
    </g>
  );
}

function PowerAura({ glow, tier }: { glow: string; tier: Tier }) {
  if (tier < 2) return null;
  return (
    <g opacity={tier >= 5 ? 0.5 : tier >= 3 ? 0.32 : 0.2}>
      <ellipse cx="60" cy="86" rx={30 + tier * 3} ry={38 + tier * 3} stroke={glow} strokeWidth="1.2" fill="none" />
      {tier >= 3 && (
        <ellipse cx="60" cy="86" rx="42" ry="52" stroke={glow} strokeWidth="0.7" fill="none" strokeDasharray="5 7" />
      )}
      {tier >= 4 &&
        [0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const r = (deg * Math.PI) / 180;
          return (
            <circle
              key={deg}
              cx={60 + Math.cos(r) * 44}
              cy={86 + Math.sin(r) * 44}
              r="1.8"
              fill={glow}
              opacity="0.7"
            />
          );
        })}
    </g>
  );
}

function CyberVisor({ y, glow, w = 48 }: { y: number; glow: string; w?: number }) {
  const x = 60 - w / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height="12" rx="4" fill="#030508" stroke={glow} strokeWidth="1.8" />
      <rect x={x + 4} y={y + 3} width={w / 2 - 6} height="6" rx="1.5" fill={`url(#visor-glass)`} />
      <rect x={60 + 2} y={y + 3} width={w / 2 - 6} height="6" rx="1.5" fill={`url(#visor-glass)`} />
      <line x1={x + 4} y1={y + 6} x2={x + w - 4} y2={y + 6} stroke={glow} strokeWidth="0.4" opacity="0.5" />
    </g>
  );
}

function NeonShades({ y, glow }: { y: number; glow: string }) {
  return (
    <g>
      <path d={`M34 ${y + 2} Q46 ${y - 2} 58 ${y + 2} L58 ${y + 10} Q46 ${y + 14} 34 ${y + 10} Z`} fill="#050508" stroke={glow} strokeWidth="1.6" />
      <path d={`M62 ${y + 2} Q74 ${y - 2} 86 ${y + 2} L86 ${y + 10} Q74 ${y + 14} 62 ${y + 10} Z`} fill="#050508" stroke={glow} strokeWidth="1.6" />
      <rect x="56" y={y + 4} width="8" height="3" rx="1" fill={glow} opacity="0.5" />
      <path d={`M36 ${y + 5} L44 ${y + 6} M76 ${y + 6} L84 ${y + 5}`} stroke="#fff" strokeWidth="0.5" opacity="0.35" />
      <ellipse cx="46" cy={y + 6} rx="5" ry="3" fill={glow} opacity="0.15" />
      <ellipse cx="74" cy={y + 6} rx="5" ry="3" fill={glow} opacity="0.15" />
    </g>
  );
}

function Headphones({ glow }: { glow: string }) {
  return (
    <g>
      <path d="M28 52 Q60 28 92 52" stroke={glow} strokeWidth="3" fill="none" opacity="0.8" />
      <rect x="22" y="50" width="14" height="20" rx="4" fill="#0a0a0c" stroke={glow} strokeWidth="1.6" />
      <rect x="84" y="50" width="14" height="20" rx="4" fill="#0a0a0c" stroke={glow} strokeWidth="1.6" />
      <rect x="25" y="54" width="8" height="12" rx="2" fill={glow} opacity="0.25" />
      <rect x="87" y="54" width="8" height="12" rx="2" fill={glow} opacity="0.25" />
    </g>
  );
}

function Pauldrons({ glow, tier }: { glow: string; tier: Tier }) {
  if (tier < 2) return null;
  return (
    <g>
      <path d="M24 74 L14 98 L28 108 L36 84 Z" fill="url(#shoulder-l)" stroke={glow} strokeWidth="1.6" />
      <path d="M96 74 L106 98 L92 108 L84 84 Z" fill="url(#shoulder-r)" stroke={glow} strokeWidth="1.6" />
      <path d="M18 90 L10 94" stroke={glow} strokeWidth="1.4" opacity="0.7" />
      <path d="M102 90 L110 94" stroke={glow} strokeWidth="1.4" opacity="0.7" />
      {tier >= 4 && (
        <>
          <circle cx="22" cy="88" r="2" fill={glow} />
          <circle cx="98" cy="88" r="2" fill={glow} />
        </>
      )}
    </g>
  );
}

function ChestPlate({ glow, tier }: { glow: string; tier: Tier }) {
  return (
    <g opacity="0.95">
      <path d="M38 106 L44 134 L76 134 L82 106 Q60 118 38 106" fill="url(#chest-plate)" stroke={glow} strokeWidth="1.8" />
      <path d="M52 106 L60 116 L68 106" fill="none" stroke={glow} strokeWidth="1" opacity="0.5" />
      <circle cx="60" cy="122" r="2.5" fill={glow} opacity="0.65" />
      {tier >= 3 && (
        <>
          <path d="M44 112 L48 128 M76 112 L72 128" stroke={glow} strokeWidth="0.7" opacity="0.35" />
          <rect x="56" y="114" width="8" height="10" rx="1" fill={glow} opacity="0.12" />
        </>
      )}
    </g>
  );
}

function GroundShadow({ glow }: { glow: string }) {
  return (
    <ellipse cx="60" cy="128" rx="38" ry="10" fill={glow} opacity="0.12" filter="url(#soft-blur)" />
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
  locked = false,
  skin,
  accent,
}: {
  id: string;
  glow: string;
  tier: Tier;
  children: React.ReactNode;
  size: number;
  fill?: boolean;
  className?: string;
  locked?: boolean;
  skin?: string;
  accent?: string;
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
      <NeonDefs id={id} glow={glow} tier={tier} skin={skin} accent={accent} />
      {/* shared refs for sub-components */}
      <defs>
        <linearGradient id="card-border" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={glow} />
          <stop offset="50%" stopColor={accent ?? glow} />
          <stop offset="100%" stopColor={glow} />
        </linearGradient>
        <linearGradient id="visor-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={glow} stopOpacity="0.9" />
          <stop offset="100%" stopColor={glow} stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="shoulder-l" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={glow} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#111" />
        </linearGradient>
        <linearGradient id="shoulder-r" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={glow} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#111" />
        </linearGradient>
        <linearGradient id="chest-plate" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#181818" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
        <filter id="border-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="soft-blur">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect width="120" height="160" fill="#020308" />
      <rect width="120" height="160" fill={`url(#${id}-bg)`} />
      <Scanlines glow={glow} />
      {[24, 48, 72, 96, 120, 144].map(y => (
        <line key={`h${y}`} x1="0" y1={y} x2="120" y2={y} stroke={glow} strokeOpacity="0.04" strokeWidth="0.5" />
      ))}
      <PowerAura glow={glow} tier={tier} />
      <CyberCardBorder glow={glow} tier={tier} />
      <rect width="120" height="160" fill={`url(#${id}-spot)`} />
      <GroundShadow glow={glow} />
      <g opacity={locked ? 0.72 : 1}>{children}</g>
      <rect width="120" height="160" fill={`url(#${id}-floor)`} />
      {tier >= 2 && !locked && (
        <text x="60" y="152" textAnchor="middle" fill={glow} fontSize="5.5" opacity="0.4" fontFamily="monospace">
          {`T${tier} // MEME-FIGHTER`}
        </text>
      )}
      {locked && (
        <>
          <rect width="120" height="160" fill="#000" opacity="0.38" />
          <rect x="8" y="8" width="104" height="144" rx="2" fill="none" stroke={glow} strokeWidth="1" strokeDasharray="4 6" opacity="0.35" />
          <path d="M44 72 L76 72 M60 72 L60 92" stroke={glow} strokeWidth="2" opacity="0.25" strokeLinecap="round" />
          <circle cx="60" cy="68" r="10" fill="none" stroke={glow} strokeWidth="1.5" opacity="0.3" />
        </>
      )}
    </svg>
  );
}

export function FighterArt({
  fighterId,
  size = 120,
  glowColor = '#00f0ff',
  className = '',
  fill,
  locked = false,
}: FighterArtProps) {
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
  const props = { size, glowColor: glow, className, fill, tier, locked };
  if (fill) return <Comp {...props} />;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: size, height: size }}>
      <Comp {...props} fill className="absolute inset-0 w-full h-full" />
    </div>
  );
}

/* ─── PEPE PRIME — OG frog, welded shades, degen jacket ─── */
function PepePrimeArt({ size = 120, glowColor = '#00ff66', className, fill, tier = 1, locked }: ArtProps) {
  const id = 'pepe';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#1a4d2e" accent="#39ff14">
      <g filter={`url(#${id}-glow)`}>
        <path d="M30 58 Q60 30 90 58 L92 102 Q60 128 28 102 Z" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.4" />
        <path d="M34 64 Q60 54 86 64" fill="none" stroke="#2d6b42" strokeWidth="1.2" opacity="0.6" />
        <ellipse cx="44" cy="78" rx="12" ry="13" fill="#0d2818" stroke={g} strokeWidth="2" />
        <ellipse cx="76" cy="78" rx="12" ry="13" fill="#0d2818" stroke={g} strokeWidth="2" />
        <circle cx="44" cy="79" r="5" fill={g} opacity="0.35" />
        <circle cx="76" cy="79" r="5" fill={g} opacity="0.35" />
        <circle cx="45" cy="77" r="2" fill="#fff" opacity="0.5" />
        <circle cx="77" cy="77" r="2" fill="#fff" opacity="0.5" />
        <NeonShades y={70} glow={g} />
        <path d="M38 98 Q60 114 82 98" fill="none" stroke={g} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M42 100 Q60 108 78 100" fill="#1a4d2e" opacity="0.5" />
        <ChestPlate glow={g} tier={tier} />
        <path d="M46 134 L74 134 L70 148 L50 148 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.2" />
        <text x="60" y="143" textAnchor="middle" fill={g} fontSize="5" opacity="0.5" fontFamily="monospace">PEPE</text>
      </g>
    </Frame>
  );
}

/* ─── STREET RAT — sewer punk scavenger ─── */
function StreetRatArt({ size = 120, glowColor = '#c0c0c0', className, fill, tier = 1, locked }: ArtProps) {
  const id = 'rat';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#3a3a3a" accent="#e8e8e8">
      <g filter={`url(#${id}-glow)`}>
        <path d="M28 54 L18 26 L42 48 M92 54 L102 26 L78 48" stroke={g} strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <ellipse cx="60" cy="88" rx="32" ry="28" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.4" />
        <path d="M38 72 L82 72" stroke="#555" strokeWidth="0.8" opacity="0.5" />
        <path d="M34 62 Q60 48 86 62 L84 74 Q60 66 36 74 Z" fill="#2a2a2a" stroke={g} strokeWidth="1.4" />
        <circle cx="46" cy="84" r="6" fill="#111" stroke={g} strokeWidth="1.6" />
        <circle cx="74" cy="84" r="6" fill="#111" stroke={g} strokeWidth="1.6" />
        <circle cx="46" cy="84" r="2.5" fill="#ff003c" filter={`url(#${id}-soft)`} />
        <circle cx="74" cy="84" r="2.5" fill="#ff003c" filter={`url(#${id}-soft)`} />
        <path d="M54 98 L60 106 L66 98" stroke={g} strokeWidth="1.8" fill="none" />
        <path d="M40 108 L80 108 L74 132 L46 132 Z" fill="#141414" stroke={g} strokeWidth="1.6" />
        <path d="M48 112 L72 112 M50 118 L70 118" stroke={g} strokeWidth="0.6" opacity="0.35" />
        <circle cx="86" cy="70" r="3" fill={g} opacity="0.6" />
        <path d="M84 68 L90 64" stroke={g} strokeWidth="1" />
      </g>
    </Frame>
  );
}

/* ─── DOGELORD — shiba commander ─── */
function DogelordArt({ size = 120, glowColor = '#00a8ff', className, fill, tier = 2, locked }: ArtProps) {
  const id = 'doge';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#3d2810" accent="#66ccff">
      <g filter={`url(#${id}-glow)`}>
        <path d="M32 46 L24 22 L48 40 Z M88 46 L96 22 L72 40 Z" fill="#3d2810" stroke={g} strokeWidth="2.2" />
        <ellipse cx="60" cy="86" rx="34" ry="30" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.4" />
        <path d="M38 68 Q60 58 82 68 L80 78 Q60 72 40 78 Z" fill="#2a1a08" stroke={g} strokeWidth="1.2" />
        <CyberVisor y={68} glow={g} w={50} />
        <ellipse cx="46" cy="92" rx="7" ry="8" fill="#2a1a08" stroke={g} strokeWidth="1.4" />
        <ellipse cx="74" cy="92" rx="7" ry="8" fill="#2a1a08" stroke={g} strokeWidth="1.4" />
        <circle cx="46" cy="93" r="2" fill="#000" />
        <circle cx="74" cy="93" r="2" fill="#000" />
        <path d="M52 102 L68 102 L64 110 L56 110 Z" fill="#1a1006" stroke={g} strokeWidth="1.2" />
        <ChestPlate glow={g} tier={tier} />
        <Pauldrons glow={g} tier={tier} />
        <circle cx="60" cy="118" r="3" fill={g} opacity="0.5" />
        <text x="60" y="120" textAnchor="middle" fill={g} fontSize="4" fontFamily="monospace">WOW</text>
      </g>
    </Frame>
  );
}

/* ─── MEWTRIX — cyber cat assassin ─── */
function MewtrixArt({ size = 120, glowColor = '#b026ff', className, fill, tier = 2, locked }: ArtProps) {
  const id = 'mew';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#1a0a28" accent="#ff66ff">
      <g filter={`url(#${id}-glow)`}>
        <path d="M34 44 L24 16 L52 38 Z M86 44 L96 16 L68 38 Z" fill="#1a0a28" stroke={g} strokeWidth="2.4" />
        <path d="M38 38 L42 48 M82 38 L78 48" stroke={g} strokeWidth="1" opacity="0.5" />
        <ellipse cx="60" cy="84" rx="30" ry="26" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.4" />
        <rect x="32" y="70" width="56" height="16" rx="5" fill="#080010" stroke={g} strokeWidth="2" />
        <rect x="36" y="73" width="14" height="10" rx="2" fill={g} opacity="0.85" filter={`url(#${id}-soft)`} />
        <rect x="70" y="73" width="14" height="10" rx="2" fill={g} opacity="0.85" filter={`url(#${id}-soft)`} />
        <path d="M32 78 L22 82 M88 78 L98 82" stroke={g} strokeWidth="1.2" opacity="0.6" />
        <path d="M52 96 L60 104 L68 96" stroke={g} strokeWidth="1.6" fill="none" />
        <path d="M44 88 L76 88" stroke={g} strokeWidth="0.4" opacity="0.4" />
        <Headphones glow={g} />
        <ChestPlate glow={g} tier={tier} />
        <Pauldrons glow={g} tier={tier} />
      </g>
    </Frame>
  );
}

/* ─── BASED FROG — golden armored evolution ─── */
function BasedFrogArt({ size = 120, glowColor = '#ffd700', className, fill, tier = 2, locked }: ArtProps) {
  const id = 'bfrog';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#2a2008" accent="#fff4a0">
      <g filter={`url(#${id}-glow)`}>
        <path d="M36 40 L60 28 L84 40 L88 72 L82 108 Q60 118 38 108 L32 72 Z" fill="url(#bfrog-armor)" stroke={g} strokeWidth="2.8" />
        <path d="M40 48 L80 48 M42 56 L78 56 M44 64 L76 64 M46 72 L74 72" stroke={g} strokeWidth="0.5" opacity="0.4" />
        <ellipse cx="60" cy="82" rx="24" ry="20" fill="#1a1606" stroke={g} strokeWidth="1.8" />
        <circle cx="50" cy="76" r="5" fill={g} filter={`url(#${id}-soft)`} />
        <circle cx="70" cy="76" r="5" fill={g} filter={`url(#${id}-soft)`} />
        <circle cx="51" cy="75" r="1.5" fill="#fff" opacity="0.7" />
        <circle cx="71" cy="75" r="1.5" fill="#fff" opacity="0.7" />
        <path d="M32 76 L20 108 L36 114 Z M88 76 L100 108 L84 114 Z" fill="#3d3008" stroke={g} strokeWidth="2" />
        <path d="M48 38 L60 32 L72 38 L68 44 L52 44 Z" fill={g} opacity="0.7" stroke={g} strokeWidth="1" />
        <Pauldrons glow={g} tier={Math.max(tier, 3) as Tier} />
        <path d="M44 108 L76 108 L72 132 L48 132 Z" fill="#141006" stroke={g} strokeWidth="1.6" />
      </g>
      <defs>
        <linearGradient id="bfrog-armor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd700" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#8a6800" />
          <stop offset="100%" stopColor="#2a2008" />
        </linearGradient>
      </defs>
    </Frame>
  );
}

/* ─── GIGA CHAD — sigma jawline ─── */
function GigaChadArt({ size = 120, glowColor = '#ffaa00', className, fill, tier = 3, locked }: ArtProps) {
  const id = 'chad';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#2a2018" accent="#ffcc44">
      <g filter={`url(#${id}-glow)`}>
        <path d="M34 42 Q60 28 86 42 L90 68 L84 112 Q60 124 36 112 L30 68 Z" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.6" />
        <path d="M36 62 L84 62" stroke="#1a1410" strokeWidth="1" opacity="0.4" />
        <path d="M38 68 L50 94 L70 94 L82 68" fill="none" stroke={g} strokeWidth="3" strokeLinecap="round" filter={`url(#${id}-strong)`} />
        <path d="M42 56 Q60 64 78 56" fill="none" stroke={g} strokeWidth="2" />
        <path d="M48 98 Q60 106 72 98" fill="none" stroke="#1a1410" strokeWidth="1.4" />
        <path d="M44 108 L76 108 L72 132 L48 132 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.6" />
        <path d="M52 108 L68 108 L64 118 L56 118 Z" fill={g} opacity="0.15" stroke={g} strokeWidth="0.8" />
        <Pauldrons glow={g} tier={tier} />
        <path d="M88 58 L104 44" stroke={g} strokeWidth="2" opacity="0.55" />
        <circle cx="104" cy="42" r="2" fill={g} />
      </g>
    </Frame>
  );
}

/* ─── WOJAK — masked pain warrior ─── */
function WojakArt({ size = 120, glowColor = '#ff4da6', className, fill, tier = 3, locked }: ArtProps) {
  const id = 'wojak';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#e8c4a8" accent="#ff80cc">
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="84" rx="28" ry="32" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.4" />
        <path d="M32 52 Q60 40 88 52 L86 66 Q60 58 34 66 Z" fill="#c9a882" stroke={g} strokeWidth="1.6" />
        <rect x="34" y="60" width="52" height="8" rx="2" fill="#111" stroke={g} strokeWidth="1.4" />
        <ellipse cx="48" cy="78" rx="7" ry="8" fill="#c9a882" stroke={g} strokeWidth="1.4" />
        <ellipse cx="72" cy="78" rx="7" ry="8" fill="#c9a882" stroke={g} strokeWidth="1.4" />
        <ellipse cx="48" cy="80" rx="4" ry="5" fill="#1a1410" />
        <ellipse cx="72" cy="80" rx="4" ry="5" fill="#1a1410" />
        <path d="M48 86 Q60 92 72 86" stroke={g} strokeWidth="1.4" fill="none" opacity="0.5" />
        <path d="M52 96 Q60 102 68 96" stroke="#8a7060" strokeWidth="1.6" fill="none" />
        <ChestPlate glow={g} tier={tier} />
        <Pauldrons glow={g} tier={tier} />
        <path d="M24 70 Q18 86 24 102" stroke={g} strokeWidth="1" opacity="0.35" fill="none" />
        <path d="M96 70 Q102 86 96 102" stroke={g} strokeWidth="1" opacity="0.35" fill="none" />
      </g>
    </Frame>
  );
}

/* ─── BULLX — market gorer ─── */
function BullxArt({ size = 120, glowColor = '#ff4400', className, fill, tier = 3, locked }: ArtProps) {
  const id = 'bull';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#2a0808" accent="#ff6622">
      <g filter={`url(#${id}-glow)`}>
        <path d="M28 64 Q20 34 34 22 Q42 42 38 58" fill={g} stroke={g} strokeWidth="2" filter={`url(#${id}-soft)`} />
        <path d="M92 64 Q100 34 86 22 Q78 42 82 58" fill={g} stroke={g} strokeWidth="2" filter={`url(#${id}-soft)`} />
        <ellipse cx="60" cy="86" rx="34" ry="30" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.6" />
        <circle cx="46" cy="78" r="7" fill="#ff2200" filter={`url(#${id}-strong)`} />
        <circle cx="74" cy="78" r="7" fill="#ff2200" filter={`url(#${id}-strong)`} />
        <circle cx="46" cy="78" r="3" fill="#000" />
        <circle cx="74" cy="78" r="3" fill="#000" />
        <ellipse cx="60" cy="96" rx="16" ry="10" fill="#180404" stroke={g} strokeWidth="1.8" />
        <circle cx="60" cy="98" r="4" fill="none" stroke={g} strokeWidth="1.2" />
        <path d="M38 60 L82 60" stroke={g} strokeWidth="1.5" opacity="0.4" />
        <path d="M40 108 L80 108 L76 132 L44 132 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.6" />
        <Pauldrons glow={g} tier={Math.max(tier, 4) as Tier} />
        <path d="M14 72 L28 84" stroke={g} strokeWidth="2.5" opacity="0.5" />
        <path d="M106 72 L92 84" stroke={g} strokeWidth="2.5" opacity="0.5" />
      </g>
    </Frame>
  );
}

/* ─── DIAMOND DEGEN — crystalline hodler ─── */
function DiamondDegenArt({ size = 120, glowColor = '#00ffff', className, fill, tier = 4, locked }: ArtProps) {
  const id = 'diamond';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#041820" accent="#88ffff">
      <g filter={`url(#${id}-glow)`}>
        <path d="M60 32 L92 68 L76 124 L44 124 L28 68 Z" fill="#061018" stroke={g} strokeWidth="2.8" />
        <path d="M60 32 L60 124 M28 68 L92 68 M40 50 L80 86 M80 50 L40 86" stroke={g} strokeWidth="0.8" opacity="0.45" />
        <path d="M48 52 L72 52 L60 72 Z" fill={g} opacity="0.35" />
        <circle cx="60" cy="68" r="10" fill={g} opacity="0.5" filter={`url(#${id}-strong)`} />
        <path d="M52 44 L68 44 L60 56 Z" fill="#fff" opacity="0.25" />
        <ellipse cx="60" cy="98" rx="14" ry="10" fill="#041018" stroke={g} strokeWidth="1.6" />
        <path d="M46 108 L74 108 L70 132 L50 132 Z" fill="#061018" stroke={g} strokeWidth="1.6" />
        <Pauldrons glow={g} tier={tier} />
        {[0, 72, 144, 216, 288].map(deg => {
          const r = (deg * Math.PI) / 180;
          return (
            <circle key={deg} cx={60 + Math.cos(r) * 28} cy={68 + Math.sin(r) * 28} r="1.5" fill={g} opacity="0.6" />
          );
        })}
      </g>
    </Frame>
  );
}

/* ─── PINGU — arctic assassin ─── */
function PinguArt({ size = 120, glowColor = '#00e5ff', className, fill, tier = 4, locked }: ArtProps) {
  const id = 'pingu';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#0a1420" accent="#80f0ff">
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="88" rx="32" ry="34" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.6" />
        <ellipse cx="60" cy="98" rx="20" ry="22" fill="#eef8ff" opacity="0.95" />
        <ellipse cx="60" cy="102" rx="12" ry="14" fill="#fff" opacity="0.9" />
        <path d="M50 44 Q60 34 70 44 L68 54 L52 54 Z" fill="#ff8800" stroke={g} strokeWidth="1.4" />
        <CyberVisor y={62} glow={g} w={54} />
        <path d="M38 108 L82 108" stroke="#eef8ff" strokeWidth="0.6" opacity="0.4" />
        <ChestPlate glow={g} tier={tier} />
        <Pauldrons glow={g} tier={tier} />
        <path d="M100 68 L112 58" stroke={g} strokeWidth="2" opacity="0.55" />
        <path d="M112 58 L118 52 L114 62 Z" fill={g} opacity="0.4" />
        <line x1="104" y1="72" x2="112" y2="66" stroke="#eef8ff" strokeWidth="1" opacity="0.5" />
      </g>
    </Frame>
  );
}

/* ─── RUG REAPER — dev hunter ─── */
function RugReaperArt({ size = 120, glowColor = '#aa00ff', className, fill, tier = 4, locked }: ArtProps) {
  const id = 'reaper';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#0a0814" accent="#cc44ff">
      <g filter={`url(#${id}-glow)`}>
        <path d="M28 44 Q60 32 92 44 L88 112 Q60 122 32 112 Z" fill="#0a0810" stroke={g} strokeWidth="2.6" />
        <path d="M36 48 Q60 40 84 48 L82 108 Q60 114 38 108 Z" fill="#060408" opacity="0.8" />
        <ellipse cx="44" cy="72" rx="9" ry="10" fill="#020204" stroke={g} strokeWidth="1.4" />
        <ellipse cx="76" cy="72" rx="9" ry="10" fill="#020204" stroke={g} strokeWidth="1.4" />
        <circle cx="44" cy="72" r="4" fill="#ff003c" filter={`url(#${id}-strong)`} />
        <circle cx="76" cy="72" r="4" fill="#ff003c" filter={`url(#${id}-strong)`} />
        <line x1="94" y1="24" x2="38" y2="128" stroke={g} strokeWidth="3" filter={`url(#${id}-glow)`} />
        <path d="M94 24 Q110 16 108 36 Q100 26 94 28" fill="#0a0810" stroke={g} strokeWidth="2.2" />
        <path d="M108 32 Q118 26 116 42 L108 36 Z" fill={g} opacity="0.3" />
        <Pauldrons glow={g} tier={tier} />
        <path d="M52 88 Q60 94 68 88" stroke={g} strokeWidth="0.8" opacity="0.3" fill="none" />
      </g>
    </Frame>
  );
}

/* ─── ZOG — alien apex ─── */
function ZogArt({ size = 120, glowColor = '#e040ff', className, fill, tier = 5, locked }: ArtProps) {
  const id = 'zog';
  const g = glowColor;
  return (
    <Frame id={id} glow={g} tier={tier} size={size} fill={fill} className={className} locked={locked} skin="#180820" accent="#ff88ff">
      <g filter={`url(#${id}-glow)`}>
        <ellipse cx="60" cy="82" rx="34" ry="36" fill={`url(#${id}-skin)`} stroke={g} strokeWidth="2.8" />
        <ellipse cx="42" cy="74" rx="14" ry="18" fill="#0a0410" stroke={g} strokeWidth="2.2" />
        <ellipse cx="78" cy="74" rx="14" ry="18" fill="#0a0410" stroke={g} strokeWidth="2.2" />
        <ellipse cx="42" cy="74" rx="7" ry="11" fill="#200030" />
        <ellipse cx="78" cy="74" rx="7" ry="11" fill="#200030" />
        <circle cx="42" cy="70" r="3" fill={g} filter={`url(#${id}-strong)`} />
        <circle cx="78" cy="70" r="3" fill={g} filter={`url(#${id}-strong)`} />
        <circle cx="43" cy="69" r="1" fill="#fff" opacity="0.8" />
        <circle cx="79" cy="69" r="1" fill="#fff" opacity="0.8" />
        <path d="M50 98 Q60 106 70 98" stroke={g} strokeWidth="1.6" fill="none" />
        <path d="M40 108 L80 108 L76 132 L44 132 Z" fill="#0a0a0a" stroke={g} strokeWidth="1.8" />
        <Pauldrons glow={g} tier={5} />
        <path d="M60 28 L60 38 M46 32 L74 32" stroke={g} strokeWidth="1.2" opacity="0.6" />
        <circle cx="60" cy="24" r="4" fill={g} opacity="0.8" filter={`url(#${id}-strong)`} />
        <circle cx="60" cy="24" r="2" fill="#fff" opacity="0.5" />
        {[0, 120, 240].map(deg => {
          const r = (deg * Math.PI) / 180;
          return (
            <circle key={deg} cx={60 + Math.cos(r) * 46} cy={82 + Math.sin(r) * 46} r="2" fill={g} opacity="0.5" />
          );
        })}
      </g>
    </Frame>
  );
}
