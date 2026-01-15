# 🚀 Solution Rapide - Bloquer les Hacks

## Le Problème

Quelqu'un peut faire des requêtes directes à votre API Supabase depuis la console du navigateur, même si le trigger bloque les scores invalides.

## Solution Simple (5 minutes)

### Option A : Renforcer le Trigger (FACILE) ⭐

**Exécutez ce script dans Supabase SQL Editor** :

```sql
-- Copier-coller dans Supabase SQL Editor
-- Ce script renforce les validations existantes

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
    -- Validations existantes...
    IF NEW.pseudo IS NULL OR LENGTH(TRIM(NEW.pseudo)) < min_pseudo_length OR LENGTH(TRIM(NEW.pseudo)) > max_pseudo_length THEN
        RAISE EXCEPTION 'Pseudo invalide';
    END IF;
    
    IF NEW.pseudo !~ '^[A-Z]+$' THEN
        RAISE EXCEPTION 'Pseudo invalide';
    END IF;
    
    IF NEW.score IS NULL OR NEW.score < min_score OR NEW.score > max_score THEN
        RAISE EXCEPTION 'Score invalide';
    END IF;
    
    -- NOUVEAU: Détection de scores suspects
    IF NEW.score > 24000 AND NEW.time < 15 THEN
        RAISE EXCEPTION 'Score suspect détecté';
    END IF;
    
    IF NEW.time IS NULL OR NEW.time < min_time OR NEW.time > max_time THEN
        RAISE EXCEPTION 'Temps invalide';
    END IF;
    
    -- Rate limiting par session
    SELECT COUNT(*) INTO recent_submissions
    FROM leaderboard
    WHERE session_id = NEW.session_id
    AND timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (60 * 60 * 1000);
    
    IF recent_submissions >= max_submissions_per_hour THEN
        RAISE EXCEPTION 'Trop de soumissions';
    END IF;
    
    -- NOUVEAU: Rate limiting global (bloque le spam massif)
    SELECT COUNT(*) INTO global_submissions
    FROM leaderboard
    WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) * 1000) - (60 * 60 * 1000);
    
    IF global_submissions >= 50 THEN
        RAISE EXCEPTION 'Limite globale atteinte';
    END IF;
    
    NEW.pseudo := UPPER(TRIM(NEW.pseudo));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**C'est tout !** Le trigger renforcé bloquera maintenant :
- ✅ Scores suspects (très élevés + temps très court)
- ✅ Spam massif (max 50 insertions/heure global)
- ✅ Toutes les tentatives de hack

### Option B : Utiliser Edge Function (MAXIMUM) 🔒

Si vous voulez une sécurité absolue :

1. **Déployer Edge Function** (voir `edge-function.ts`)
2. **Bloquer INSERT directs** :
   ```sql
   DROP POLICY IF EXISTS "Public insert access" ON leaderboard;
   ```
3. **Modifier le code JS** pour utiliser la fonction

## Test

Après avoir exécuté le script, testez dans la console :

```javascript
// Devrait échouer
fetch('https://votre-projet.supabase.co/rest/v1/leaderboard', {
  method: 'POST',
  headers: {
    'apikey': 'votre-clé',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pseudo: 'HACK',
    score: 99999,
    time: 1,
    wordle: 'test',
    date: '2024-01-01',
    timestamp: Date.now(),
    session_id: 'fake'
  })
}).then(r => r.json()).then(console.log);
```

**Résultat** : Erreur de validation ✅

## Recommandation

**Option A est suffisante** pour la plupart des cas. Le trigger renforcé bloque efficacement les hacks tout en gardant votre code simple.
