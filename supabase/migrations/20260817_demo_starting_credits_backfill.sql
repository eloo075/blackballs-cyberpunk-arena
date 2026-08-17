-- Recover wallets that connected before starting credits were granted
-- (SSE minted a 0-balance player, then persist overwrote the insert).
-- Never-played empty rows get DEMO_STARTING_BB. Played-out 0 rows use /refill.

ALTER TABLE crash_player_state
  ALTER COLUMN balance SET DEFAULT 10000;

UPDATE crash_player_state
SET
  balance = 10000,
  last_refill_at = NULL
WHERE COALESCE(balance, 0) <= 0
  AND COALESCE(has_position, false) IS NOT TRUE
  AND COALESCE(entry_pending, false) IS NOT TRUE
  AND COALESCE(rounds_played, 0) = 0;
