-- Schema pour PointTheMap
-- Tables pour les scores, sessions et rate limits

-- Table des scores (leaderboard)
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  pseudo VARCHAR(5) NOT NULL,
  score INTEGER NOT NULL,
  time INTEGER NOT NULL,
  rounds JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  game_type VARCHAR(10) NOT NULL DEFAULT 'classic',
  ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_timestamp ON scores(timestamp);
CREATE INDEX IF NOT EXISTS idx_scores_game_type ON scores(game_type);
CREATE INDEX IF NOT EXISTS idx_scores_pseudo ON scores(pseudo);

-- Index composite pour le calcul de rank (optimisation critique)
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores(game_type, score DESC, time ASC);

-- Index composite pour le leaderboard
CREATE INDEX IF NOT EXISTS idx_scores_leaderboard ON scores(game_type, score DESC, time ASC);

-- Index pour la vérification IP (pseudo lock)
CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores(ip);

-- Table des sessions
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(36) PRIMARY KEY,
  capitals JSONB NOT NULL,
  start_time BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  game_type VARCHAR(10) DEFAULT 'classic',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Index pour les sessions
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Table pour rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(100) PRIMARY KEY,
  count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Index pour nettoyer les anciennes entrées
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON rate_limits(expires_at);
