export type Phase = 'waiting' | 'running' | 'crashed';

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  t: number;
}

export interface TradeTag {
  id: number;
  user: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  t: number;
  /** Elapsed-time anchor of the candle when the trade fired (for chart X positioning). */
  candleT?: number;
}

export interface FeedEvent {
  id: number;
  user: string;
  kind: 'buy' | 'sell' | 'cashout' | 'rug';
  amount: number;
  price: number;
  delta: number;
  t: number;
}

export interface RoundSummary {
  id: number;
  crashPoint: number;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed?: string;
  nonce?: number;
  instantRug?: boolean;
  ts: number;
}

export interface FullState {
  phase: Phase;
  gameId: number;
  mult: number;
  peakMult: number;
  elapsed: number;
  candles: Candle[];
  waitLeft: number;
  history: RoundSummary[];
  feed: FeedEvent[];
  tradeTags: TradeTag[];
  currentRound: {
    id: number;
    serverSeedHash: string;
    serverSeed: string | null;
    clientSeed: string;
    nonce: number;
    crashPoint: number | null;
  };
  players: number;
  buyersIn: number;
  roundBuyVolume: number;
  roundSellVolume: number;
  orderPressure: number;
  hasPosition: boolean;
  positionSide: 'buy' | 'sell';
  positionAmount: number;
  positionLeverage: number;
  positionEntryPrice: number;
  balance: number;
  lastResult: { won: boolean; amount: number; price: number; bonusAmount?: number; frenzyProc?: boolean } | null;
  autoSell: number | null;
}
