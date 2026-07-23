'use client';

import { FighterArt } from '@/components/fighter-art';
import type { Fighter } from '@/lib/fighters';

interface FighterPortraitProps {
  fighter: Fighter;
  className?: string;
}

/** Clean SVG portrait — no baked-in borders or name bars. */
export function FighterPortrait({ fighter, className = '' }: FighterPortraitProps) {
  return (
    <div className={`absolute inset-0 ${className}`}>
      <FighterArt fighterId={fighter.id} glowColor={fighter.glowColor} fill className="w-full h-full" />
    </div>
  );
}
