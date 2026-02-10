-- Schema for PointTheMap
-- Tables for scores, sessions, and rate limits

-- Anonymous players table
CREATE TABLE IF NOT EXISTS players (
  player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_games INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_players_last_seen ON players(last_seen);

-- Scores table (leaderboard)
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  pseudo VARCHAR(5) NOT NULL,
  score INTEGER NOT NULL,
  time INTEGER NOT NULL,
  rounds JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  game_type VARCHAR(20) NOT NULL DEFAULT 'classic',
  session_token VARCHAR(36),
  ip VARCHAR(45),
  player_id UUID REFERENCES players(player_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores(timestamp);
CREATE INDEX IF NOT EXISTS idx_scores_game_type ON scores(game_type);
CREATE INDEX IF NOT EXISTS idx_scores_pseudo ON scores(pseudo);
CREATE INDEX IF NOT EXISTS idx_scores_session_token ON scores(session_token);

-- Composite index for rank calculation (critical optimization)
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores(game_type, score DESC, time ASC);

-- Index for IP checks (pseudo lock)
CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores(ip);
CREATE INDEX IF NOT EXISTS idx_scores_player_id ON scores(player_id);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(36) PRIMARY KEY,
  targets JSONB NOT NULL,
  start_time BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  game_type VARCHAR(20) DEFAULT 'classic',
  csrf_token VARCHAR(36),
  player_id UUID REFERENCES players(player_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_csrf_token ON sessions(csrf_token);
CREATE INDEX IF NOT EXISTS idx_sessions_player_id ON sessions(player_id);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(100) PRIMARY KEY,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Index to clean up old entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
