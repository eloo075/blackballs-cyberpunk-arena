-- Demo-with-real-rewards: wallet-keyed play-money accounts + weekly prize board.
-- Credits never leave this schema. Prize tokens are paid off-platform after review.
-- Anon/authenticated have zero row access (service_role only), same as launch_campaign_entries.

-- ---------------------------------------------------------------------------
-- 1. Extend crash_player_state into a persistent wallet account
-- ---------------------------------------------------------------------------
ALTER TABLE crash_player_state
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_refill_at timestamptz,
  ADD COLUMN IF NOT EXISTS rounds_played int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wins int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_multiplier numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_points numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_ip text,
  ADD COLUMN IF NOT EXISTS last_ip text,
  ADD COLUMN IF NOT EXISTS last_user_agent text;

CREATE INDEX IF NOT EXISTS crash_player_state_last_seen_idx
  ON crash_player_state (last_seen DESC);

-- ---------------------------------------------------------------------------
-- 2. Settled round records (leaderboard source of truth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crash_settled_rounds (
  id bigserial PRIMARY KEY,
  period_id text NOT NULL,
  game_id int NOT NULL,
  address text NOT NULL,
  won boolean NOT NULL DEFAULT false,
  stake numeric NOT NULL DEFAULT 0,
  pnl numeric NOT NULL DEFAULT 0,
  exit_multiplier numeric,
  crash_multiplier numeric,
  round_score numeric NOT NULL DEFAULT 0,
  finalized boolean NOT NULL DEFAULT false,
  settled_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  UNIQUE (period_id, game_id, address)
);

CREATE INDEX IF NOT EXISTS crash_settled_rounds_period_addr_idx
  ON crash_settled_rounds (period_id, address);

CREATE INDEX IF NOT EXISTS crash_settled_rounds_period_score_idx
  ON crash_settled_rounds (period_id, round_score DESC);

-- ---------------------------------------------------------------------------
-- 3. Weekly periods + snapshotted standings (no auto-payout)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crash_leaderboard_periods (
  period_id text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  frozen boolean NOT NULL DEFAULT false,
  snapshot_at timestamptz
);

CREATE TABLE IF NOT EXISTS crash_leaderboard_standings (
  period_id text NOT NULL REFERENCES crash_leaderboard_periods (period_id),
  address text NOT NULL,
  rank int,
  points numeric NOT NULL DEFAULT 0,
  scored_rounds int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  best_multiplier numeric NOT NULL DEFAULT 0,
  rounds_played int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_id, address)
);

CREATE INDEX IF NOT EXISTS crash_leaderboard_standings_rank_idx
  ON crash_leaderboard_standings (period_id, points DESC, best_multiplier DESC);

-- ---------------------------------------------------------------------------
-- 4. New-account IP rate limit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crash_signup_ip (
  ip text NOT NULL,
  day date NOT NULL,
  created_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, day)
);

-- ---------------------------------------------------------------------------
-- 5. RLS — browser anon key cannot read or write any of these tables
-- ---------------------------------------------------------------------------
ALTER TABLE crash_engine_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_engine_snapshot FORCE ROW LEVEL SECURITY;
ALTER TABLE crash_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_player_state FORCE ROW LEVEL SECURITY;
ALTER TABLE crash_settled_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_settled_rounds FORCE ROW LEVEL SECURITY;
ALTER TABLE crash_leaderboard_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_leaderboard_periods FORCE ROW LEVEL SECURITY;
ALTER TABLE crash_leaderboard_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_leaderboard_standings FORCE ROW LEVEL SECURITY;
ALTER TABLE crash_signup_ip ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_signup_ip FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE crash_engine_snapshot FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE crash_player_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE crash_settled_rounds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE crash_leaderboard_periods FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE crash_leaderboard_standings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE crash_signup_ip FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE crash_engine_snapshot TO service_role;
GRANT ALL ON TABLE crash_player_state TO service_role;
GRANT ALL ON TABLE crash_settled_rounds TO service_role;
GRANT ALL ON TABLE crash_leaderboard_periods TO service_role;
GRANT ALL ON TABLE crash_leaderboard_standings TO service_role;
GRANT ALL ON TABLE crash_signup_ip TO service_role;
GRANT USAGE, SELECT ON SEQUENCE crash_settled_rounds_id_seq TO service_role;
