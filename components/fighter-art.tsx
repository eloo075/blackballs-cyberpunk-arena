'use client';

interface NeonDefsProps { id: string; glow: string; }

function NeonDefs({ id, glow }: NeonDefsProps) {
  return (
    <defs>
      <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <radialGradient id={`${id}-bg`} cx="50%" cy="42%" r="60%">
        <stop offset="0%" stopColor={glow} stopOpacity="0.32" />
        <stop offset="60%" stopColor={glow} stopOpacity="0.08" />
        <stop offset="100%" stopColor="#050714" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

interface ArtProps { size?: number; glowColor?: string; }
interface FighterArtProps extends ArtProps { fighterId: string; }

export function FighterArt({ fighterId, size = 120, glowColor = '#00f0ff' }: FighterArtProps) {
  const map: Record<string, (p: ArtProps) => React.ReactElement> = {
    ansem: AnsemArt, cashcat: CashcatArt, blackball: BlackballArt,
    rug_sensei: RugSenseiArt, moon_ape: MoonApeArt, degen_lord: DegenLordArt,
    pepe_war: PepeWarArt, chad_monk: ChadMonkArt,
  };
  const Comp = map[fighterId] ?? BlackballArt;
  return <Comp size={size} glowColor={glowColor} />;
}

function Frame({ id, glow, children, size }: { id: string; glow: string; children: React.ReactNode; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <NeonDefs id={id} glow={glow} />
      <rect x="2" y="2" width="116" height="116" rx="8" fill={`url(#${id}-bg)`} />
      {children}
    </svg>
  );
}

export function AnsemArt({ size = 120, glowColor = '#fcee0a' }: ArtProps) {
  const id = 'ansem';
  return (
    <Frame id={id} glow={glowColor} size={size}>
      <g filter={`url(#${id}-glow)`}>
        {/* head */}
        <ellipse cx="60" cy="78" rx="28" ry="24" fill="#0a0e24" stroke="#fcee0a" strokeWidth="2.2" />
        {/* horns */}
        <path d="M40 64 Q34 44 30 30 Q38 40 44 58" fill="#fcee0a" stroke="#fcee0a" strokeWidth="1.5" />
        <path d="M80 64 Q86 44 90 30 Q82 40 76 58" fill="#fcee0a" stroke="#fcee0a" strokeWidth="1.5" />
        {/* crown */}
        <path d="M48 40 L54 30 L60 38 L66 30 L72 40 L68 48 L52 48 Z" fill="#fcee0a" stroke="#ff6b00" strokeWidth="1.2" />
        <circle cx="60" cy="34" r="2.5" fill="#ff003c" />
        {/* ears */}
        <ellipse cx="34" cy="74" rx="6" ry="10" fill="#0a0e24" stroke="#fcee0a" strokeWidth="1.8" />
        <ellipse cx="86" cy="74" rx="6" ry="10" fill="#0a0e24" stroke="#fcee0a" strokeWidth="1.8" />
        {/* eyes - angry slits */}
        <path d="M44 76 L54 80" stroke="#ff003c" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M66 80 L76 76" stroke="#ff003c" strokeWidth="2.5" strokeLinecap="round" />
        {/* nose ring */}
        <circle cx="60" cy="88" r="5" fill="none" stroke="#fcee0a" strokeWidth="2" />
        <circle cx="60" cy="93" r="1.6" fill="#fcee0a" />
        {/* nostrils */}
        <circle cx="55" cy="86" r="1.4" fill="#fcee0a" />
        <circle cx="65" cy="86" r="1.4" fill="#fcee0a" />
      </g>
    </Frame>
  );
}

export function CashcatArt({ size = 120, glowColor = '#00ff9c' }: ArtProps) {
  const id = 'cashcat';
  return (
    <Frame id={id} glow={glowColor} size={size}>
      <g filter={`url(#${id}-glow)`}>
        {/* ears */}
        <path d="M36 44 L30 22 L48 36 Z" fill="#0a0e24" stroke="#00ff9c" strokeWidth="2" />
        <path d="M84 44 L90 22 L72 36 Z" fill="#0a0e24" stroke="#00ff9c" strokeWidth="2" />
        {/* inner ears */}
        <path d="M38 40 L35 28 L44 36 Z" fill="#00ff9c" opacity="0.4" />
        <path d="M82 40 L85 28 L76 36 Z" fill="#00ff9c" opacity="0.4" />
        {/* head */}
        <ellipse cx="60" cy="72" rx="30" ry="26" fill="#0a0e24" stroke="#00ff9c" strokeWidth="2.2" />
        {/* suit collar */}
        <path d="M40 98 L48 90 L60 96 L72 90 L80 98 L80 110 L40 110 Z" fill="#0e1430" stroke="#00f0ff" strokeWidth="1.5" />
        <path d="M52 92 L60 100 L68 92" fill="none" stroke="#00f0ff" strokeWidth="1.5" />
        {/* tie */}
        <path d="M58 98 L56 108 L64 108 L62 98 Z" fill="#ff003c" />
        {/* eyes - slit pupils */}
        <ellipse cx="48" cy="68" rx="6" ry="8" fill="#00ff9c" />
        <ellipse cx="72" cy="68" rx="6" ry="8" fill="#00ff9c" />
        <ellipse cx="48" cy="68" rx="1.5" ry="7" fill="#0a0e24" />
        <ellipse cx="72" cy="68" rx="1.5" ry="7" fill="#0a0e24" />
        {/* whiskers */}
        <path d="M36 84 L52 82" stroke="#00ff9c" strokeWidth="1.2" />
        <path d="M36 90 L52 88" stroke="#00ff9c" strokeWidth="1.2" />
        <path d="M84 84 L68 82" stroke="#00ff9c" strokeWidth="1.2" />
        <path d="M84 90 L68 88" stroke="#00ff9c" strokeWidth="1.2" />
        {/* nose */}
        <path d="M57 80 L63 80 L60 84 Z" fill="#ff003c" />
        {/* mouth */}
        <path d="M60 84 Q56 88 52 86" fill="none" stroke="#00ff9c" strokeWidth="1.5" />
        <path d="M60 84 Q64 88 68 86" fill="none" stroke="#00ff9c" strokeWidth="1.5" />
      </g>
    </Frame>
  );
}

export function BlackballArt({ size = 120, glowColor = '#9d00ff' }: ArtProps) {
  const id = 'blackball';
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <NeonDefs id={id} glow={glowColor} />
      <g filter={`url(#${id}-glow)`}>
        <image
          href="/Picsart_26-07-21_17-58-02-235.png"
          x="12"
          y="12"
          width="96"
          height="96"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    </svg>
  );
}

export function RugSenseiArt({ size = 120, glowColor = '#ff003c' }: ArtProps) {
  const id = 'rug';
  return (
    <Frame id={id} glow={glowColor} size={size}>
      <g filter={`url(#${id}-glow)`}>
        {/* hood */}
        <path d="M30 70 Q30 28 60 26 Q90 28 90 70 L84 84 Q60 78 36 84 Z" fill="#0a0e24" stroke="#ff003c" strokeWidth="2.2" />
        <path d="M38 64 Q60 58 82 64" fill="none" stroke="#ff003c" strokeWidth="1" opacity="0.5" />
        {/* face shadow */}
        <ellipse cx="60" cy="72" rx="20" ry="16" fill="#020308" />
        {/* eyes */}
        <path d="M48 70 L56 74" stroke="#ff003c" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M64 74 L72 70" stroke="#ff003c" strokeWidth="2.5" strokeLinecap="round" />
        {/* headband */}
        <path d="M34 64 L86 64" stroke="#ff003c" strokeWidth="3" />
        <circle cx="60" cy="64" r="2.5" fill="#fcee0a" />
        {/* katana behind */}
        <line x1="20" y1="100" x2="100" y2="20" stroke="#00f0ff" strokeWidth="2.5" />
        <line x1="20" y1="100" x2="100" y2="20" stroke="#fff" strokeWidth="0.8" />
        <rect x="16" y="96" width="8" height="10" rx="1" fill="#0a0e24" stroke="#ff003c" strokeWidth="1.5" transform="rotate(-45 20 100)" />
        {/* fire at blade tip */}
        <path d="M98 18 Q102 10 96 6 Q104 8 106 16 Q108 22 100 24" fill="#ff6b00" opacity="0.8" />
        <path d="M96 22 Q98 16 94 14" fill="#fcee0a" opacity="0.7" />
      </g>
    </Frame>
  );
}

export function MoonApeArt({ size = 120, glowColor = '#00f0ff' }: ArtProps) {
  const id = 'moon';
  return (
    <Frame id={id} glow={glowColor} size={size}>
      <g filter={`url(#${id}-glow)`}>
        {/* helmet */}
        <circle cx="60" cy="58" r="34" fill="#0a0e24" stroke="#00f0ff" strokeWidth="2.2" />
        <path d="M28 58 Q60 50 92 58" fill="none" stroke="#00f0ff" strokeWidth="1.5" opacity="0.5" />
        {/* visor reflection */}
        <ellipse cx="60" cy="54" rx="22" ry="14" fill="#00f0ff" opacity="0.15" />
        <path d="M44 50 Q60 46 76 50" fill="none" stroke="#00f0ff" strokeWidth="1" opacity="0.6" />
        {/* ape face inside */}
        <ellipse cx="60" cy="62" rx="20" ry="18" fill="#1a2440" stroke="#00ff9c" strokeWidth="1.5" />
        <ellipse cx="52" cy="60" rx="5" ry="5" fill="#00ff9c" />
        <ellipse cx="68" cy="60" rx="5" ry="5" fill="#00ff9c" />
        <circle cx="52" cy="60" r="2" fill="#020308" />
        <circle cx="68" cy="60" r="2" fill="#020308" />
        {/* nose/mouth */}
        <path d="M56 70 L60 74 L64 70" fill="none" stroke="#00ff9c" strokeWidth="1.5" />
        <path d="M52 78 Q60 82 68 78" fill="none" stroke="#00ff9c" strokeWidth="1.5" />
        {/* antenna */}
        <line x1="60" y1="24" x2="60" y2="14" stroke="#00f0ff" strokeWidth="1.5" />
        <circle cx="60" cy="12" r="2.5" fill="#ff003c" />
        {/* moon */}
        <circle cx="96" cy="28" r="8" fill="#fcee0a" opacity="0.8" />
        <circle cx="93" cy="26" r="2" fill="#0a0e24" />
        <circle cx="98" cy="30" r="1.5" fill="#0a0e24" />
        {/* rocket trail */}
        <path d="M16 100 Q24 92 20 84" fill="none" stroke="#ff6b00" strokeWidth="2" />
        <path d="M14 96 Q20 90 18 84" fill="none" stroke="#fcee0a" strokeWidth="1.5" />
      </g>
    </Frame>
  );
}

export function DegenLordArt({ size = 120, glowColor = '#ff6b00' }: ArtProps) {
  const id = 'degen';
  return (
    <Frame id={id} glow={glowColor} size={size}>
      <g filter={`url(#${id}-glow)`}>
        {/* skull */}
        <path d="M36 50 Q36 30 60 28 Q84 30 84 50 L84 72 Q84 84 72 86 L72 94 Q66 98 60 96 Q54 98 48 94 L48 86 Q36 84 36 72 Z" fill="#0a0e24" stroke="#ff6b00" strokeWidth="2.2" />
        {/* eye sockets */}
        <ellipse cx="48" cy="58" rx="7" ry="8" fill="#020308" />
        <ellipse cx="72" cy="58" rx="7" ry="8" fill="#020308" />
        <circle cx="48" cy="58" r="3" fill="#ff003c" />
        <circle cx="72" cy="58" r="3" fill="#ff003c" />
        {/* nose */}
        <path d="M58 70 L60 78 L62 70 Z" fill="#ff6b00" />
        {/* teeth */}
        <path d="M48 86 L50 92 M54 86 L54 93 M60 86 L60 93 M66 86 L66 93 M72 86 L70 92" stroke="#ff6b00" strokeWidth="1.5" />
        {/* scythe */}
        <line x1="98" y1="14" x2="30" y2="104" stroke="#00f0ff" strokeWidth="2.5" />
        <path d="M98 14 Q112 18 110 36 Q104 24 98 22" fill="#0a0e24" stroke="#00f0ff" strokeWidth="2" />
        {/* ribs */}
        <path d="M46 100 L74 100" stroke="#ff6b00" strokeWidth="1.5" />
        <path d="M44 104 L76 104" stroke="#ff6b00" strokeWidth="1.5" opacity="0.7" />
        {/* glow aura */}
        <circle cx="60" cy="60" r="38" fill="none" stroke="#ff6b00" strokeWidth="0.8" opacity="0.3" />
      </g>
    </Frame>
  );
}

export function PepeWarArt({ size = 120, glowColor = '#00ff9c' }: ArtProps) {
  const id = 'pepe';
  return (
    <Frame id={id} glow={glowColor} size={size}>
      <g filter={`url(#${id}-glow)`}>
        {/* head */}
        <ellipse cx="60" cy="70" rx="32" ry="28" fill="#0a1a14" stroke="#00ff9c" strokeWidth="2.2" />
        {/* eyes - bulging */}
        <ellipse cx="48" cy="60" rx="9" ry="10" fill="#0a1a14" stroke="#00ff9c" strokeWidth="1.8" />
        <ellipse cx="72" cy="60" rx="9" ry="10" fill="#0a1a14" stroke="#00ff9c" strokeWidth="1.8" />
        <circle cx="48" cy="60" r="5" fill="#00ff9c" />
        <circle cx="72" cy="60" r="5" fill="#00ff9c" />
        <circle cx="48" cy="60" r="2.5" fill="#020308" />
        <circle cx="72" cy="60" r="2.5" fill="#020308" />
        {/* brow - angry */}
        <path d="M38 50 L56 54" stroke="#00ff9c" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M64 54 L82 50" stroke="#00ff9c" strokeWidth="2.5" strokeLinecap="round" />
        {/* mouth - grimace */}
        <path d="M44 84 Q60 92 76 84 L76 88 Q60 96 44 88 Z" fill="#020308" stroke="#00ff9c" strokeWidth="1.5" />
        {/* shield */}
        <path d="M86 76 L96 72 L96 88 Q91 94 86 90 Z" fill="#0a1a14" stroke="#00f0ff" strokeWidth="2" />
        <path d="M89 80 L93 80 M91 78 L91 86" stroke="#00f0ff" strokeWidth="1.2" />
        {/* warts */}
        <circle cx="40" cy="78" r="2" fill="#00ff9c" opacity="0.6" />
        <circle cx="80" cy="74" r="1.5" fill="#00ff9c" opacity="0.6" />
        <circle cx="58" cy="84" r="1.8" fill="#00ff9c" opacity="0.5" />
      </g>
    </Frame>
  );
}

export function ChadMonkArt({ size = 120, glowColor = '#fcee0a' }: ArtProps) {
  const id = 'chad';
  return (
    <Frame id={id} glow={glowColor} size={size}>
      <g filter={`url(#${id}-glow)`}>
        {/* head - chad jaw */}
        <path d="M40 44 Q40 30 60 28 Q80 30 80 44 L84 60 L78 88 Q70 96 60 96 Q50 96 42 88 L36 60 Z" fill="#0a0e24" stroke="#fcee0a" strokeWidth="2.2" />
        {/* third eye */}
        <ellipse cx="60" cy="44" rx="6" ry="4" fill="#0a0e24" stroke="#ff003c" strokeWidth="1.5" />
        <circle cx="60" cy="44" r="2.5" fill="#ff003c" />
        <path d="M54 40 L66 40" stroke="#ff003c" strokeWidth="1" opacity="0.6" />
        {/* eyes - closed serene */}
        <path d="M46 58 Q52 62 58 58" fill="none" stroke="#fcee0a" strokeWidth="2" strokeLinecap="round" />
        <path d="M62 58 Q68 62 74 58" fill="none" stroke="#fcee0a" strokeWidth="2" strokeLinecap="round" />
        {/* chad jaw line */}
        <path d="M42 72 L50 84 L70 84 L78 72" fill="none" stroke="#fcee0a" strokeWidth="1.5" opacity="0.5" />
        {/* mouth - slight smile */}
        <path d="M52 84 Q60 88 68 84" fill="none" stroke="#fcee0a" strokeWidth="1.8" />
        {/* aura rays */}
        <g opacity="0.6">
          <line x1="60" y1="14" x2="60" y2="20" stroke="#fcee0a" strokeWidth="1.5" />
          <line x1="40" y1="20" x2="44" y2="26" stroke="#fcee0a" strokeWidth="1.2" />
          <line x1="80" y1="20" x2="76" y2="26" stroke="#fcee0a" strokeWidth="1.2" />
          <line x1="28" y1="40" x2="34" y2="44" stroke="#fcee0a" strokeWidth="1.2" />
          <line x1="92" y1="40" x2="86" y2="44" stroke="#fcee0a" strokeWidth="1.2" />
        </g>
      </g>
    </Frame>
  );
}
