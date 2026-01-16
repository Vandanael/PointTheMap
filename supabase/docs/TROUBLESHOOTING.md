# 🔧 Dépannage et Solutions Rapides

## 📋 Table des matières

1. [Les joueurs ne peuvent pas soumettre](#joueurs-ne-peuvent-pas-soumettre)
2. [Bloquer les hacks CORS](#bloquer-les-hacks-cors)
3. [Renforcer la sécurité](#renforcer-la-sécurité)

---

## ❌ Les joueurs ne peuvent pas soumettre {#joueurs-ne-peuvent-pas-soumettre}

### Problème

Les joueurs voient une erreur lors de la soumission de score.

### Vérifications

1. **Vérifiez les politiques RLS** :
   ```sql
   SELECT policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename = 'leaderboard';
   ```
   Vous devriez voir une politique `Public insert access` pour `INSERT`.

2. **Vérifiez que le trigger est actif** :
   ```sql
   SELECT trigger_name 
   FROM information_schema.triggers 
   WHERE event_object_table = 'leaderboard';
   ```
   Vous devriez voir `validate_leaderboard_before_insert`.

### Solution

Exécutez le script `sql/reactiver-insert-anonymes.sql` dans Supabase SQL Editor.

---

## 🛡️ Bloquer les hacks CORS {#bloquer-les-hacks-cors}

### Le Problème

Quelqu'un peut faire des requêtes directes à l'API Supabase depuis la console du navigateur.

### Solution Simple : Renforcer le Trigger

Exécutez `sql/anti-hack-simple.sql` dans Supabase SQL Editor.

Ce script ajoute :
- ✅ Détection de scores suspects
- ✅ Rate limiting global (50/heure)
- ✅ Validations renforcées

---

## 🔒 Renforcer la sécurité {#renforcer-la-sécurité}

Exécutez `sql/anti-hack-simple.sql` :
- ✅ Simple et efficace
- ✅ Bloque les hacks
- ✅ Pas de modification de code nécessaire

---

## 🧪 Tests

### Test 1 : Vérifier que les joueurs peuvent soumettre

1. Ouvrez votre application
2. Jouez une partie
3. Soumettez un score
4. ✅ Devrait fonctionner

### Test 2 : Vérifier qu'un hack est bloqué

Dans la console du navigateur :

```javascript
fetch('https://votre-projet.supabase.co/rest/v1/leaderboard', {
  method: 'POST',
  headers: {
    'apikey': 'votre-clé-anonyme',
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

**Résultat attendu** : Erreur de validation ✅

---

## 📚 Documentation Complète

- **[INSTALL-SECURITY.md](INSTALL-SECURITY.md)** : Installation en 5 minutes
- **[SECURITY.md](SECURITY.md)** : Documentation complète
- **[VERIFIER-SECURITE.md](VERIFIER-SECURITE.md)** : Guide de vérification

---

**Besoin d'aide ?** Consultez les logs Supabase : Dashboard → Logs → Postgres Logs
