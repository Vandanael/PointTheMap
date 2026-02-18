-- Migration 009: Enforce submit idempotency and core integrity constraints.

-- Backfill missing session tokens for historical rows.
UPDATE scores
SET session_token = 'legacy-' || id::text
WHERE session_token IS NULL;

-- Deduplicate by session_token, keep earliest row.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY session_token ORDER BY id ASC) AS rn
  FROM scores
)
DELETE FROM scores s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Hard idempotency: one score per session token.
ALTER TABLE scores
  ALTER COLUMN session_token SET NOT NULL;

ALTER TABLE scores
  DROP CONSTRAINT IF EXISTS scores_session_token_unique;

ALTER TABLE scores
  ADD CONSTRAINT scores_session_token_unique UNIQUE (session_token);

-- Core invariants.
ALTER TABLE scores
  DROP CONSTRAINT IF EXISTS scores_pseudo_format_check,
  DROP CONSTRAINT IF EXISTS scores_nonnegative_score_check,
  DROP CONSTRAINT IF EXISTS scores_nonnegative_time_check,
  DROP CONSTRAINT IF EXISTS scores_game_type_check;

ALTER TABLE scores
  ADD CONSTRAINT scores_pseudo_format_check CHECK (pseudo ~ '^[A-Z]{3,5}$'),
  ADD CONSTRAINT scores_nonnegative_score_check CHECK (score >= 0),
  ADD CONSTRAINT scores_nonnegative_time_check CHECK (time >= 0),
  ADD CONSTRAINT scores_game_type_check CHECK (
    game_type IN (
      'classic',
      'daily',
      'country',
      'country_daily',
      'stadium',
      'stadium_daily',
      'civilization',
      'civilization_daily'
    )
  );
