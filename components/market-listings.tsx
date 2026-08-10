'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useMarketListings } from '@/hooks/use-market-listings';
import { formatPrice, formatMarketCap, type MarketListing } from '@/lib/market-types';

export function MarketListings() {
  const { listings, loading } = useMarketListings();

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#12141a] p-3.5 font-arcade overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/70">
            Markets
          </span>
        </div>
        <span className="text-[9px] font-bold text-white/30 uppercase tracking-wide">Live</span>
      </div>

      <div className="space-y-1">
        {loading && listings.length === 0 && (
          <div className="text-[11px] text-white/30 py-8 text-center font-bold">Loading…</div>
        )}
        <AnimatePresence initial={false}>
          {listings.map(l => (
            <MajorCoinRow key={l.symbol} listing={l} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MajorCoinRow({ listing: l }: { listing: MarketListing }) {
  const up = l.priceChange24h >= 0;
  const [imgOk, setImgOk] = useState(true);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-colors"
    >
      <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden bg-[#1a1d24] flex items-center justify-center">
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.logoUrl}
            alt={l.symbol}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <span className="text-[10px] font-black text-white/50">{l.symbol.slice(0, 3)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-extrabold text-white tracking-wide">{l.symbol}</div>
        <div className="text-[10px] text-white/35 font-bold truncate">{l.name}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[12px] font-extrabold text-white tabular-nums">
          {l.price > 0 ? formatPrice(l.price) : '—'}
        </div>
        <div
          className={`text-[10px] font-extrabold tabular-nums ${
            up ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {l.price > 0
            ? `${up ? '+' : ''}${l.priceChange24h.toFixed(2)}%`
            : '—'}
        </div>
      </div>
      {l.marketCap > 0 && (
        <div className="hidden xl:block text-right shrink-0 w-14">
          <div className="text-[9px] text-white/30 font-bold uppercase">MCap</div>
          <div className="text-[10px] text-white/50 font-extrabold tabular-nums">
            {formatMarketCap(l.marketCap)}
          </div>
        </div>
      )}
    </motion.div>
  );
}
