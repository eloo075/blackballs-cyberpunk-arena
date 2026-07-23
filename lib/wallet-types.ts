export interface TokenHoldings {
  blackballs: number;
  ansem: number;
  cashcat: number;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  solBalance: number;
  blackballsBalance: number;
  ansemBalance: number;
  cashcatBalance: number;
  airdropped?: boolean;
  airdropRank?: number | null;
  xp: number;
  rank: string;
  isRealWallet: boolean;
}

export const WALLET_STORAGE_KEY = 'cp_wallet';
export const RANKS = ['NPC', 'DEGEN', 'CHAD', 'WHALE', 'LEGEND'] as const;

export const DEFAULT_HOLDINGS: TokenHoldings = {
  blackballs: 0,
  ansem: 0,
  cashcat: 0,
};

export const DEFAULT_WALLET: WalletState = {
  connected: false,
  address: null,
  solBalance: 0,
  blackballsBalance: 0,
  ansemBalance: 0,
  cashcatBalance: 0,
  airdropped: false,
  airdropRank: null,
  xp: 0,
  rank: 'NPC',
  isRealWallet: false,
};

export function walletHoldings(wallet: WalletState): TokenHoldings {
  return {
    blackballs: wallet.blackballsBalance,
    ansem: wallet.ansemBalance,
    cashcat: wallet.cashcatBalance,
  };
}
