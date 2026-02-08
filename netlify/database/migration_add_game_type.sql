-- Migration: Add game_type column to sessions table
-- Date: 2024-01-19
-- Description: Adds game_type to support classic and daily modes

-- Add game_type column if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sessions' 
        AND column_name = 'game_type'
    ) THEN
        ALTER TABLE sessions 
        ADD COLUMN game_type VARCHAR(20) DEFAULT 'classic';
        
        -- Update existing sessions with the default value
        UPDATE sessions 
        SET game_type = 'classic' 
        WHERE game_type IS NULL;
    END IF;
END $$;
