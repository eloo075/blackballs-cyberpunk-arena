'use client';

const LOGO_SRC = '/blackballs-logo-transparent.png';

export function CampaignNav() {
  return (
    <header className="relative z-20 border-b border-white/5 bg-[#1f2025]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1700px] items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            <img src={LOGO_SRC} alt="BlackBalls" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold text-white">BlackBalls</div>
            <div className="truncate text-[10px] font-bold text-amber-300/80">First 500 · Pre-launch</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://x.com/BlackBalls"
            target="_blank"
            rel="noopener noreferrer"
            className="touch-manipulation rounded-xl border border-white/10 bg-[#2a2c33] px-3 py-2 text-[10px] font-extrabold text-white/75 transition-colors hover:bg-[#353842]"
          >
            Follow on X
          </a>
        </div>
      </div>
    </header>
  );
}
