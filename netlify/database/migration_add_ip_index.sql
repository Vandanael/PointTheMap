-- Migration: Add index on IP column to optimize pseudo lock checks
-- Date: 2024

CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores(ip);
