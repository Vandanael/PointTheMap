-- ============================================
-- ANTI-HACK SIMPLE - À EXÉCUTER MAINTENANT
-- ============================================
-- Copiez-collez ce script dans Supabase SQL Editor
-- ============================================

-- Renforcer la fonction de validation avec détection de hacks
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
    global_submissions INTEGER;
BEGIN
    -- Validation du pseudo
    IF NEW.pseudo IS NULL OR LENGTH(TRIM(NEW.pseudo)) < min_pseudo_length OR LENGTH(TRIM(NEW.pseudo)) > max_pseudo_length THEN
        RAISE EXCEPTION 'Pseudo invalide: doit contenir entre % et % caractères', min_pseudo_length, max_pseudo_length;
    END IF;
    
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
    
    -- ============================================
    -- 🛡️ PROTECTION SIMPLE CONTRE LES HACKS
    -- ============================================
    
    -- Règle simple : Temps minimum de 40 secondes pour une partie complète
    -- (5 rounds × 5s + transitions + résultats = minimum ~42s)
    IF NEW.time < 40 THEN
        RAISE EXCEPTION 'Temps irréaliste: minimum 40 secondes requis pour une partie complète (hack détecté)';
    END IF;
    
    -- Score élevé nécessite plus de temps
    IF NEW.score > 25000 AND NEW.time < 35 THEN
        RAISE EXCEPTION 'Score très élevé suspect: score > 25000 nécessite au minimum 35 secondes (hack détecté)';
    END IF;
    
    IF NEW.score > 20000 AND NEW.time < 30 THEN
        RAISE EXCEPTION 'Score élevé suspect: score > 20000 nécessite au minimum 30 secondes (hack détecté)';
    END IF;
    
    -- 🛡️ DÉTECTION DE HACK: Score très élevé avec temps très court
    IF NEW.score > 24000 AND NEW.time < 15 THEN
        RAISE EXCEPTION 'Score suspect détecté: score très élevé avec temps irréaliste';
    END IF;
    
    -- Validation de la date
    IF NEW.date IS NULL OR NEW.date::text !~ '^\d{4}-\d{2}-\d{2}$' THEN
        RAISE EXCEPTION 'Date invalide: format attendu YYYY-MM-DD';
    END IF;
    
    -- Validation du timestamp
    IF NEW.timestamp IS NULL OR NEW.timestamp < 0 THEN
        RAISE EXCEPTION 'Timestamp invalide';
    END IF;
    
    -- 🛡️ DÉTECTION DE HACK: Timestamp dans le futur
    IF NEW.timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) + 60000 THEN
        RAISE EXCEPTION 'Timestamp dans le futur (hack détecté)';
    END IF;
    
    -- Validation du session_id
    IF NEW.session_id IS NULL OR LENGTH(TRIM(NEW.session_id)) = 0 THEN
        RAISE EXCEPTION 'Session ID invalide';
    END IF;
    
    -- 🛡️ DÉTECTION DE HACK: Format de session_id suspect
    IF NEW.session_id !~ '^[a-zA-Z0-9_-]+$' THEN
        RAISE EXCEPTION 'Session ID invalide: format suspect';
    END IF;
    
    -- Rate limiting par session_id
    SELECT COUNT(*) INTO recent_submissions
    FROM leaderboard
    WHERE session_id = NEW.session_id
    AND timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (60 * 60 * 1000);
    
    IF recent_submissions >= max_submissions_per_hour THEN
        RAISE EXCEPTION 'Trop de soumissions: maximum % par heure par session', max_submissions_per_hour;
    END IF;
    
    -- 🛡️ RATE LIMITING GLOBAL: Bloque le spam massif
    SELECT COUNT(*) INTO global_submissions
    FROM leaderboard
    WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (60 * 60 * 1000);
    
    IF global_submissions >= 50 THEN
        RAISE EXCEPTION 'Limite globale atteinte: trop de soumissions dans la dernière heure (spam détecté)';
    END IF;
    
    -- Normaliser le pseudo
    NEW.pseudo := UPPER(TRIM(NEW.pseudo));
    
    IF NEW.date IS NULL THEN
        NEW.date := CURRENT_DATE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Afficher un message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Anti-hack activé !';
    RAISE NOTICE '🛡️ Protections:';
    RAISE NOTICE '   - Temps minimum 40 secondes pour toute partie';
    RAISE NOTICE '   - Score > 25000 → minimum 35 secondes';
    RAISE NOTICE '   - Score > 20000 → minimum 30 secondes';
    RAISE NOTICE '   - Détection de scores suspects';
    RAISE NOTICE '   - Rate limiting global (50/heure)';
    RAISE NOTICE '   - Validation renforcée';
END $$;
