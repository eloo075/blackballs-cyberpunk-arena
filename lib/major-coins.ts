/** Robinhood-style majors for the Crash live market panel. */
export interface MajorCoin {
  id: string;
  symbol: string;
  name: string;
  /** Official CoinGecko CDN logo */
  logoUrl: string;
}

export const MAJOR_COINS: MajorCoin[] = [
  {
    id: 'robinhood-xstock',
    symbol: 'HOOD',
    name: 'Robinhood',
    logoUrl:
      'https://coin-images.coingecko.com/coins/images/55613/small/Ticker_HOOD__Company_Name_Robinhood__size_200x200_2x.png',
  },
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    logoUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  },
  {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    id: 'solana',
    symbol: 'SOL',
    name: 'Solana',
    logoUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  },
  {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'BNB',
    logoUrl: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  },
  {
    id: 'ripple',
    symbol: 'XRP',
    name: 'XRP',
    logoUrl: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  },
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    logoUrl: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  },
];
