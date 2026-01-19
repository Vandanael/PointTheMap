# Migration vers Netlify Database

## 🎯 Pourquoi migrer ?

L'application utilisait **Netlify Blobs** pour stocker les scores, mais cela ne fonctionnait pas correctement sur Netlify. Nous avons migré vers **Netlify Database** (PostgreSQL via Neon) qui est plus fiable et adapté pour stocker des données structurées comme des scores de leaderboard.

## 📋 Étapes pour activer la base de données

### 1. Ajouter la base de données sur Netlify

1. Connectez-vous à [Netlify Dashboard](https://app.netlify.com)
2. Sélectionnez votre site **PointTheMap**
3. Allez dans l'onglet **"Data & Storage"** ou cherchez **"Database"** dans le menu
4. Cliquez sur **"Add Database"** ou **"Connect Database"**
5. Choisissez **Neon** (PostgreSQL)
6. Suivez les instructions pour créer la base de données
7. **IMPORTANT** : Cliquez sur **"Claim Database"** pour éviter qu'elle soit supprimée après 7 jours

### 2. Initialiser les tables

Une fois la base créée, vous devez exécuter le script SQL :

**Méthode recommandée : Via l'interface Netlify**
1. Dans l'onglet Database de votre site
2. Cliquez sur **"SQL Editor"** ou **"Query"**
3. Copiez-collez le contenu de `netlify/database/init.sql`
4. Exécutez le script

**Alternative : Via la CLI**
```bash
# Si vous avez la CLI Netlify installée
netlify db:init
# Puis exécutez le script init.sql depuis l'interface
```

### 3. Vérifier la variable d'environnement

Netlify crée automatiquement `NETLIFY_DATABASE_URL` et `NETLIFY_DATABASE_URL_UNPOOLED`. Vérifiez dans :
- **Site settings** → **Environment variables**

Ces variables sont automatiquement ajoutées par l'extension Neon, vous n'avez rien à faire manuellement.

### 4. Installer les dépendances

```bash
npm install
```

Cela installera `@netlify/neon` qui est nécessaire pour se connecter à la base de données.

### 5. Redéployer

```bash
git add .
git commit -m "Migration vers Netlify Database pour les scores"
git push
```

Netlify redéploiera automatiquement avec la nouvelle configuration.

## ✅ Vérification

Après le déploiement :

1. **Testez l'enregistrement d'un score** :
   - Jouez une partie
   - Vérifiez que le score s'enregistre sans erreur

2. **Vérifiez le leaderboard** :
   - Consultez le leaderboard
   - Les scores devraient apparaître

3. **Vérifiez les logs** :
   - Allez dans **Functions** → **Logs**
   - Il ne devrait pas y avoir d'erreurs liées à `DATABASE_URL`

## 🔧 Dépannage

### Erreur : "NETLIFY_DATABASE_URL is not defined"

**Solution** :
1. Vérifiez que la base de données est bien connectée à votre site (onglet Database)
2. Vérifiez que les variables `NETLIFY_DATABASE_URL` et `NETLIFY_DATABASE_URL_UNPOOLED` existent dans les settings
3. Si elles n'existent pas, reconnectez la base de données via l'extension Neon
4. Redéployez après vérification

### Erreur : "relation does not exist"

**Solution** :
1. Exécutez le script `netlify/database/init.sql` dans l'éditeur SQL de Netlify
2. Vérifiez que vous êtes connecté à la bonne base de données

### Les scores ne s'enregistrent toujours pas

**Solution** :
1. Vérifiez les logs des fonctions dans le dashboard Netlify
2. Vérifiez que les tables existent : exécutez `SELECT * FROM scores LIMIT 1;` dans l'éditeur SQL
3. Testez la connexion depuis l'interface Netlify

### Fallback sur Blobs

Si la base de données n'est pas disponible, le code utilisera automatiquement Blobs comme solution de secours pour le rate limiting. Les scores nécessitent cependant PostgreSQL.

## 📊 Structure de la base de données

- **Table `scores`** : Stocke tous les scores des joueurs
- **Table `sessions`** : Sessions de jeu (peut aussi utiliser Blobs)
- **Table `rate_limits`** : Limites de taux pour éviter le spam

Voir `netlify/database/schema.sql` pour plus de détails.

## 🎉 Avantages de cette migration

- ✅ **Plus fiable** : PostgreSQL est une vraie base de données relationnelle
- ✅ **Meilleures performances** : Requêtes SQL optimisées avec index
- ✅ **Plus facile à maintenir** : Structure de données claire
- ✅ **Scalable** : Peut gérer beaucoup plus de scores
- ✅ **Requêtes complexes** : Possibilité de faire des statistiques avancées
