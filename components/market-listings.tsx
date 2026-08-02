'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useMarketListings } from '@/hooks/use-market-listings';
import { formatPrice, formatMarketCap, generatePlaceholderLogo, type MarketListing } from '@/lib/market-types';

export function MarketListings() {
  const { listings, loading } = useMarketListings();

  return (
    <div className="bg-[#1f2025] border border-white/5 rounded-2xl p-4 font-arcade overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="text-sm font-extrabold text-white/90">Live Market</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-bold text-emerald-400">
            Live
          </span>
        </div>
      </div>
      <p className="text-[10px] text-white/35 font-bold mb-3">Meme coins pumping while you degen · DexScreener feed</p>

      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
        {loading && listings.length === 0 && (
          <div className="text-xs text-white/35 py-6 text-center font-bold">Fetching the charts… hang tight 🫡</div>
        )}
        {!loading && listings.length === 0 && (
          <div className="flex justify-center py-4">
            <span className="inline-block bg-white/5 text-white/45 border border-white/10 px-3 py-2 rounded-xl text-xs font-semibold">
              Fetching prices…
            </span>
          </div>
        )}
        <AnimatePresence>
          {listings.map(l => (
            <MarketCard key={l.symbol} listing={l} />
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-3 pt-3 border-t border-white/5 text-[10px] text-white/30 text-center font-bold">
        via DexScreener · refreshes every 12s
      </div>
    </div>
  );
}

function MarketCard({ listing: l }: { listing: MarketListing }) {
  const up = l.priceChange24h >= 0;
  const [imgOk, setImgOk] = useState(true);
  const logoSrc = imgOk ? l.logoUrl : generatePlaceholderLogo(l.symbol);
  const hot = l.priceChange24h >= 10;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#25262c] border border-white/5 hover:border-white/10 transition-colors"
    >
      <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden bg-[#2a2c33] border border-white/10 flex items-center justify-center">
        <img
          src={logoSrc}
          alt={l.symbol}
          width={32}
          height={32}
          className="w-8 h-8 rounded-full object-cover"
          onError={() => setImgOk(false)}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-extrabold text-white">${l.symbol}</span>
          <span className={`text-[10px] font-extrabold tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {up ? '+' : ''}
            {l.priceChange24h.toFixed(2)}%
          </span>
          {hot && (
            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
              HOT
            </span>
          )}
        </div>
        <div className="text-[10px] text-white/40 font-bold mt-0.5">
          {formatPrice(l.price)} · MC {formatMarketCap(l.marketCap)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[9px] text-white/35 font-extrabold uppercase">Vol 24h</div>
        <div className="text-[10px] text-sky-400 font-extrabold tabular-nums">{formatMarketCap(l.volume24h)}</div>
      </div>
    </motion.div>
  );
}
