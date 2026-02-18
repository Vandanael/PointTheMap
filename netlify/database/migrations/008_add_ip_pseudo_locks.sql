-- Migration 008: Add atomic pseudo lock table (IP -> pseudo)
-- Prevents race conditions when concurrent submissions use different pseudos from same IP.

CREATE TABLE IF NOT EXISTS ip_pseudo_locks (
  ip VARCHAR(45) PRIMARY KEY,
  pseudo VARCHAR(5) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_pseudo_locks_updated_at ON ip_pseudo_locks(updated_at);
