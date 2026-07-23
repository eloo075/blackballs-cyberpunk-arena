/*
# BlackBalls Arena — core schema

1. Purpose
   Persist crash round history (for provably-fair verification + "Last 100"
   mini history) and a global leaderboard. This is a single-tenant public beta
   with a mock wallet, so data is intentionally shared/public — there is no
   user sign-in screen in this build.

2. New Tables
   - `crash_rounds`
     - `id`              uuid PK
     - `game_id`         text, unique — short public round id (e.g. "rnd_8f3a")
     - `server_seed_hash` text  — SHA-256 of server seed, published pre-round
     - `server_seed`     text, nullable — revealed after crash for verification
     - `crash_point`     numeric — final multiplier (e.g. 2.37)
     - `status`          text — 'waiting' | 'running' | 'crashed'
     - `started_at`      timestamptz
     - `ended_at`        timestamptz, nullable
     - `created_at`      timestamptz default now()
   - `leaderboard`
     - `id`             uuid PK
     - `username`       text, unique
     - `xp`             bigint default 0
     - `level`          int default 1
     - `wins`           int default 0
     - `best_mult`      numeric default 1.0
     - `blackballs`     numeric default 10000
     - `updated_at`     timestamptz default now()

3. Indexes
   - crash_rounds(game_id) unique
   - crash_rounds(created_at desc) for "Last 100" history
   - leaderboard(xp desc) for ranking

4. Security
   - RLS enabled on both tables.
   - Single-tenant public beta: anon + authenticated may read all rows (the
     round history and leaderboard are intentionally public).
   - Writes are restricted to the service role (server-side round engine +
     leaderboard updates run with the service key from API routes). Anon
     cannot insert/update/delete — the server is authoritative for round
     outcomes and balances.

5. Notes
   - This build uses a mock wallet; balances live in `leaderboard.blackballs`
     keyed by a randomly generated guest username on first visit, stored in a
     cookie on the client. No auth.users foreign key by design.
*/

CREATE TABLE IF NOT EXISTS crash_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text UNIQUE NOT NULL,
  server_seed_hash text NOT NULL,
  server_seed text,
  crash_point numeric NOT NULL DEFAULT 1.0,
  status text NOT NULL DEFAULT 'waiting',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crash_rounds_created_at_idx
  ON crash_rounds (created_at DESC);

CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  xp bigint NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  wins int NOT NULL DEFAULT 0,
  best_mult numeric NOT NULL DEFAULT 1.0,
  blackballs numeric NOT NULL DEFAULT 10000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leaderboard_xp_idx
  ON leaderboard (xp DESC);

ALTER TABLE crash_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Public reads (single-tenant beta, intentionally shared data).
DROP POLICY IF EXISTS "anon_select_crash_rounds" ON crash_rounds;
CREATE POLICY "anon_select_crash_rounds" ON crash_rounds
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_leaderboard" ON leaderboard;
CREATE POLICY "anon_select_leaderboard" ON leaderboard
  FOR SELECT TO anon, authenticated USING (true);

-- Writes restricted to service role (server-side engine).
-- anon role is denied by default when no policy exists, which is what we want.
