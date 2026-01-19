# Démarrage rapide - Initialisation de la base de données

Votre base de données Neon est déjà connectée ! Il ne reste plus qu'à créer les tables.

## ✅ Étape 1 : Ouvrir l'éditeur SQL

1. Dans votre dashboard Netlify, allez dans l'onglet **"Database"** (extension Neon)
2. Cliquez sur votre base de données **"icy-recipe-81025091"**
3. Cherchez l'onglet **"SQL Editor"** ou **"Query"** dans l'interface

## ✅ Étape 2 : Exécuter le script d'initialisation

1. Copiez tout le contenu du fichier `netlify/database/init.sql`
2. Collez-le dans l'éditeur SQL de Netlify
3. Cliquez sur **"Run"** ou **"Execute"**

Le script va créer :
- ✅ Table `scores` pour les scores des joueurs
- ✅ Table `sessions` pour les sessions de jeu
- ✅ Table `rate_limits` pour la limitation de taux
- ✅ Tous les index nécessaires pour les performances

## ✅ Étape 3 : Vérifier que les tables sont créées

Exécutez cette requête pour vérifier :

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Vous devriez voir :
- `scores`
- `sessions`
- `rate_limits`

## ✅ Étape 4 : Redéployer votre site

```bash
git add .
git commit -m "Configuration Netlify Database terminée"
git push
```

## 🎉 C'est prêt !

Une fois les tables créées et le site redéployé, les scores s'enregistreront automatiquement dans PostgreSQL au lieu de Blobs.

## 🔍 Test rapide

Après le déploiement, testez en jouant une partie. Le score devrait s'enregistrer. Vous pouvez vérifier avec :

```sql
SELECT * FROM scores ORDER BY timestamp DESC LIMIT 5;
```
