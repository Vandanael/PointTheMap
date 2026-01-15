-- ============================================
-- BLOQUER L'ACCÈS DIRECT À L'API - SOLUTION ULTIME
-- ============================================
-- Cette solution désactive les INSERT directs via l'API
-- et force l'utilisation d'une Edge Function
-- ============================================

-- ============================================
-- OPTION 1: DÉSACTIVER LES INSERT ANONYMES
-- ============================================
-- ⚠️ ATTENTION: Cela bloquera TOUTES les insertions directes
-- Vous DEVEZ utiliser une Edge Function après ça

-- Supprimer la politique d'insertion anonyme
DROP POLICY IF EXISTS "Public insert access" ON leaderboard;
DROP POLICY IF EXISTS "Allow anonymous inserts to leaderboard" ON leaderboard;

-- Créer une politique qui nécessite une authentification
-- (Seulement les Edge Functions avec service role key pourront insérer)
CREATE POLICY "Only authenticated inserts"
ON leaderboard
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- OPTION 2: GARDER LES INSERT ANONYMES MAIS AVEC TRIGGER RENFORCÉ
-- ============================================
-- (Décommentez cette section si vous voulez garder les insertions anonymes)

/*
-- Garder la politique d'insertion mais avec validations strictes
CREATE POLICY "Public insert access with validation"
ON leaderboard
FOR INSERT
TO anon
WITH CHECK (
    -- Validation basique dans la politique (double sécurité)
    pseudo ~ '^[A-Z]{3,5}$' AND
    score >= 0 AND score <= 30000 AND
    time >= 5 AND time <= 300 AND
    session_id IS NOT NULL AND
    length(session_id) > 0
);
*/

-- ============================================
-- VÉRIFICATION
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️  INSERTIONS DIRECTES BLOQUÉES';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Les insertions anonymes sont maintenant désactivées.';
    RAISE NOTICE 'Vous DEVEZ utiliser une Edge Function pour insérer.';
    RAISE NOTICE '';
    RAISE NOTICE 'Pour réactiver les insertions anonymes,';
    RAISE NOTICE 'exécutez security.sql à nouveau.';
    RAISE NOTICE '========================================';
END $$;
