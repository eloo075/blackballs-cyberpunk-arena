'use client';

interface TokenLogoProps { symbol: string; size?: number; }

export function TokenLogo({ symbol, size = 32 }: TokenLogoProps) {
  switch (symbol) {
    case 'ANSEM': return <AnsemLogo size={size} />;
    case 'CASHCAT': return <CashcatLogo size={size} />;
    default: return <DefaultLogo symbol={symbol} size={size} />;
  }
}

function DefaultLogo({ symbol, size }: { symbol: string; size: number }) {
  return <div className="flex items-center justify-center font-black text-white/60 font-display" style={{ width: size, height: size, fontSize: size * 0.4 }}>{symbol.slice(0, 2)}</div>;
}

function AnsemLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <filter id="ansem-l-glow"><feGaussianBlur stdDeviation="1.2" /></filter>
      </defs>
      <circle cx="32" cy="32" r="30" fill="#0a0e24" stroke="#fcee0a" strokeWidth="2" />
      <g filter="url(#ansem-l-glow)">
        <path d="M18 24 L22 14 L26 22" fill="#fcee0a" />
        <path d="M46 24 L42 14 L38 22" fill="#fcee0a" />
        <circle cx="32" cy="34" r="12" fill="none" stroke="#fcee0a" strokeWidth="2" />
        <path d="M24 32 L30 36" stroke="#ff003c" strokeWidth="2" />
        <path d="M34 36 L40 32" stroke="#ff003c" strokeWidth="2" />
        <circle cx="32" cy="40" r="3" fill="none" stroke="#fcee0a" strokeWidth="1.5" />
      </g>
      <text x="32" y="56" fontSize="8" fontFamily="Orbitron" fontWeight="900" fill="#fcee0a" textAnchor="middle">ANSEM</text>
    </svg>
  );
}

function CashcatLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs><filter id="cc-l-glow"><feGaussianBlur stdDeviation="1" /></filter></defs>
      <circle cx="32" cy="32" r="30" fill="#0a0e24" stroke="#00ff9c" strokeWidth="2" />
      <g filter="url(#cc-l-glow)">
        <path d="M18 20 L14 8 L24 16 Z" fill="#0a0e24" stroke="#00ff9c" strokeWidth="1.5" />
        <path d="M46 20 L50 8 L40 16 Z" fill="#0a0e24" stroke="#00ff9c" strokeWidth="1.5" />
        <circle cx="32" cy="34" r="13" fill="none" stroke="#00ff9c" strokeWidth="2" />
        <ellipse cx="26" cy="32" rx="3" ry="4" fill="#00ff9c" />
        <ellipse cx="38" cy="32" rx="3" ry="4" fill="#00ff9c" />
        <path d="M29 38 L35 38 L32 41 Z" fill="#ff003c" />
      </g>
      <text x="32" y="56" fontSize="7" fontFamily="Orbitron" fontWeight="900" fill="#00ff9c" textAnchor="middle">CASHCAT</text>
    </svg>
  );
}
