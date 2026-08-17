export type LeaderboardEntry = {
  rank: number;
  address: string;
  display: string;
  points: number;
  scoredRounds: number;
  wins: number;
  bestMultiplier: number;
  roundsPlayed: number;
  isYou?: boolean;
};

export type LeaderboardPayload = {
  periodId: string;
  startsAt: string;
  endsAt: string;
  frozen: boolean;
  remainingMs: number;
  entries: LeaderboardEntry[];
  you: LeaderboardEntry | null;
  scoredRoundsCap: number;
};
