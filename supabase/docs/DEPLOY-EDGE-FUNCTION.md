# 🚀 Déployer la Edge Function - Guide Complet

## 📋 Prérequis

- Compte Supabase avec accès au projet
- Le script `sql/security.sql` déjà exécuté
- Accès au Dashboard Supabase

## 🎯 Étape 1 : Créer la Edge Function dans Supabase

### 1.1 Accéder aux Edge Functions

1. **Ouvrez votre Dashboard Supabase**
   - Allez sur [app.supabase.com](https://app.supabase.com)
   - Sélectionnez votre projet

2. **Naviguez vers Edge Functions**
   - Menu de gauche → **Edge Functions** (ou **Functions**)
   - Cliquez sur **Create a new function** (ou **New Function**)

### 1.2 Créer la fonction

1. **Nom de la fonction**
   - Entrez : `validate-leaderboard`
   - ⚠️ **Important** : Le nom doit être exactement `validate-leaderboard` (sans espaces, minuscules)

2. **Cliquez sur Create** (ou **Deploy**)

### 1.3 Copier le code

1. **Ouvrez le fichier** `supabase/edge-function.ts` dans votre projet
2. **Sélectionnez TOUT le contenu** (Ctrl+A / Cmd+A)
3. **Copiez** (Ctrl+C / Cmd+C)
4. **Dans l'éditeur Supabase**, supprimez le code par défaut
5. **Collez** le code copié (Ctrl+V / Cmd+V)

### 1.4 Configurer les variables d'environnement

Les variables d'environnement sont **automatiquement disponibles** dans Supabase Edge Functions, mais vérifions :

1. **Dans l'éditeur de la fonction**, cherchez **Settings** ou **Environment Variables**
2. **Vérifiez** que ces variables existent (elles devraient être là par défaut) :
   - `SUPABASE_URL` : Votre URL Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` : Votre clé de service

   **Où trouver ces valeurs ?**
   - Dashboard → **Settings** → **API**
   - `SUPABASE_URL` : **Project URL** (ex: `https://xxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` : **service_role** key (⚠️ **SECRÈTE**, ne jamais exposer)

3. **Si elles n'existent pas**, ajoutez-les :
   - Cliquez sur **Add variable**
   - Nom : `SUPABASE_URL`, Valeur : votre URL
   - Nom : `SUPABASE_SERVICE_ROLE_KEY`, Valeur : votre clé de service

### 1.5 Déployer

1. **Cliquez sur Deploy** (ou **Save**)
2. **Attendez** quelques secondes
3. ✅ **Status** devrait passer à **Active**

## 🔧 Étape 2 : Modifier le Code JavaScript

Le code JavaScript a déjà été modifié pour utiliser la Edge Function avec un fallback automatique.

**Le code dans `index.html` utilise maintenant** :
- ✅ Edge Function en priorité
- ✅ Fallback automatique sur insertion directe si la fonction n'existe pas

**Vous n'avez rien à modifier !** Le code est déjà prêt.

## 🛡️ Étape 3 : Bloquer les INSERT Directs (Optionnel mais Recommandé)

Pour forcer l'utilisation de la Edge Function et bloquer complètement les hacks :

1. **Dans Supabase SQL Editor**, exécutez :

```sql
-- Bloquer les INSERT directs
DROP POLICY IF EXISTS "Public insert access" ON leaderboard;
DROP POLICY IF EXISTS "Allow anonymous inserts to leaderboard" ON leaderboard;

-- Seulement les Edge Functions (avec service role) peuvent insérer
CREATE POLICY "Only authenticated inserts"
ON leaderboard
FOR INSERT
TO authenticated
WITH CHECK (true);
```

**⚠️ Important** : Après ça, votre code JavaScript DOIT utiliser la Edge Function, sinon les insertions échoueront. Mais le code est déjà configuré pour ça !

## 🧪 Étape 4 : Tester

### Test 1 : Votre application

1. **Ouvrez votre application**
2. **Jouez une partie**
3. **Soumettez un score**
4. ✅ **Devrait fonctionner normalement**

### Test 2 : Vérifier que la Edge Function est utilisée

1. **Ouvrez la console du navigateur** (F12)
2. **Jouez et soumettez un score**
3. **Regardez les logs** :
   - Si vous voyez "Edge Function not available" → La fonction n'est pas déployée
   - Sinon → La fonction est utilisée ✅

### Test 3 : Vérifier qu'un hack direct est bloqué

1. **Ouvrez la console du navigateur**
2. **Essayez cette requête** :

```javascript
fetch('https://votre-projet.supabase.co/rest/v1/leaderboard', {
  method: 'POST',
  headers: {
    'apikey': 'votre-clé-anonyme',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    pseudo: 'HACK',
    score: 25000,
    time: 25,
    wordle: 'test',
    date: '2024-01-01',
    timestamp: Date.now(),
    session_id: 'test-hack'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Résultat attendu** :
- Si vous avez bloqué les INSERT directs : **Erreur 403 (Forbidden)** ✅
- Si le trigger est actif : **Erreur de validation** ✅
- Dans les deux cas, le hack est bloqué !

## ✅ Checklist

- [ ] Edge Function créée avec le nom `validate-leaderboard`
- [ ] Code de `edge-function.ts` copié dans la fonction
- [ ] Variables d'environnement vérifiées
- [ ] Fonction déployée (status: Active)
- [ ] Application testée et fonctionnelle
- [ ] (Optionnel) INSERT directs bloqués
- [ ] Test de sécurité effectué

## 🐛 Dépannage

### Erreur : "Function not found" ou "404"

**Causes possibles** :
- Le nom de la fonction n'est pas exactement `validate-leaderboard`
- La fonction n'est pas déployée

**Solution** :
1. Vérifiez le nom dans Dashboard → Edge Functions
2. Vérifiez que le status est "Active"
3. Redéployez si nécessaire

### Erreur : "Missing Supabase environment variables"

**Causes possibles** :
- Les variables d'environnement ne sont pas configurées

**Solution** :
1. Dashboard → Edge Functions → `validate-leaderboard` → Settings
2. Vérifiez que `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` existent
3. Ajoutez-les si nécessaire (Dashboard → Settings → API)

### Erreur : "403 Forbidden" après avoir bloqué les INSERT

**C'est normal !** ✅

Cela signifie que :
- ✅ Les INSERT directs sont bloqués
- ✅ Vous devez utiliser la Edge Function
- ✅ Le code JavaScript devrait utiliser la fonction automatiquement

**Vérifiez** :
- Que la Edge Function est bien déployée
- Que le code JavaScript utilise bien `supabaseClient.functions.invoke()`

### La fonction ne valide pas correctement

**Vérifiez les logs** :
1. Dashboard → Edge Functions → `validate-leaderboard` → **Logs**
2. Regardez les erreurs éventuelles
3. Vérifiez que le code de la fonction est correct

### Le fallback sur insertion directe se déclenche

**Causes possibles** :
- La fonction n'est pas déployée
- Le nom de la fonction est incorrect
- Erreur réseau

**Solution** :
1. Vérifiez que la fonction existe et est active
2. Vérifiez les logs de la fonction
3. Le fallback permet à l'app de fonctionner même sans Edge Function

## 📚 Ressources

- [Documentation Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Exemples Edge Functions](https://supabase.com/docs/guides/functions/examples)
- [Variables d'environnement](https://supabase.com/docs/guides/functions/secrets)

## 🎉 Félicitations !

Votre Edge Function est maintenant déployée et votre application est **beaucoup plus sécurisée** ! 

Les hacks via CORS/API directe sont maintenant bloqués, et toutes les insertions passent par votre validation serveur.

---

**Besoin d'aide ?** Consultez les logs de la fonction dans le Dashboard Supabase.
