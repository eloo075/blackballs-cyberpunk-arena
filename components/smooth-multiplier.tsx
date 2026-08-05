'use client';

import { useEffect, useRef } from 'react';
import { usePageVisibility } from '@/hooks/use-page-visibility';

/**
 * Renders the big multiplier readout, easing toward the latest value at 60 fps
 * by writing textContent directly — no React re-render per frame, so it stays
 * cheap on mobile while the number spins continuously like rugs.fun.
 */
export function SmoothMultiplier({
  value,
  running,
  active = true,
  className,
  style,
}: {
  value: number;
  /** When false (crashed/waiting) the value snaps instantly instead of easing. */
  running: boolean;
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef(value);
  const runningRef = useRef(running);
  const shownRef = useRef(value);
  targetRef.current = value;
  runningRef.current = running;
  const pageActive = usePageVisibility(active);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const write = (v: number) => {
      el.textContent = `${v.toFixed(2)}x`;
    };

    if (!pageActive) {
      shownRef.current = targetRef.current;
      write(shownRef.current);
      return;
    }

    const LERP_PER_SEC = 12;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const target = targetRef.current;
      if (!runningRef.current || Math.abs(target - shownRef.current) > 1.5) {
        shownRef.current = target;
      } else {
        shownRef.current += (target - shownRef.current) * Math.min(1, LERP_PER_SEC * dt);
      }
      write(shownRef.current);
      raf = requestAnimationFrame(loop);
    };
    write(shownRef.current);
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pageActive]);

  return (
    <div ref={elRef} className={className} style={style}>
      {`${value.toFixed(2)}x`}
    </div>
  );
}
