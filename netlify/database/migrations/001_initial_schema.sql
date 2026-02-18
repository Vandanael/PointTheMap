-- Migration 001: Initial schema
-- Applied: project inception
-- Creates the base tables for players, scores, sessions, and rate limits.
-- NOTE: game_type was VARCHAR(10) in the original schema. This was later widened
-- to VARCHAR(20) in migration 002 to accommodate 'civilization' (12 chars).

CREATE TABLE IF NOT EXISTS players (
  player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_games INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  pseudo VARCHAR(5) NOT NULL,
  score INTEGER NOT NULL,
  time INTEGER NOT NULL,
  rounds JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  game_type VARCHAR(10) NOT NULL DEFAULT 'classic',
  session_token VARCHAR(36),
  ip VARCHAR(45),
  player_id UUID REFERENCES players(player_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores(timestamp);
CREATE INDEX IF NOT EXISTS idx_scores_game_type ON scores(game_type);
CREATE INDEX IF NOT EXISTS idx_scores_pseudo ON scores(pseudo);
CREATE INDEX IF NOT EXISTS idx_scores_session_token ON scores(session_token);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores(game_type, score DESC, time ASC);
CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores(ip);
CREATE INDEX IF NOT EXISTS idx_scores_player_id ON scores(player_id);

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(36) PRIMARY KEY,
  targets JSONB NOT NULL,
  start_time BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  game_type VARCHAR(10) DEFAULT 'classic',
  csrf_token VARCHAR(36),
  player_id UUID REFERENCES players(player_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_csrf_token ON sessions(csrf_token);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(100) PRIMARY KEY,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
