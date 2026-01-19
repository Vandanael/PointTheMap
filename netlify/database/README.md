# Migrations de base de données

## Migration: Ajouter game_type à sessions

### Problème
La colonne `game_type` est manquante dans la table `sessions`, ce qui cause une erreur 500 lors de l'insertion de nouvelles sessions.

### Solution
Exécuter le script de migration `migration_add_game_type.sql` sur votre base de données Netlify/Neon.

### Comment exécuter la migration

#### Option 1: Via l'interface Netlify
1. Allez dans votre projet Netlify
2. Ouvrez l'onglet "Data" ou "Database"
3. Cliquez sur "Query" ou "SQL Editor"
4. Copiez-collez le contenu de `migration_add_game_type.sql`
5. Exécutez la requête

#### Option 2: Via psql ou un client PostgreSQL
```bash
psql $NETLIFY_DATABASE_URL -f netlify/database/migration_add_game_type.sql
```

#### Option 3: Via l'interface Neon
1. Connectez-vous à votre projet Neon
2. Ouvrez l'éditeur SQL
3. Copiez-collez le contenu de `migration_add_game_type.sql`
4. Exécutez la requête

### Vérification
Après avoir exécuté la migration, vérifiez que la colonne existe :
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'sessions' AND column_name = 'game_type';
```

Vous devriez voir :
```
column_name | data_type | column_default
------------+-----------+----------------
game_type   | character varying(10) | 'classic'
```
