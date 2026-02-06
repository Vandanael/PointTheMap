-- Migration: Expand game_type column from VARCHAR(10) to VARCHAR(20)
-- Date: 2026-02-06
-- Description: VARCHAR(10) is too short for "civilization" (12 chars), causing INSERT failures

ALTER TABLE sessions ALTER COLUMN game_type TYPE VARCHAR(20);
ALTER TABLE scores ALTER COLUMN game_type TYPE VARCHAR(20);
