-- Migration 007: Add session_token to scores for auditability

ALTER TABLE scores ADD COLUMN IF NOT EXISTS session_token VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_scores_session_token ON scores(session_token);
