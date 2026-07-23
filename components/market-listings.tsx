'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useMarketListings } from '@/hooks/use-market-listings';
import { useMounted } from '@/hooks/use-mounted';
import { formatPrice, formatMarketCap, generatePlaceholderLogo, type MarketListing } from '@/lib/market-types';

export function MarketListings() {
  const { listings, loading, lastOk, lastUpdate } = useMarketListings();
  const mounted = useMounted();
  const [ageSec, setAgeSec] = useState<number | null>(null);

  useEffect(() => {
    if (!mounted || !lastUpdate) {
      setAgeSec(null);
      return;
    }
    const tick = () => setAgeSec(Math.floor((Date.now() - lastUpdate) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mounted, lastUpdate]);

  const status = loading
    ? 'SYNCING...'
    : lastOk === false
      ? 'OFFLINE'
      : mounted && ageSec != null
        ? `${ageSec}s`
        : '--';

  return (
    <div className="cp-panel p-3 font-mono hud-corners">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] neon-cyan">LIVE_MARKET</span>
          <span className={`w-1.5 h-1.5 rounded-full ${lastOk === false ? 'bg-cp-magenta' : 'bg-cp-green cp-pulse'}`} />
        </div>
        <span className="text-[8px] text-white/30" suppressHydrationWarning>
          {status}
        </span>
      </div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {loading && listings.length === 0 && <div className="text-[10px] text-white/30 py-4 text-center">// FETCHING_DEX_DATA...</div>}
        {!loading && listings.length === 0 && (
          <div className="text-[10px] text-cp-magenta/80 py-4 text-center">UNABLE_TO_LOAD_PRICES — RETRYING...</div>
        )}
        <AnimatePresence>
          {listings.map(l => (
            <MarketCard key={l.symbol} listing={l} />
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 pt-2 border-t border-cp-cyan/10 text-[8px] text-white/25 text-center">VIA DEXSCREENER · 12s POLL</div>
    </div>
  );
}

function MarketCard({ listing: l }: { listing: MarketListing }) {
  const up = l.priceChange24h >= 0;
  const [imgOk, setImgOk] = useState(true);
  const logoSrc = imgOk ? l.logoUrl : generatePlaceholderLogo(l.symbol);
  const hot = l.priceChange24h >= 10;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-1.5 bg-black/30 border border-cp-cyan/10 hover:border-cp-cyan/30 transition-colors">
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        <img src={logoSrc} alt={l.symbol} width={28} height={28} className="rounded-full" onError={() => setImgOk(false)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] font-bold text-white/90">${l.symbol}</span>
          <span className={`text-[9px] font-bold ${up ? 'text-cp-green' : 'text-cp-magenta'}`}>
            {up ? '+' : ''}
            {l.priceChange24h.toFixed(2)}%
          </span>
          {hot && (
            <span className="text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-cp-magenta/15 text-cp-magenta border border-cp-magenta/30">
              HOT
            </span>
          )}
        </div>
        <div className="text-[9px] text-white/40">
          {formatPrice(l.price)} · MC {formatMarketCap(l.marketCap)}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[8px] text-white/30">VOL24</div>
        <div className="text-[9px] text-cp-cyan font-bold">{formatMarketCap(l.volume24h)}</div>
      </div>
    </motion.div>
  );
}
