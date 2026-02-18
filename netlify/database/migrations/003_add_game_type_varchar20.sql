-- Migration 003: Widen game_type column to VARCHAR(20)
-- Applied: when civilization mode was added
-- Reason: 'civilization' is 12 characters; VARCHAR(10) caused truncation errors.
-- All existing game type values ('classic', 'daily', 'country', 'country_daily',
-- 'stadium', 'stadium_daily') fit within 10 chars; only 'civilization' (12) and
-- 'civilization_daily' (18) required the wider column.

ALTER TABLE scores ALTER COLUMN game_type TYPE VARCHAR(20);
ALTER TABLE sessions ALTER COLUMN game_type TYPE VARCHAR(20);
