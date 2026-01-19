-- Script d'initialisation de la base de données
-- À exécuter une fois après avoir créé la base de données sur Netlify

-- Ce fichier contient les mêmes commandes que schema.sql
-- mais peut être exécuté manuellement depuis l'interface Netlify

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

-- Table des sessions
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(36) PRIMARY KEY,
  capitals JSONB NOT NULL,
  start_time BIGINT NOT NULL,
  used BOOLEAN DEFAULT FALSE,
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
