'use client';

export function FlipComingSoon() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center rounded-2xl border border-orange-400/25 bg-gradient-to-b from-orange-500/10 to-[#12141a] px-6 py-10">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-orange-300/80">Black Flip</div>
        <h1 className="mt-3 text-3xl font-extrabold text-white tracking-tight">Coming Soon</h1>
        <p className="mt-3 text-sm font-bold text-white/55 leading-relaxed">
          50/50 coin flip is in the build and will open after Crash launch. You cannot enter a match or move
          balance through Flip yet.
        </p>
        <p className="mt-4 text-[11px] font-bold text-white/35">Play Crash for now · Guide has the Crash rules</p>
      </div>
    </div>
  );
}
