-- Migration 006: Rename sessions.capitals to sessions.targets
-- This column stores generic session targets (capitals, countries, stadiums, civilizations)

ALTER TABLE sessions RENAME COLUMN capitals TO targets;

COMMENT ON COLUMN sessions.targets IS 'Session targets (capitals, countries, stadiums, civilizations)';
