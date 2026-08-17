export type CrashPlaySettlement = {
  address: string;
  gameId: number;
  kind: 'cashout' | 'rug';
  stake: number;
  pnl: number;
  exitMult: number;
  crashMult: number | null;
  finalized: boolean;
  balanceAfter: number;
};
