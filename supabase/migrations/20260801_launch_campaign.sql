/*
# Launch campaign — First 500 whitelist

Temporary table for pre-launch wallet registration.
Run in Supabase SQL editor before campaign goes live.
*/

CREATE TABLE IF NOT EXISTS launch_campaign_entries (
  wallet_address text PRIMARY KEY,
  spot_number int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT launch_campaign_wallet_format CHECK (wallet_address ~* '^0x[a-f0-9]{40}$'),
  CONSTRAINT launch_campaign_spot_positive CHECK (spot_number >= 1),
  CONSTRAINT launch_campaign_spot_unique UNIQUE (spot_number)
);

CREATE INDEX IF NOT EXISTS launch_campaign_created_at_idx
  ON launch_campaign_entries (created_at);

CREATE OR REPLACE FUNCTION register_launch_campaign_wallet(p_wallet text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet text;
  v_existing launch_campaign_entries%ROWTYPE;
  v_count int;
  v_spot int;
  v_max int := 500;
BEGIN
  v_wallet := lower(trim(p_wallet));

  IF v_wallet !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid wallet address');
  END IF;

  SELECT * INTO v_existing
  FROM launch_campaign_entries
  WHERE wallet_address = v_wallet;

  IF FOUND THEN
    SELECT count(*)::int INTO v_count FROM launch_campaign_entries;
    RETURN jsonb_build_object(
      'ok', true,
      'alreadyRegistered', true,
      'spotNumber', v_existing.spot_number,
      'totalClaimed', v_count
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('launch_campaign_first_500'));

  SELECT count(*)::int INTO v_count FROM launch_campaign_entries;

  IF v_count >= v_max THEN
    RETURN jsonb_build_object(
      'ok', false,
      'full', true,
      'error', 'All 500 spots are claimed',
      'totalClaimed', v_count
    );
  END IF;

  v_spot := v_count + 1;

  INSERT INTO launch_campaign_entries (wallet_address, spot_number)
  VALUES (v_wallet, v_spot);

  RETURN jsonb_build_object(
    'ok', true,
    'alreadyRegistered', false,
    'spotNumber', v_spot,
    'totalClaimed', v_spot
  );
END;
$$;
