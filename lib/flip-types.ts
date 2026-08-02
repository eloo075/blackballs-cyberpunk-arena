import type { FlipSide } from './flip-engine';

export type FlipMode = '1v1' | 'dogpile';
export type FlipPhase = 'idle' | 'waiting' | 'flipping' | 'done';

export interface FlipParticipant {
  address: string;
  display: string;
  amount: number;
  message?: string;
  holdsBlackballs?: boolean;
}

export interface Flip1v1Match {
  id: string;
  wager: number;
  creator: FlipParticipant;
  creatorSide: FlipSide;
  opponent?: FlipParticipant;
  opponentSide?: FlipSide;
  status: FlipPhase;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  result?: FlipSide;
  winner?: string;
  createdAt: number;
  flipStartedAt?: number;
  isBot?: boolean;
}

export interface DogpilePot {
  id: string;
  round: number;
  heads: FlipParticipant[];
  tails: FlipParticipant[];
  headsTotal: number;
  tailsTotal: number;
  status: FlipPhase;
  endsAt: number;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  result?: FlipSide;
  flipStartedAt?: number;
}

export interface FlipHistoryEntry {
  id: string;
  mode: FlipMode;
  result: FlipSide;
  totalPot: number;
  rake: number;
  winnerDisplay: string;
  profit: number;
  wager: number;
  ts: number;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  highlight?: boolean;
}

export interface FlipFeedEvent {
  id: number;
  kind: 'join' | 'flip' | 'win' | 'taunt' | 'dogpile';
  player: string;
  text: string;
  amount?: number;
  ts: number;
  highlight?: boolean;
}

export interface FlipPlayerView {
  balance: number;
  holdsBlackballs: boolean;
  rakeRate: number;
  maxBet: number;
  winStreak: number;
  lossStreak: number;
  lastOpponent: string | null;
  active1v1Id: string | null;
  activeDogpileSide: FlipSide | null;
  lastResult: {
    won: boolean;
    profit: number;
    side: FlipSide;
    result: FlipSide;
  } | null;
}

export interface FlipFullState {
  mode: FlipMode;
  open1v1: Flip1v1Match[];
  active1v1: Flip1v1Match | null;
  dogpile: DogpilePot;
  history: FlipHistoryEntry[];
  feed: FlipFeedEvent[];
  hallOfFame: FlipHistoryEntry[];
  player: FlipPlayerView | null;
}
