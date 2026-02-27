-- Schema for PointTheMap — reference state (post-migration)
-- This file reflects the current target schema after all migrations have been applied.
-- It is NOT a migration script; do not run it against a database that already has tables.
-- Migration history: netlify/database/migrations/
--   001_initial_schema.sql  — base tables with game_type VARCHAR(10)
--   002_add_csrf_token.sql — add csrf_token to sessions
--   003_add_game_type_varchar20.sql — widen game_type to VARCHAR(20) for 'civilization'
--   004_add_player_tokens.sql — add players table and player_id links
--   005_add_error_logs.sql — add error_logs table for monitoring
--   006_rename_sessions_capitals_to_targets.sql — rename sessions.capitals -> sessions.targets
--   007_add_session_token_to_scores.sql — add session_token on scores
--   008_add_ip_pseudo_locks.sql — add atomic pseudo lock table
--   009_submit_idempotency_and_constraints.sql — enforce score/session idempotency and checks
--   010_add_leaderboard_performance_indexes.sql — indexes for leaderboard CTE and daily queries
--
-- Tables: players, scores, sessions, rate_limits, ip_pseudo_locks

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
  session_token VARCHAR(36) NOT NULL,
  ip VARCHAR(45),
  player_id UUID REFERENCES players(player_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT scores_session_token_unique UNIQUE (session_token),
  CONSTRAINT scores_pseudo_format_check CHECK (pseudo ~ '^[A-Z]{3,5}$'),
  CONSTRAINT scores_nonnegative_score_check CHECK (score >= 0),
  CONSTRAINT scores_nonnegative_time_check CHECK (time >= 0),
  CONSTRAINT scores_game_type_check CHECK (
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
  )
);

-- Indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores(timestamp);
CREATE INDEX IF NOT EXISTS idx_scores_game_type ON scores(game_type);
CREATE INDEX IF NOT EXISTS idx_scores_pseudo ON scores(pseudo);
CREATE INDEX IF NOT EXISTS idx_scores_session_token ON scores(session_token);

-- Composite index for rank calculation (critical optimization)
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores(game_type, score DESC, time ASC);

-- Indexes for leaderboard query performance (migration 010)
CREATE INDEX IF NOT EXISTS idx_scores_leaderboard ON scores(game_type, pseudo, score DESC, time ASC);
CREATE INDEX IF NOT EXISTS idx_scores_daily_lookup ON scores(game_type, timestamp);

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

-- Pseudo lock table (one pseudo per IP)
CREATE TABLE IF NOT EXISTS ip_pseudo_locks (
  ip VARCHAR(45) PRIMARY KEY,
  pseudo VARCHAR(5) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_pseudo_locks_updated_at ON ip_pseudo_locks(updated_at);
