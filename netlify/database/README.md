# Configuration de Netlify Database

Ce projet utilise maintenant **Netlify Database** (PostgreSQL via Neon) pour stocker les scores de manière fiable.

## Étapes de configuration

### 1. Ajouter la base de données sur Netlify

1. Connectez-vous à votre dashboard Netlify
2. Sélectionnez votre site
3. Allez dans l'onglet **"Data & Storage"** ou **"Database"**
4. Cliquez sur **"Add Database"** ou **"Connect Database"**
5. Suivez les instructions pour créer une nouvelle base de données PostgreSQL (via Neon)

### 2. Initialiser les tables

Une fois la base de données créée, vous devez exécuter le script SQL d'initialisation :

**Option A : Via l'interface Netlify**
1. Dans l'onglet Database de votre site
2. Ouvrez l'éditeur SQL
3. Copiez-collez le contenu de `netlify/database/init.sql`
4. Exécutez le script

**Option B : Via la CLI Netlify**
```bash
npx netlify db:init
# Puis exécutez le script init.sql
```

### 3. Vérifier la variable d'environnement

Netlify devrait automatiquement créer la variable d'environnement `DATABASE_URL`. Vérifiez qu'elle est présente dans :
- **Site settings** → **Environment variables**

Si elle n'est pas là, vous pouvez la récupérer depuis l'onglet Database de votre site.

### 4. Redéployer

Après avoir configuré la base de données, redéployez votre site :
```bash
git add .
git commit -m "Migration vers Netlify Database"
git push
```

## Structure de la base de données

### Table `scores`
Stocke tous les scores des joueurs :
- `id` : Identifiant unique
- `pseudo` : Pseudo du joueur (3-5 lettres majuscules)
- `score` : Score total
- `time` : Temps de jeu en millisecondes
- `rounds` : Détails des rounds (JSONB)
- `timestamp` : Timestamp de la partie
- `game_type` : Type de jeu ('classic' ou 'daily')
- `ip` : Adresse IP (pour sécurité)
- `created_at` : Date de création

### Table `sessions`
Stocke les sessions de jeu temporaires (peut aussi utiliser Blobs)

### Table `rate_limits`
Gère les limites de taux pour éviter le spam

## Migration depuis Blobs

Si vous aviez des scores dans Blobs, vous pouvez les migrer manuellement ou les laisser. Les nouveaux scores seront automatiquement enregistrés dans PostgreSQL.

## Dépannage

### Erreur "DATABASE_URL is not defined"
- Vérifiez que la base de données est bien connectée à votre site
- Vérifiez que la variable d'environnement `DATABASE_URL` existe
- Redéployez après avoir ajouté la variable

### Erreur "relation does not exist"
- Exécutez le script `init.sql` pour créer les tables
- Vérifiez que vous êtes connecté à la bonne base de données

### Les scores ne s'enregistrent pas
- Vérifiez les logs des fonctions Netlify dans le dashboard
- Vérifiez que les tables existent bien
- Testez la connexion à la base de données depuis l'interface Netlify
