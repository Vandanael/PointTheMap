-- ============================================
-- SCRIPT DE SÉCURITÉ SUPABASE POUR POINTTHEMAP
-- ============================================
-- Ce script configure la sécurité maximale pour les tables Supabase
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================

-- ============================================
-- 1. SÉCURISATION DE LA TABLE LEADERBOARD
-- ============================================

-- Activer Row Level Security (RLS)
ALTER TABLE IF EXISTS leaderboard ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Allow anonymous inserts to leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Allow public read access to leaderboard" ON leaderboard;
DROP POLICY IF EXISTS "Allow public read access to leaderboard ordered" ON leaderboard;

-- Politique 1: Autoriser les INSERT anonymes (pour le jeu public)
-- Mais avec validation via trigger
CREATE POLICY "Allow anonymous inserts to leaderboard"
ON leaderboard
FOR INSERT
TO anon
WITH CHECK (true);

-- Politique 2: Autoriser la lecture publique (pour afficher le leaderboard)
CREATE POLICY "Allow public read access to leaderboard"
ON leaderboard
FOR SELECT
TO anon
USING (true);

-- Politique 3: INTERDIRE les UPDATE et DELETE pour les utilisateurs anonymes
-- (Pas de politique = pas d'accès)

-- ============================================
-- 2. FONCTION DE VALIDATION DES DONNÉES
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
    -- Validation du score
    IF NEW.score IS NULL OR NEW.score < min_score OR NEW.score > max_score THEN
        RAISE EXCEPTION 'Score invalide: doit être entre % et %', min_score, max_score;
    END IF;
    
    -- Validation du temps
    IF NEW.time IS NULL OR NEW.time < min_time OR NEW.time > max_time THEN
        RAISE EXCEPTION 'Temps invalide: doit être entre % et % secondes', min_time, max_time;
    END IF;
    
    -- Validation du pseudo
    IF NEW.pseudo IS NULL OR LENGTH(TRIM(NEW.pseudo)) < min_pseudo_length OR LENGTH(TRIM(NEW.pseudo)) > max_pseudo_length THEN
        RAISE EXCEPTION 'Pseudo invalide: doit contenir entre % et % caractères', min_pseudo_length, max_pseudo_length;
    END IF;
    
    -- Vérifier que le pseudo ne contient que des lettres majuscules
    IF NEW.pseudo !~ '^[A-Z]+$' THEN
        RAISE EXCEPTION 'Pseudo invalide: doit contenir uniquement des lettres majuscules';
    END IF;
    
    -- Validation de la date
    IF NEW.date IS NULL OR NEW.date::text !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'Date invalide: format attendu YYYY-MM-DD';
    END IF;
    
    -- Validation du timestamp
    IF NEW.timestamp IS NULL OR NEW.timestamp < 0 THEN
        RAISE EXCEPTION 'Timestamp invalide';
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
        NEW.date := CURRENT_DATE::text;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger avant INSERT
DROP TRIGGER IF EXISTS validate_leaderboard_before_insert ON leaderboard;
CREATE TRIGGER validate_leaderboard_before_insert
BEFORE INSERT ON leaderboard
FOR EACH ROW
EXECUTE FUNCTION validate_leaderboard_entry();

-- ============================================
-- 3. SÉCURISATION DE LA TABLE CORE (si elle existe)
-- ============================================

-- Activer RLS sur core si la table existe
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'core') THEN
        ALTER TABLE core ENABLE ROW LEVEL SECURITY;
        
        -- Supprimer les anciennes politiques
        DROP POLICY IF EXISTS "Allow anonymous inserts to core" ON core;
        DROP POLICY IF EXISTS "Allow public read access to core" ON core;
        
        -- Politique restrictive: nécessite une authentification pour INSERT
        CREATE POLICY "Allow authenticated inserts to core"
        ON core
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
        
        -- Lecture publique si nécessaire (sinon commenter cette ligne)
        -- CREATE POLICY "Allow public read access to core"
        -- ON core
        -- FOR SELECT
        -- TO anon
        -- USING (true);
        
        RAISE NOTICE 'Table core sécurisée';
    ELSE
        RAISE NOTICE 'Table core n''existe pas, ignorée';
    END IF;
END $$;

-- ============================================
-- 4. FONCTION DE NETTOYAGE AUTOMATIQUE
-- ============================================

-- Fonction pour supprimer les anciennes entrées (optionnel, pour limiter la taille de la table)
CREATE OR REPLACE FUNCTION cleanup_old_leaderboard_entries()
RETURNS void AS $$
BEGIN
    -- Supprimer les entrées de plus de 1 an (optionnel)
    -- Décommenter si vous voulez activer le nettoyage automatique
    -- DELETE FROM leaderboard WHERE timestamp < (EXTRACT(EPOCH FROM NOW()) * 1000) - (365 * 24 * 60 * 60 * 1000);
    
    -- Ou garder seulement les 10000 meilleurs scores
    -- DELETE FROM leaderboard WHERE id NOT IN (
    --     SELECT id FROM leaderboard ORDER BY score DESC, time ASC LIMIT 10000
    -- );
    
    RAISE NOTICE 'Fonction de nettoyage disponible (non activée par défaut)';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. VUES SÉCURISÉES POUR LES STATISTIQUES
-- ============================================

-- Vue pour le top 100 (meilleur score par pseudo)
CREATE OR REPLACE VIEW leaderboard_top100 AS
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
-- 6. INDEX POUR PERFORMANCE ET SÉCURITÉ
-- ============================================

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_desc ON leaderboard(score DESC, time ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_pseudo ON leaderboard(pseudo);
CREATE INDEX IF NOT EXISTS idx_leaderboard_timestamp ON leaderboard(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_session_id ON leaderboard(session_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_date ON leaderboard(date DESC);

-- ============================================
-- 7. VÉRIFICATIONS FINALES
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
        RAISE EXCEPTION 'RLS n''est pas activé sur la table leaderboard!';
    END IF;
    RAISE NOTICE '✓ RLS activé sur leaderboard';
END $$;

-- Afficher un résumé
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SÉCURITÉ CONFIGURÉE AVEC SUCCÈS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ RLS activé';
    RAISE NOTICE '✓ Politiques de sécurité créées';
    RAISE NOTICE '✓ Trigger de validation actif';
    RAISE NOTICE '✓ Index créés pour performance';
    RAISE NOTICE '========================================';
END $$;
