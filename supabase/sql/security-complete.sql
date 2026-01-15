-- ============================================
-- SCRIPT DE SÉCURITÉ COMPLET POUR POINTTHEMAP
-- ============================================
-- Ce script crée la table si nécessaire et configure
-- la sécurité maximale avec validations renforcées
-- ============================================

-- ============================================
-- 1. CRÉATION DE LA TABLE LEADERBOARD
-- ============================================

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS leaderboard (
  id BIGSERIAL PRIMARY KEY,
  pseudo VARCHAR(5) NOT NULL,
  score INTEGER NOT NULL,
  time INTEGER NOT NULL,
  wordle TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  timestamp BIGINT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. ACTIVATION DE ROW LEVEL SECURITY
-- ============================================

-- Activer Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Public read access" ON leaderboard;
DROP POLICY IF EXISTS "Public insert access" ON leaderboard;
DROP POLICY IF EXISTS "Allow anonymous inserts to leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Allow public read access to leaderboard" ON leaderboard;

-- ============================================
-- 3. POLITIQUES DE SÉCURITÉ
-- ============================================

-- Politique 1: Lecture publique (pour afficher le leaderboard)
CREATE POLICY "Public read access"
ON leaderboard
FOR SELECT
TO anon
USING (true);

-- Politique 2: Insertion publique (validation via trigger)
-- La validation stricte est faite par le trigger, pas dans la politique
CREATE POLICY "Public insert access"
ON leaderboard
FOR INSERT
TO anon
WITH CHECK (true);

-- Pas de politique UPDATE/DELETE = pas d'accès pour les utilisateurs anonymes

-- ============================================
-- 4. FONCTION DE VALIDATION RENFORCÉE
-- ============================================

-- Fonction pour valider les entrées du leaderboard
CREATE OR REPLACE FUNCTION validate_leaderboard_entry()
RETURNS TRIGGER AS $$
DECLARE
    max_score INTEGER := 30000; -- Score maximum théorique (5 rounds × 5000 + marge)
    min_score INTEGER := 0;
    max_time INTEGER := 300; -- 5 minutes max (5 rounds × 60s)
    min_time INTEGER := 5; -- Minimum 5 secondes
    max_pseudo_length INTEGER := 5;
    min_pseudo_length INTEGER := 3;
    recent_submissions INTEGER;
    max_submissions_per_hour INTEGER := 10; -- Limite de soumissions par heure
BEGIN
    -- Validation du pseudo
    IF NEW.pseudo IS NULL OR LENGTH(TRIM(NEW.pseudo)) < min_pseudo_length OR LENGTH(TRIM(NEW.pseudo)) > max_pseudo_length THEN
        RAISE EXCEPTION 'Pseudo invalide: doit contenir entre % et % caractères', min_pseudo_length, max_pseudo_length;
    END IF;
    
    -- Vérifier que le pseudo ne contient que des lettres majuscules
    IF NEW.pseudo !~ '^[A-Z]+$' THEN
        RAISE EXCEPTION 'Pseudo invalide: doit contenir uniquement des lettres majuscules (A-Z)';
    END IF;
    
    -- Validation du score
    IF NEW.score IS NULL OR NEW.score < min_score OR NEW.score > max_score THEN
        RAISE EXCEPTION 'Score invalide: doit être entre % et %', min_score, max_score;
    END IF;
    
    -- Validation du temps
    IF NEW.time IS NULL OR NEW.time < min_time OR NEW.time > max_time THEN
        RAISE EXCEPTION 'Temps invalide: doit être entre % et % secondes', min_time, max_time;
    END IF;
    
    -- Validation de la date
    IF NEW.date IS NULL OR NEW.date::text !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'Date invalide: format attendu YYYY-MM-DD';
    END IF;
    
    -- Validation du timestamp
    IF NEW.timestamp IS NULL OR NEW.timestamp < 0 THEN
        RAISE EXCEPTION 'Timestamp invalide';
    END IF;
    
    -- Validation du session_id
    IF NEW.session_id IS NULL OR LENGTH(TRIM(NEW.session_id)) = 0 THEN
        RAISE EXCEPTION 'Session ID invalide';
    END IF;
    
    -- Rate limiting: vérifier le nombre de soumissions récentes par session_id
    IF NEW.session_id IS NOT NULL THEN
        SELECT COUNT(*) INTO recent_submissions
        FROM leaderboard
        WHERE session_id = NEW.session_id
        AND timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (60 * 60 * 1000); -- Dernière heure
        
        IF recent_submissions >= max_submissions_per_hour THEN
            RAISE EXCEPTION 'Trop de soumissions: maximum % par heure', max_submissions_per_hour;
        END IF;
    END IF;
    
    -- Normaliser le pseudo (majuscules, trim)
    NEW.pseudo := UPPER(TRIM(NEW.pseudo));
    
    -- S'assurer que la date est valide
    IF NEW.date IS NULL THEN
        NEW.date := CURRENT_DATE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGER DE VALIDATION
-- ============================================

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS validate_leaderboard_before_insert ON leaderboard;

-- Créer le trigger avant INSERT
CREATE TRIGGER validate_leaderboard_before_insert
BEFORE INSERT ON leaderboard
FOR EACH ROW
EXECUTE FUNCTION validate_leaderboard_entry();

-- ============================================
-- 6. INDEX POUR PERFORMANCE ET SÉCURITÉ
-- ============================================

-- Supprimer les anciens index s'ils existent (pour éviter les doublons)
DROP INDEX IF EXISTS idx_leaderboard_score;
DROP INDEX IF EXISTS idx_leaderboard_timestamp;
DROP INDEX IF EXISTS idx_leaderboard_session;
DROP INDEX IF EXISTS idx_leaderboard_score_desc;
DROP INDEX IF EXISTS idx_leaderboard_pseudo;
DROP INDEX IF EXISTS idx_leaderboard_date;

-- Index pour améliorer les performances des requêtes
CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX idx_leaderboard_timestamp ON leaderboard(timestamp DESC);
CREATE INDEX idx_leaderboard_session ON leaderboard(session_id);
CREATE INDEX idx_leaderboard_pseudo ON leaderboard(pseudo);
CREATE INDEX idx_leaderboard_date ON leaderboard(date DESC);

-- Index composite pour les requêtes de leaderboard (score + temps)
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_time ON leaderboard(score DESC, time ASC);

-- ============================================
-- 7. SÉCURISATION DE LA TABLE CORE (si elle existe)
-- ============================================

-- Activer RLS sur core si la table existe
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'core') THEN
        ALTER TABLE core ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques
        DROP POLICY IF EXISTS "Allow anonymous inserts to core" ON core;
        DROP POLICY IF EXISTS "Allow public read access to core" ON core;
        DROP POLICY IF EXISTS "Allow authenticated inserts to core" ON core;
        
        -- Politique restrictive: nécessite une authentification pour INSERT
        CREATE POLICY "Allow authenticated inserts to core"
        ON core
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
        
        -- Lecture publique si nécessaire (décommenter si besoin)
        -- CREATE POLICY "Allow public read access to core"
        -- ON core
        -- FOR SELECT
        -- TO anon
        -- USING (true);
        
        RAISE NOTICE '✓ Table core sécurisée';
    ELSE
        RAISE NOTICE 'ℹ Table core n''existe pas, ignorée';
    END IF;
