/*
# BlackBalls — viral referrals & clans

1. Profiles
   Wallet-centric player records with auto-generated referral codes and optional
   referrer binding (blackballs.site?ref=CODE).

2. Referral rewards
   Rakeback ledger when referred players wager (5–10% of house rake).

3. Clans
   Guild tables for XP aggregation and wager volume leaderboards.
*/

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

CREATE TABLE IF NOT EXISTS profiles (
  wallet_address text PRIMARY KEY,
  referral_code text NOT NULL,
  referred_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_referral_code_unique UNIQUE (referral_code),
  CONSTRAINT profiles_referred_by_format CHECK (
    referred_by IS NULL OR referred_by ~* '^0x[a-f0-9]{40}$'
  ),
  CONSTRAINT profiles_wallet_format CHECK (wallet_address ~* '^0x[a-f0-9]{40}$')
);

CREATE OR REPLACE FUNCTION profiles_assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    LOOP
      NEW.referral_code := generate_referral_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.referral_code = NEW.referral_code
      );
    END LOOP;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_referral_code_trigger ON profiles;
CREATE TRIGGER profiles_referral_code_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_assign_referral_code();

CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON profiles (referred_by);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_address text NOT NULL,
  player_address text NOT NULL,
  wager_amount numeric NOT NULL CHECK (wager_amount >= 0),
  rakeback_amount numeric NOT NULL CHECK (rakeback_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_rewards_referrer_format CHECK (referrer_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT referral_rewards_player_format CHECK (player_address ~* '^0x[a-f0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx
  ON referral_rewards (referrer_address, created_at DESC);

CREATE INDEX IF NOT EXISTS referral_rewards_player_idx
  ON referral_rewards (player_address, created_at DESC);

CREATE TABLE IF NOT EXISTS clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  leader_address text NOT NULL,
  total_xp bigint NOT NULL DEFAULT 0,
  total_wager_volume numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clans_tag_unique UNIQUE (tag),
  CONSTRAINT clans_leader_format CHECK (leader_address ~* '^0x[a-f0-9]{40}$')
);

CREATE INDEX IF NOT EXISTS clans_total_xp_idx ON clans (total_xp DESC);
CREATE INDEX IF NOT EXISTS clans_wager_volume_idx ON clans (total_wager_volume DESC);

CREATE TABLE IF NOT EXISTS clan_members (
  clan_id uuid NOT NULL REFERENCES clans (id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, wallet_address),
  CONSTRAINT clan_members_wallet_format CHECK (wallet_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT clan_members_role_check CHECK (role IN ('leader', 'officer', 'member'))
);

CREATE INDEX IF NOT EXISTS clan_members_wallet_idx ON clan_members (wallet_address);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE clans ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_profiles" ON profiles;
CREATE POLICY "public_select_profiles" ON profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_select_referral_rewards" ON referral_rewards;
CREATE POLICY "public_select_referral_rewards" ON referral_rewards
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_select_clans" ON clans;
CREATE POLICY "public_select_clans" ON clans
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_select_clan_members" ON clan_members;
CREATE POLICY "public_select_clan_members" ON clan_members
  FOR SELECT TO anon, authenticated USING (true);

-- Writes via service role only (API routes).
