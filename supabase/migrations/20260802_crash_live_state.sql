-- Shared crash engine + player state for Vercel multi-instance sync.

CREATE TABLE IF NOT EXISTS crash_engine_snapshot (
  id text PRIMARY KEY DEFAULT 'live',
  game_id int NOT NULL,
  phase text NOT NULL,
  wait_left numeric NOT NULL DEFAULT 0,
  elapsed numeric NOT NULL DEFAULT 0,
  mult numeric NOT NULL DEFAULT 1.0,
  peak_mult numeric NOT NULL DEFAULT 1.0,
  last_settled_round_id int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crash_player_state (
  address text PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0,
  has_position boolean NOT NULL DEFAULT false,
  entry_pending boolean NOT NULL DEFAULT false,
  position_side text NOT NULL DEFAULT 'buy',
  position_amount numeric NOT NULL DEFAULT 0,
  position_leverage numeric NOT NULL DEFAULT 1,
  position_entry_price numeric NOT NULL DEFAULT 1.0,
  position_round_id int,
  pending_side text,
  pending_amount numeric,
  pending_leverage numeric,
  pending_round_id int,
  auto_sell numeric,
  stimmy numeric NOT NULL DEFAULT 0,
  frenzy numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crash_player_state_updated_at_idx
  ON crash_player_state (updated_at DESC);

ALTER TABLE crash_engine_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_player_state ENABLE ROW LEVEL SECURITY;

-- Service role only (server-side game engine).
-- No anon policies — clients never read/write these tables directly.
