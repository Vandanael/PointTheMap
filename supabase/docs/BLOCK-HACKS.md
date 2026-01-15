# 🛡️ Comment Bloquer les Hacks CORS/API Directe

## 🚨 Le Problème

Même avec les validations serveur, quelqu'un peut :
1. Ouvrir la console du navigateur
2. Faire une requête directe à l'API Supabase avec la clé anonyme
3. Contourner votre code JavaScript

```javascript
// Exemple de hack possible (depuis la console)
fetch('https://votre-projet.supabase.co/rest/v1/leaderboard', {
  method: 'POST',
  headers: {
    'apikey': 'votre-clé-anonyme',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    pseudo: 'HACK',
    score: 99999,  // Sera bloqué par le trigger, mais...
    time: 1,
    wordle: 'test',
    date: '2024-01-01',
    timestamp: Date.now(),
    session_id: 'fake-session'
  })
});
```

**Le trigger bloquera les scores invalides**, mais quelqu'un peut quand même :
- Essayer de spammer (limité par rate limiting)
- Tester différents scores jusqu'à trouver les limites
- Créer plusieurs sessions

## ✅ Solutions (par ordre de sécurité)

### Solution 1 : Edge Function (RECOMMANDÉ) ⭐

**Avantage** : Contrôle total, impossible à contourner

1. **Déployer la Edge Function** :
   - Dashboard Supabase → Edge Functions
   - Créer `validate-leaderboard`
   - Copier le code de `supabase/edge-function.ts`

2. **Bloquer les INSERT directs** :
   ```sql
   -- Exécuter dans SQL Editor
   DROP POLICY IF EXISTS "Public insert access" ON leaderboard;
   
   CREATE POLICY "Only authenticated inserts"
   ON leaderboard
   FOR INSERT
   TO authenticated
   WITH CHECK (true);
   ```

3. **Modifier le code JavaScript** :
   ```javascript
   // Dans index.html, remplacer submitToSupabase
   const { data, error } = await supabaseClient.functions.invoke('validate-leaderboard', {
       body: entry
   });
   ```

### Solution 2 : Trigger Renforcé (Actuel)

Le trigger PostgreSQL valide **toujours**, même pour les requêtes directes.

**Avantages** :
- ✅ Fonctionne automatiquement
- ✅ Impossible de contourner
- ✅ Rate limiting serveur

**Limitations** :
- ⚠️ Quelqu'un peut quand même essayer (sera bloqué)
- ⚠️ Peut générer du spam (limité à 10/heure)

### Solution 3 : Désactiver CORS (Partiel)

Dans Supabase Dashboard → Settings → API :
- Restreindre les domaines autorisés
- Mais cela peut casser votre app si mal configuré

## 🔧 Implémentation Rapide

### Étape 1 : Exécuter le script de blocage

```sql
-- Dans Supabase SQL Editor
-- Exécuter: supabase/sql/block-direct-api.sql
```

### Étape 2 : Déployer Edge Function

1. Dashboard → Edge Functions → New Function
2. Nom : `validate-leaderboard`
3. Copier le code de `supabase/edge-function.ts`
4. Déployer

### Étape 3 : Modifier le code JavaScript

Dans `index.html`, ligne ~1268, remplacer :

```javascript
// AVANT (vulnérable)
const { data, error } = await supabaseClient
    .from('leaderboard')
    .insert([entry])
    .select();

// APRÈS (sécurisé)
const { data: edgeData, error: edgeError } = await supabaseClient.functions.invoke('validate-leaderboard', {
    body: entry
});

if (edgeError) {
    console.error('Error submitting via Edge Function:', edgeError);
    return null;
}

const { data, error } = { data: edgeData?.data, error: edgeData?.error || null };
```

## 🧪 Tester la Sécurité

### Test 1 : Tentative d'insertion directe

```javascript
// Dans la console du navigateur (devrait échouer)
fetch('https://votre-projet.supabase.co/rest/v1/leaderboard', {
  method: 'POST',
  headers: {
    'apikey': 'votre-clé-anonyme',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    pseudo: 'TEST',
    score: 25000,
    time: 25,
    wordle: 'test',
    date: '2024-01-01',
    timestamp: Date.now(),
    session_id: 'test'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Résultat attendu** : Erreur 403 (Forbidden) si politique bloquée, ou erreur de validation si trigger actif.

### Test 2 : Vérifier le trigger

```sql
-- Dans SQL Editor
-- Devrait échouer
INSERT INTO leaderboard (pseudo, score, time, wordle, date, timestamp, session_id)
VALUES ('AB', 99999, 1, 'test', '2024-01-01', 1234567890, 'test');
```

**Résultat attendu** : Erreur de validation du trigger.

## 📊 Comparaison des Solutions

| Solution | Sécurité | Complexité | Performance |
|----------|----------|------------|-------------|
| Trigger seul | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| Edge Function | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| Trigger + Edge | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

## ✅ Recommandation Finale

**Pour une sécurité maximale** :
1. ✅ Garder le trigger (sécurité de base)
2. ✅ Ajouter Edge Function (contrôle total)
3. ✅ Bloquer INSERT anonymes (force l'utilisation de Edge Function)

**Pour une sécurité acceptable** :
1. ✅ Garder le trigger renforcé (actuel)
2. ✅ Ajouter rate limiting global (dans security-enhanced.sql)

## 🚨 Important

Si vous bloquez les INSERT anonymes :
- ⚠️ Votre code JavaScript actuel ne fonctionnera plus
- ✅ Vous DEVEZ utiliser la Edge Function
- ✅ C'est la solution la plus sécurisée

---

**Besoin d'aide ?** Consultez `SECURITY.md` pour plus de détails.
