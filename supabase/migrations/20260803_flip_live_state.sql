-- Shared flip engine + player state for Vercel multi-instance sync.

CREATE TABLE IF NOT EXISTS flip_engine_snapshot (
  id text PRIMARY KEY DEFAULT 'live',
  match_id int NOT NULL DEFAULT 0,
  open1v1 jsonb NOT NULL DEFAULT '[]'::jsonb,
  active1v1 jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flip_player_state (
  address text PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0,
  holds_blackballs boolean NOT NULL DEFAULT false,
  active1v1_id text,
  active_dogpile_side text,
  win_streak int NOT NULL DEFAULT 0,
  loss_streak int NOT NULL DEFAULT 0,
  last_opponent text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flip_player_state_updated_at_idx
  ON flip_player_state (updated_at DESC);

ALTER TABLE flip_engine_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_player_state ENABLE ROW LEVEL SECURITY;
