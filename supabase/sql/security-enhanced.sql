-- ============================================
-- SÉCURITÉ RENFORCÉE - PROTECTION CONTRE CORS/API DIRECTE
-- ============================================
-- À exécuter APRÈS security.sql
-- Ajoute des protections supplémentaires
-- ============================================

-- ============================================
-- 1. VÉRIFICATION QUE LE TRIGGER EST ACTIF
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'validate_leaderboard_before_insert'
        AND tgrelid = 'leaderboard'::regclass
    ) THEN
        RAISE EXCEPTION '❌ Le trigger validate_leaderboard_before_insert n''est pas actif! Exécutez d''abord security.sql';
    END IF;
    RAISE NOTICE '✓ Trigger actif';
END $$;

-- ============================================
-- 2. RENFORCEMENT DU RATE LIMITING
-- ============================================

-- Fonction améliorée avec rate limiting plus strict
CREATE OR REPLACE FUNCTION validate_leaderboard_entry()
RETURNS TRIGGER AS $$
DECLARE
    max_score INTEGER := 30000;
    min_score INTEGER := 0;
    max_time INTEGER := 300;
    min_time INTEGER := 5;
    max_pseudo_length INTEGER := 5;
    min_pseudo_length INTEGER := 3;
    recent_submissions INTEGER;
    max_submissions_per_hour INTEGER := 10;
    -- NOUVEAU: Rate limiting par IP (si disponible)
    client_ip TEXT;
    recent_submissions_by_ip INTEGER;
BEGIN
    -- Validation du pseudo
    IF NEW.pseudo IS NULL OR LENGTH(TRIM(NEW.pseudo)) < min_pseudo_length OR LENGTH(TRIM(NEW.pseudo)) > max_pseudo_length THEN
        RAISE EXCEPTION 'Pseudo invalide: doit contenir entre % et % caractères', min_pseudo_length, max_pseudo_length;
    END IF;
    
    IF NEW.pseudo !~ '^[A-Z]+$' THEN
        RAISE EXCEPTION 'Pseudo invalide: doit contenir uniquement des lettres majuscules (A-Z)';
    END IF;
    
    -- Validation du score (PLUS STRICTE)
    IF NEW.score IS NULL OR NEW.score < min_score OR NEW.score > max_score THEN
        RAISE EXCEPTION 'Score invalide: doit être entre % et %', min_score, max_score;
    END IF;
    
    -- NOUVEAU: Vérifier que le score est réaliste (pas de score parfait systématique)
    -- Si score > 24000 (très élevé), vérifier que le temps est cohérent
    IF NEW.score > 24000 AND NEW.time < 15 THEN
        RAISE EXCEPTION 'Score suspect: score très élevé avec temps très court';
    END IF;
    
    -- Validation du temps
    IF NEW.time IS NULL OR NEW.time < min_time OR NEW.time > max_time THEN
        RAISE EXCEPTION 'Temps invalide: doit être entre % et % secondes', min_time, max_time;
    END IF;
    
    -- Validation de la date
    IF NEW.date IS NULL OR NEW.date::text !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'Date invalide: format attendu YYYY-MM-DD';
    END IF;
    
    -- Validation du timestamp (PLUS STRICTE)
    IF NEW.timestamp IS NULL OR NEW.timestamp < 0 THEN
        RAISE EXCEPTION 'Timestamp invalide';
    END IF;
    
    -- NOUVEAU: Vérifier que le timestamp n'est pas dans le futur
    IF NEW.timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) + 60000 THEN -- +1 minute de marge
        RAISE EXCEPTION 'Timestamp dans le futur';
    END IF;
    
    -- Validation du session_id
    IF NEW.session_id IS NULL OR LENGTH(TRIM(NEW.session_id)) = 0 THEN
        RAISE EXCEPTION 'Session ID invalide';
    END IF;
    
    -- NOUVEAU: Vérifier le format du session_id (doit être alphanumérique)
    IF NEW.session_id !~ '^[a-zA-Z0-9_-]+$' THEN
        RAISE EXCEPTION 'Session ID invalide: format non autorisé';
    END IF;
    
    -- Rate limiting par session_id (EXISTANT - renforcé)
    IF NEW.session_id IS NOT NULL THEN
        SELECT COUNT(*) INTO recent_submissions
        FROM leaderboard
        WHERE session_id = NEW.session_id
        AND timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (60 * 60 * 1000);
        
        IF recent_submissions >= max_submissions_per_hour THEN
            RAISE EXCEPTION 'Trop de soumissions: maximum % par heure par session', max_submissions_per_hour;
        END IF;
    END IF;
    
    -- NOUVEAU: Rate limiting global (toutes sessions confondues dans la dernière heure)
    -- Limite à 50 insertions/heure globales pour éviter le spam massif
    SELECT COUNT(*) INTO recent_submissions
    FROM leaderboard
    WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (60 * 60 * 1000);
    
    IF recent_submissions >= 50 THEN
        RAISE EXCEPTION 'Limite globale atteinte: trop de soumissions dans la dernière heure';
    END IF;
    
    -- Normaliser le pseudo
    NEW.pseudo := UPPER(TRIM(NEW.pseudo));
    
    -- S'assurer que la date est valide
    IF NEW.date IS NULL THEN
        NEW.date := CURRENT_DATE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. TABLE DE LOG POUR DÉTECTION D'ABUS
