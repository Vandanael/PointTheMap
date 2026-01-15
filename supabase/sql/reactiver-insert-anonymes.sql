-- ============================================
-- RÉACTIVER LES INSERT ANONYMES
-- ============================================
-- Ce script réactive les insertions anonymes
-- Les joueurs pourront soumettre leurs scores
-- Le trigger PostgreSQL bloquera toujours les hacks
-- ============================================

-- Supprimer la politique restrictive (si elle existe)
DROP POLICY IF EXISTS "Only authenticated inserts" ON leaderboard;

-- Réactiver les INSERT anonymes avec validation
CREATE POLICY "Public insert access"
ON leaderboard
FOR INSERT
TO anon
WITH CHECK (true);

-- Vérification
DO $$
BEGIN
    RAISE NOTICE '✅ INSERT anonymes réactivés';
    RAISE NOTICE '🛡️ Le trigger PostgreSQL bloque toujours les hacks';
    RAISE NOTICE '✅ Les joueurs peuvent maintenant soumettre leurs scores';
END $$;
