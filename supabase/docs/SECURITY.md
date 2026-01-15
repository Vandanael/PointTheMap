# 🔒 Guide de Sécurité - PointTheMap

Ce document décrit les mesures de sécurité mises en place pour protéger l'application PointTheMap contre les abus et les attaques.

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Configuration Supabase](#configuration-supabase)
3. [Validations côté client](#validations-côté-client)
4. [Validations côté serveur](#validations-côté-serveur)
5. [Rate Limiting](#rate-limiting)
6. [Meilleures pratiques](#meilleures-pratiques)

## 🎯 Vue d'ensemble

PointTheMap utilise une approche de sécurité en plusieurs couches :

- **Row Level Security (RLS)** sur Supabase
- **Validations côté client** (JavaScript)
- **Validations côté serveur** (Triggers PostgreSQL)
- **Rate limiting** (limitation du nombre de requêtes)
- **Fonction Edge** optionnelle pour validation supplémentaire

## 🗄️ Configuration Supabase

### Étape 1 : Exécuter le script SQL

1. Connectez-vous à votre dashboard Supabase
2. Allez dans **SQL Editor**
3. Copiez et exécutez le contenu du fichier `supabase/sql/security.sql`

Ce script va :
- ✅ Activer Row Level Security (RLS) sur la table `leaderboard`
- ✅ Créer des politiques de sécurité (INSERT et SELECT pour utilisateurs anonymes)
- ✅ Créer un trigger de validation avant chaque INSERT
- ✅ Créer des index pour améliorer les performances
- ✅ Configurer la table `core` si elle existe

### Étape 2 : Vérifier la configuration

Après l'exécution du script, vérifiez que :

```sql
-- Vérifier que RLS est activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'leaderboard';
-- rowsecurity doit être 'true'
```

### Limites de validation (serveur)

Le trigger PostgreSQL valide :
- **Score** : entre 0 et 30 000 points
- **Temps** : entre 5 et 300 secondes
- **Pseudo** : entre 3 et 5 lettres majuscules uniquement
- **Rate limiting** : maximum 10 soumissions par heure par session_id

## 💻 Validations côté client

Le code JavaScript valide les données avant l'envoi à Supabase :

### Validations du pseudo
- Longueur : 3 à 5 caractères
- Format : uniquement des lettres majuscules (A-Z)
- Trim automatique des espaces

### Validations du score
- Type : nombre valide
- Plage : 0 à 30 000 points
- Vérification de NaN et Infinity

### Validations du temps
- Type : nombre valide
- Plage : 5 à 300 secondes
- Vérification de NaN et Infinity

### Rate limiting côté client

- **Intervalle minimum** : 20 secondes entre deux soumissions
- **Limite par heure** : 10 soumissions maximum par heure
- **Exception** : les meilleurs scores personnels peuvent être soumis immédiatement

## 🛡️ Validations côté serveur

### Trigger PostgreSQL

Un trigger `validate_leaderboard_before_insert` s'exécute avant chaque INSERT :

```sql
CREATE TRIGGER validate_leaderboard_before_insert
BEFORE INSERT ON leaderboard
FOR EACH ROW
EXECUTE FUNCTION validate_leaderboard_entry();
```

Ce trigger :
- Valide toutes les données
- Applique le rate limiting par session_id
- Normalise le pseudo (majuscules, trim)
- Rejette les entrées invalides avec des messages d'erreur clairs

### Fonction Edge (optionnelle)

Pour une sécurité maximale, vous pouvez déployer la fonction Edge `supabase/edge-function.ts` :

1. Dans Supabase Dashboard, allez dans **Edge Functions**
2. Créez une nouvelle fonction nommée `validate-leaderboard`
3. Copiez le code de `supabase/edge-function.ts`
4. Déployez la fonction

**Note** : La fonction Edge n'est pas nécessaire si le trigger PostgreSQL est actif, mais elle offre une couche supplémentaire de validation.

## ⏱️ Rate Limiting

### Côté client (localStorage)

- Stocke le timestamp de la dernière soumission
- Compte les soumissions dans une fenêtre d'une heure
- Bloque les soumissions si la limite est atteinte

### Côté serveur (PostgreSQL)

- Vérifie le nombre de soumissions par `session_id` dans la dernière heure
- Rejette les soumissions si > 10 par heure
- Utilise un index sur `session_id` pour des performances optimales

## 🔐 Meilleures pratiques

### 1. Clés Supabase

⚠️ **Important** : Les clés Supabase sont exposées dans le code client. C'est normal pour une application publique, mais :

- ✅ Utilisez uniquement la **clé anonyme** (anon key) dans le code client
- ❌ **NE JAMAIS** exposer la **clé de service** (service role key)
- ✅ Configurez correctement les politiques RLS pour limiter les actions possibles

### 2. Données sensibles

- Ne stockez **jamais** de données sensibles (mots de passe, emails, etc.) dans le leaderboard
- Le pseudo est la seule information utilisateur stockée

### 3. Monitoring

Surveillez régulièrement :
- Le nombre de soumissions par jour
- Les scores anormalement élevés
- Les tentatives d'insertion rejetées (dans les logs Supabase)

### 4. Mises à jour de sécurité

- Vérifiez régulièrement les mises à jour de Supabase
- Testez les validations après chaque modification du code
- Gardez une copie de sauvegarde de votre configuration SQL

## 🚨 En cas de problème

### Si quelqu'un contourne les validations

1. **Vérifiez les logs Supabase** : Dashboard → Logs → Postgres Logs
2. **Vérifiez les politiques RLS** : Dashboard → Authentication → Policies
3. **Renforcez les limites** : Modifiez les constantes dans `supabase/sql/security.sql`
4. **Activez la fonction Edge** : Pour une validation supplémentaire

### Si la table est compromise

1. **Nettoyez les données** :
   ```sql
   DELETE FROM leaderboard WHERE score > 30000;
   DELETE FROM leaderboard WHERE time < 5 OR time > 300;
   ```

2. **Réexécutez le script de sécurité** :
   ```sql
   -- Réexécuter supabase/sql/security.sql
   ```

3. **Changez la clé anonyme** : Dashboard → Settings → API → Regenerate anon key

## 📊 Statistiques de sécurité

Les index créés améliorent les performances et la sécurité :

- `idx_leaderboard_score` : Tri rapide par score
- `idx_leaderboard_pseudo` : Recherche par pseudo
- `idx_leaderboard_timestamp` : Rate limiting efficace
- `idx_leaderboard_session` : Suivi des sessions
- `idx_leaderboard_date` : Filtrage par date
- `idx_leaderboard_score_time` : Requêtes combinées

## ✅ Checklist de sécurité

Avant de déployer en production, vérifiez :

- [ ] Script SQL `supabase/sql/security.sql` exécuté
- [ ] RLS activé sur toutes les tables
- [ ] Politiques de sécurité créées
- [ ] Trigger de validation actif
- [ ] Index créés
- [ ] Validations JavaScript en place
- [ ] Rate limiting fonctionnel
- [ ] Tests de validation effectués
- [ ] Clé de service jamais exposée
- [ ] Documentation à jour

## 📞 Support

Pour toute question de sécurité, consultez :
- [Documentation Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Documentation Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

**Dernière mise à jour** : 2024
**Version** : 1.0
