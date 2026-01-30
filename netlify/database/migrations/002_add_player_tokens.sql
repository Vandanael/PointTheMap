-- Migration 002: Add player tokens system
-- This migration creates the players table and adds player_id to scores

-- Create players table to track anonymous players
CREATE TABLE IF NOT EXISTS players (
  player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_games INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0
);

-- Add player_id column to scores table
ALTER TABLE scores ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(player_id);

-- Add player_id column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(player_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scores_player_id ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen);

-- Add comment for documentation
COMMENT ON TABLE players IS 'Tracks anonymous players using JWT tokens';
COMMENT ON COLUMN scores.player_id IS 'Links score to anonymous player (JWT-based)';
COMMENT ON COLUMN sessions.player_id IS 'Links session to anonymous player';
