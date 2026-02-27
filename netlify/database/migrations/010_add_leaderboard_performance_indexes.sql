-- Migration 010: Add indexes for leaderboard query performance.

-- idx_scores_leaderboard: enables efficient PARTITION BY pseudo in the leaderboard CTE
--   (Postgres groups by (game_type, pseudo) and reads the best row without a sort pass)
CREATE INDEX IF NOT EXISTS idx_scores_leaderboard
  ON scores(game_type, pseudo, score DESC, time ASC);

-- idx_scores_daily_lookup: efficient timestamp range filter for daily leaderboard queries
--   (replaces single-column index intersection on game_type + timestamp)
CREATE INDEX IF NOT EXISTS idx_scores_daily_lookup
  ON scores(game_type, timestamp);
