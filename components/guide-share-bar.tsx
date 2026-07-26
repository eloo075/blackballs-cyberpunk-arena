'use client';

import { useCallback, useState } from 'react';

const GUIDE_URL = 'https://game.blackballs.site/guide';

interface GuideShareBarProps {
  variant?: 'compact' | 'full';
}

export function GuideShareBar({ variant = 'compact' }: GuideShareBarProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    const url =
      typeof window !== 'undefined' && window.location.origin
        ? `${window.location.origin}/guide`
        : GUIDE_URL;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy guide link:', url);
    }
  }, []);

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={copyLink}
        className="w-full py-2.5 text-xs font-extrabold rounded-xl bg-[#2a2c33] border border-white/10 text-white/80 hover:bg-[#353842] hover:text-white transition-colors"
      >
        {copied ? '✓ Link copied — send it to the degens' : '🔗 Copy guide link to share'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copyLink}
      className="text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg bg-[#2a2c33] border border-white/10 text-sky-400 hover:text-sky-300 transition-colors shrink-0"
    >
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
