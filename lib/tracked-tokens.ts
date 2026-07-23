export interface TrackedToken {
  symbol: string;
  name: string;
  mint?: string;
  searchQuery?: string;
}

export const TRACKED_TOKENS: TrackedToken[] = [
  { symbol: 'BONK', name: 'Bonk', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'FARTCOIN', name: 'Fartcoin', mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { symbol: 'GIGA', name: 'Gigachad', mint: '63LfDmNb3MQ8mw9MtZ2To9bEa2m71kzuugq5tijxcqj9' },
  { symbol: 'MOODENG', name: 'Moo Deng', mint: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY' },
  { symbol: 'ANSEM', name: 'Ansem', mint: '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump' },
  { symbol: 'CASHCAT', name: 'Cash Cat', mint: 'CashcatZMRn4Jv8sPQZUSsbTLi2PcPe1ssqbHcnaJqSS' },
  { symbol: '$BlackBalls', name: 'Blackballs', searchQuery: 'blackballs' },
];
