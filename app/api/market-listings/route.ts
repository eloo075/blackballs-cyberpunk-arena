import { NextResponse } from 'next/server';
import { TRACKED_TOKENS } from '@/lib/tracked-tokens';
import type { MarketListing } from '@/lib/market-types';
import { generatePlaceholderLogo } from '@/lib/market-types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CacheEntry { data: MarketListing; ts: number; }
const priceCache = new Map<string, CacheEntry>();
const logoCache = new Map<string, string>();
const PRICE_TTL = 10000;
const LOGO_TTL = 3600000;

async function resolveLogo(mint: string, symbol: string, dexLogo?: string | null): Promise<string> {
  const cached = logoCache.get(mint);
  if (cached) return cached;

  if (symbol === 'CASHCAT') {
    const localLogo = '/qxxieJRY.jpg';
    logoCache.set(mint, localLogo);
    return localLogo;
  }

  if (dexLogo && /^https?:\/\//.test(dexLogo)) {
    logoCache.set(mint, dexLogo);
    return dexLogo;
  }

  try {
    const jupRes = await fetch(`https://tokens.jup.ag/token/${mint}`, { signal: AbortSignal.timeout(4000) });
    if (jupRes.ok) {
      const jup = await jupRes.json();
      const img = jup?.image ?? jup?.logoURI;
      if (img && /^https?:\/\//.test(img)) {
        logoCache.set(mint, img);
        return img;
      }
    }
  } catch { /* fall through to placeholder */ }

  const placeholder = generatePlaceholderLogo(symbol);
  logoCache.set(mint, placeholder);
  return placeholder;
}

async function fetchDexscreenerPairData(url: string) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`dexscreener ${res.status}`);
  const json = await res.json();
  const pairs = Array.isArray(json?.pairs) ? json.pairs : Array.isArray(json?.results) ? json.results : [];
  if (!Array.isArray(pairs) || pairs.length === 0) throw new Error('no pairs');
  return pairs;
}

async function fetchToken(token: { symbol: string; name: string; mint?: string; searchQuery?: string }): Promise<MarketListing | null> {
  const now = Date.now();
  const cacheKey = token.mint ?? `${token.searchQuery ?? token.symbol}`;
  const cached = priceCache.get(cacheKey);
  if (cached && now - cached.ts < PRICE_TTL) return cached.data;

  let pairs: any[] = [];
  if (token.mint) {
    try {
      pairs = await fetchDexscreenerPairData(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`);
    } catch (error) {
      if (token.searchQuery) {
        pairs = await fetchDexscreenerPairData(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token.searchQuery)}`);
      } else {
        throw error;
      }
    }
  } else if (token.searchQuery) {
    pairs = await fetchDexscreenerPairData(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token.searchQuery)}`);
  } else {
    throw new Error('missing token identifier');
  }

  const best = pairs
    .filter((p: any) => p?.liquidity?.usd != null)
    .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const pair = best ?? pairs[0];

  const price = parseFloat(pair?.priceUsd ?? '0') || 0;
  const priceChange24h = parseFloat(pair?.priceChange?.h24 ?? '0') || 0;
  const volume24h = parseFloat(pair?.volume?.h24 ?? '0') || 0;
  const marketCap = parseFloat(pair?.marketCap ?? pair?.fdv ?? '0') || 0;
  const liquidity = parseFloat(pair?.liquidity?.usd ?? '0') || 0;
  const dexLogo = pair?.info?.imageUrl ?? pair?.token?.logoURI ?? null;

  const logoUrl = await resolveLogo(cacheKey, token.symbol, dexLogo);

  const listing: MarketListing = {
    symbol: token.symbol,
    name: token.name,
    price,
    priceChange24h,
    volume24h,
    marketCap,
    liquidity,
    logoUrl,
  };

  priceCache.set(cacheKey, { data: listing, ts: now });
  return listing;
}

export async function GET() {
  const results: MarketListing[] = [];
  await Promise.all(
    TRACKED_TOKENS.map(async (t) => {
      try {
        const listing = await fetchToken(t);
        if (listing) results.push(listing);
      } catch {
        /* graceful per-token failure */
      }
    })
  );
  results.sort((a, b) => b.liquidity - a.liquidity);
  return NextResponse.json({ listings: results, ts: Date.now() }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
