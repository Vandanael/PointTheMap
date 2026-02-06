-- Migration: Ajouter la colonne game_type à la table sessions
-- Date: 2024-01-19
-- Description: Ajoute la colonne game_type pour supporter les modes classic et daily

-- Ajouter la colonne game_type si elle n'existe pas déjà
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
        
        -- Mettre à jour les sessions existantes avec la valeur par défaut
        UPDATE sessions 
        SET game_type = 'classic' 
        WHERE game_type IS NULL;
    END IF;
END $$;
