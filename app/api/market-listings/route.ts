import { NextResponse } from 'next/server';
import { MAJOR_COINS } from '@/lib/major-coins';
import type { MarketListing } from '@/lib/market-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let cache: { listings: MarketListing[]; ts: number } | null = null;
const CACHE_TTL_MS = 15_000;

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { listings: cache.listings, ts: cache.ts },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const ids = MAJOR_COINS.map(c => c.id).join(',');
  let listings: MarketListing[] = [];

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=25&sparkline=false&price_change_percentage=24h`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 0 },
      },
    );
    if (!res.ok) throw new Error(`coingecko ${res.status}`);
    const rows = (await res.json()) as Array<{
      id: string;
      symbol: string;
      name: string;
      current_price: number;
      price_change_percentage_24h: number | null;
      total_volume: number;
      market_cap: number;
      image?: string;
    }>;

    const byId = new Map(rows.map(r => [r.id, r]));
    listings = MAJOR_COINS.map(coin => {
      const row = byId.get(coin.id);
      return {
        symbol: coin.symbol,
        name: coin.name,
        price: row?.current_price ?? 0,
        priceChange24h: row?.price_change_percentage_24h ?? 0,
        volume24h: row?.total_volume ?? 0,
        marketCap: row?.market_cap ?? 0,
        liquidity: row?.market_cap ?? 0,
        logoUrl: row?.image || coin.logoUrl,
      };
    });
  } catch {
    // Soft fallback — logos still show; prices may be 0 until next poll
    listings = MAJOR_COINS.map(coin => ({
      symbol: coin.symbol,
      name: coin.name,
      price: 0,
      priceChange24h: 0,
      volume24h: 0,
      marketCap: 0,
      liquidity: 0,
      logoUrl: coin.logoUrl,
    }));
  }

  cache = { listings, ts: now };
  return NextResponse.json(
    { listings, ts: now },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