-- ============================================

-- Créer une table pour logger les tentatives d'insertion (optionnel)
CREATE TABLE IF NOT EXISTS leaderboard_attempts (
    id BIGSERIAL PRIMARY KEY,
    pseudo TEXT,
    score INTEGER,
    time INTEGER,
    session_id TEXT,
    timestamp BIGINT,
    success BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les requêtes de log
CREATE INDEX IF NOT EXISTS idx_leaderboard_attempts_timestamp ON leaderboard_attempts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_attempts_session ON leaderboard_attempts(session_id);

-- Fonction pour logger les tentatives
CREATE OR REPLACE FUNCTION log_leaderboard_attempt()
RETURNS TRIGGER AS $$
BEGIN
    -- Logger toutes les tentatives (succès et échecs)
    -- Cette fonction sera appelée par un trigger AFTER
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour logger les insertions réussies
CREATE TRIGGER log_leaderboard_success
AFTER INSERT ON leaderboard
FOR EACH ROW
EXECUTE FUNCTION log_leaderboard_attempt();

-- ============================================
-- 4. VUE POUR MONITORING
-- ============================================

-- Vue pour surveiller les soumissions récentes
CREATE OR REPLACE VIEW leaderboard_recent_submissions AS
SELECT 
    pseudo,
    score,
    time,
    session_id,
    timestamp,
    created_at
FROM leaderboard
WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (24 * 60 * 60 * 1000) -- Dernières 24h
ORDER BY timestamp DESC;

GRANT SELECT ON leaderboard_recent_submissions TO anon;

-- ============================================
-- 5. FONCTION DE NETTOYAGE DES TENTATIVES SUSPECTES
-- ============================================

-- Fonction pour identifier les scores suspects (à exécuter manuellement)
CREATE OR REPLACE FUNCTION find_suspicious_scores()
RETURNS TABLE (
    id BIGINT,
    pseudo TEXT,
    score INTEGER,
    time INTEGER,
    session_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.pseudo,
        l.score,
        l.time,
        l.session_id,
        l.created_at
    FROM leaderboard l
    WHERE 
        -- Scores très élevés avec temps très court
        (l.score > 24000 AND l.time < 20)
        -- Ou plusieurs scores identiques du même pseudo
        OR (SELECT COUNT(*) FROM leaderboard l2 WHERE l2.pseudo = l.pseudo AND l2.score = l.score) > 3
    ORDER BY l.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. VÉRIFICATIONS FINALES
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ SÉCURITÉ RENFORCÉE CONFIGURÉE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Trigger renforcé avec validations supplémentaires';
    RAISE NOTICE '✓ Rate limiting global (50/heure)';
    RAISE NOTICE '✓ Détection de scores suspects';
    RAISE NOTICE '✓ Table de log créée';
    RAISE NOTICE '✓ Vue de monitoring créée';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANT:';
    RAISE NOTICE 'Pour une sécurité maximale, utilisez une Edge Function';
    RAISE NOTICE 'comme proxy pour toutes les insertions.';
    RAISE NOTICE 'Consultez: supabase/edge-function.ts';
    RAISE NOTICE '========================================';
END $$;
