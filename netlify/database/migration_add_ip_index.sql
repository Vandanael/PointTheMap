-- Migration: Ajout index sur colonne IP pour optimisation vérification pseudo lock
-- Date: 2024

CREATE INDEX IF NOT EXISTS idx_scores_ip ON scores(ip);
