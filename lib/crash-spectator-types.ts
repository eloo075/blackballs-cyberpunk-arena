export type CrashSpectatorEventType =
  | 'player_joined'
  | 'cash_out'
  | 'rug'
  | 'liquidation';

export type SpectatorHighlight = 'gold' | 'fame' | 'shame' | null;

export interface CrashSpectatorEvent {
  id: string;
  type: CrashSpectatorEventType;
  player: string;
  amount: number;
  multiplier: number;
  leverage?: number;
  side?: 'buy' | 'sell';
  payout?: number;
  pnl?: number;
  ts: number;
}

export const CRASH_GAME_CHANNEL = 'crash-game';

export function isGoldHighlight(event: CrashSpectatorEvent): boolean {
  return event.multiplier >= 8 || (event.leverage ?? 1) >= 10;
}

export function isHallOfFame(event: CrashSpectatorEvent): boolean {
  if (event.type !== 'cash_out') return false;
  const profit = event.pnl ?? event.payout ?? 0;
  return event.multiplier >= 8 || profit >= 100;
}

export function isHallOfShame(event: CrashSpectatorEvent): boolean {
  return event.type === 'liquidation' && event.multiplier <= 1.01;
}

export function spectatorEventLabel(event: CrashSpectatorEvent): string {
  switch (event.type) {
    case 'player_joined':
      return `${event.side === 'sell' ? 'SHORT' : 'LONG'} ${event.amount.toFixed(2)} BlackBalls`;
    case 'cash_out':
      return `CASHOUT @${event.multiplier.toFixed(2)}x`;
    case 'liquidation':
      return `LIQUIDATED @${event.multiplier.toFixed(2)}x`;
    case 'rug':
      return `RUGGED @${event.multiplier.toFixed(2)}x`;
    default:
      return event.type;
  }
}