END $$;

-- ============================================
-- 8. VUES SÉCURISÉES POUR LES STATISTIQUES
-- ============================================

-- Vue pour le top 100 (meilleur score par pseudo)
DROP VIEW IF EXISTS leaderboard_top100;
CREATE VIEW leaderboard_top100 AS
SELECT DISTINCT ON (pseudo)
    pseudo,
    score,
    time,
    date,
    timestamp
FROM leaderboard
ORDER BY pseudo, score DESC, time ASC
LIMIT 100;

-- Grant accès en lecture à la vue
GRANT SELECT ON leaderboard_top100 TO anon;

-- ============================================
-- 9. VÉRIFICATIONS FINALES
-- ============================================

-- Vérifier que RLS est activé
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE t.tablename = 'leaderboard'
        AND c.relrowsecurity = true
    ) THEN
        RAISE EXCEPTION '❌ RLS n''est pas activé sur la table leaderboard!';
    END IF;
    RAISE NOTICE '✓ RLS activé sur leaderboard';
END $$;

-- Afficher un résumé
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SÉCURITÉ CONFIGURÉE AVEC SUCCÈS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Table leaderboard créée/vérifiée';
    RAISE NOTICE '✓ RLS activé';
    RAISE NOTICE '✓ Politiques de sécurité créées';
    RAISE NOTICE '✓ Trigger de validation actif';
    RAISE NOTICE '✓ Index créés pour performance';
    RAISE NOTICE '✓ Rate limiting configuré (10/heure)';
    RAISE NOTICE '========================================';
END $$;
