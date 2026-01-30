# Système de Joueur Anonyme - Résumé d'implémentation

## ✅ LIVRABLES

### 1. Fichiers créés

```
netlify/
├── database/
│   └── migrations/
│       └── 002_add_player_tokens.sql        ← Migration SQL
└── functions/
    └── generate-player-token.js             ← Endpoint génération token

src/
└── services/
    └── PlayerAuth.js                        ← Service client token

PLAYER_TOKEN_TESTING.md                      ← Documentation test
IMPLEMENTATION_SUMMARY.md                    ← Ce fichier
```

### 2. Fichiers modifiés

```
package.json                                 ← Ajout jsonwebtoken
netlify/functions/start.js                   ← Validation player token
netlify/functions/submit.js                  ← Association player_id au score
src/services/api.js                          ← Injection Authorization header
```

---

## 📐 ARCHITECTURE

### Flow complet

```
┌────────────────────────────────────────────────────────────┐
│                    1. GÉNÉRATION TOKEN                     │
└────────────────────────────────────────────────────────────┘

Client (au démarrage)
  ↓
  Vérifie localStorage['player_token']
  ↓
  Si absent/expiré:
    POST /.netlify/functions/generate-player-token
    ← { token: "JWT...", player_id: "uuid", expires_in: "1y" }
  ↓
  Stocke en localStorage


┌────────────────────────────────────────────────────────────┐
│                    2. START GAME                           │
└────────────────────────────────────────────────────────────┘

Client
  ↓
  POST /.netlify/functions/start
  Header: Authorization: Bearer <player_token>
  Body: { gameType: "classic" }
  ↓
Serveur:
  ✓ Valide JWT
  ✓ Extrait player_id
  ✓ Update players.last_seen
  ✓ Génère session (UUID)
  ✓ Stocke player_id dans session
  ✓ Sélectionne 5 capitales
  ↓
  ← { token: "session-uuid", capitals: [...], csrfToken: "..." }


┌────────────────────────────────────────────────────────────┐
│                    3. SUBMIT SCORE                         │
└────────────────────────────────────────────────────────────┘

Client
  ↓
  POST /.netlify/functions/submit
  Header: Authorization: Bearer <player_token>
  Header: X-CSRF-Token: <csrf_token>
  Body: { token: "session-uuid", rounds: [...], pseudo: "ABC" }
  ↓
Serveur:
  ✓ Récupère session (contient player_id)
  ✓ Valide CSRF token
  ✓ Valide session non expirée/utilisée
  ✓ RECALCULE tous les scores (anti-cheat)
  ✓ Valide distances, temps, coordonnées
  ✓ Insert score avec player_id
  ✓ Update players.total_games, players.total_score
  ↓
  ← { score, rank, isTopFifty, rounds }
```

---

## 🗄️ SCHEMA BASE DE DONNÉES

### Table `players` (nouvelle)

```sql
CREATE TABLE players (
  player_id UUID PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_games INTEGER DEFAULT 0,
  total_score BIGINT DEFAULT 0
);
```

### Table `scores` (modifiée)

```sql
ALTER TABLE scores ADD COLUMN player_id UUID REFERENCES players(player_id);
CREATE INDEX idx_scores_player_id ON scores(player_id);
```

### Table `sessions` (modifiée)

```sql
ALTER TABLE sessions ADD COLUMN player_id UUID REFERENCES players(player_id);
CREATE INDEX idx_sessions_player_id ON sessions(player_id);
```

---

## 🔐 SÉCURITÉ

### Ce qui est déjà fait

✅ **Scoring côté serveur** (anti-cheat)
  - Recalcul de toutes les distances (Haversine)
  - Validation des coordonnées (-90→90, -180→180)
  - Validation du temps (15s–10min)
  - Tolérance ±1 point avec score client

✅ **CSRF protection**
  - Token généré dans `/start`
  - Validé dans `/submit`

✅ **Rate limiting**
  - 50 soumissions/heure par IP

✅ **Double submit prevention**
  - Flag `used` dans sessions

✅ **Session expiration**
  - 10 minutes max

### Ce qui est ajouté

✅ **Player token JWT**
  - Signé avec `JWT_SECRET`
  - Expire après 1 an
  - Auto-refresh côté client (< 1 jour restant)

✅ **Player tracking**
  - UUID non-devinable
  - Statistiques persistantes (total_games, total_score)
  - last_seen pour analytics

---

## 🚀 DÉPLOIEMENT

### 1. Configuration Netlify

Dans **Site settings → Environment variables**, ajouter :

```bash
JWT_SECRET=<générer-avec-commande-ci-dessous>
```

Générer une clé sécurisée :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Migration SQL

Exécuter la migration sur Neon :

```bash
psql $NETLIFY_DATABASE_URL -f netlify/database/migrations/002_add_player_tokens.sql
```

Ou via Neon Console :
1. Aller sur https://console.neon.tech
2. Sélectionner votre projet
3. Onglet **SQL Editor**
4. Copier-coller le contenu de `002_add_player_tokens.sql`
5. Exécuter

### 3. Vérifier la migration

```sql
-- Vérifier que la table existe
SELECT * FROM players LIMIT 1;

-- Vérifier les colonnes ajoutées
SELECT column_name FROM information_schema.columns
WHERE table_name = 'scores' AND column_name = 'player_id';
```

### 4. Déployer sur Netlify

```bash
git add .
git commit -m "feat: add anonymous player token system with JWT"
git push origin main
```

Netlify déploiera automatiquement.

---

## 🧪 COMMENT TESTER

### Test rapide (2 commandes)

```bash
# 1. Générer un token
curl -X POST https://localhost:8888/.netlify/functions/generate-player-token | jq .

# 2. Démarrer une partie avec le token
curl -X POST https://localhost:8888/.netlify/functions/start \
  -H "Authorization: Bearer <votre-token>" \
  -H "Content-Type: application/json" \
  -d '{"gameType":"classic"}' | jq .
```

### Test complet

Voir le fichier **`PLAYER_TOKEN_TESTING.md`** pour :
- Tests browser console
- Tests cURL complets
- Vérification base de données
- Troubleshooting

---

## 📊 DIFFÉRENCES AVANT/APRÈS

### AVANT (système actuel)

```
Identification joueur:
  └─ Pseudo (3-5 lettres) + IP-lock

Problèmes:
  ❌ Pseudo éphémère (ressaisie à chaque partie)
  ❌ IP-lock fragile (change de réseau = nouveau pseudo)
  ❌ Pas de continuité joueur
  ❌ Pas de stats globales par joueur
```

### APRÈS (avec player token)

```
Identification joueur:
  └─ Player ID (UUID) + JWT token

Avantages:
  ✅ Token persistant (1 an)
  ✅ Continuité sur même device (localStorage)
  ✅ Stats par joueur (total_games, total_score)
  ✅ Cryptographiquement sûr
  ✅ Auto-refresh transparent
  ✅ Extensible (futur: sync multi-devices, achievements, etc.)
```

---

## 🔍 VALIDATION ANTI-CHEAT

Le système de validation côté serveur **reste intact et inchangé** :

```javascript
// netlify/functions/submit.js:334-367

✓ Recalcul distances Haversine
✓ Recalcul scores avec formule Sigmoid V2
✓ Validation coordonnées dans plage valide
✓ Validation temps plausible
✓ Time bonus (daily mode)
✓ Comparaison score client vs serveur (tolérance ±1)
```

Le player token **n'affecte pas** la sécurité du scoring. Il sert uniquement à :
- Identifier de manière persistante un joueur anonyme
- Tracker les stats (parties jouées, score total)

---

## 📈 PROCHAINES ÉTAPES (optionnel)

Fonctionnalités possibles à ajouter :

1. **Endpoint stats joueur**
   ```
   GET /.netlify/functions/player-stats
   Authorization: Bearer <token>
   ← { total_games, total_score, avg_score, best_score, rank }
   ```

2. **Historique des parties**
   ```sql
   SELECT s.score, s.time, s.timestamp
   FROM scores s
   WHERE s.player_id = $1
   ORDER BY s.timestamp DESC
   LIMIT 10;
   ```

3. **Achievements / Badges**
   - Première partie
   - 10 parties jouées
   - Score > 20000
   - Streak de 5 parties

4. **Sync multi-devices** (avancé)
   - Générer un code de sync (6 chiffres)
   - Partager player_id entre devices
   - Nécessite endpoint serveur

5. **Leaderboard par joueur**
   - Meilleur score d'un player_id
   - Déduplication automatique

---

## ⚠️ NOTES IMPORTANTES

### Ce que le système permet

✅ Identifier un joueur anonyme de manière persistante
✅ Suivre les stats d'un joueur dans le temps
✅ Éviter les doublons de scores du même joueur
✅ Pas de friction (pas de login requis)

### Ce que le système N'empêche PAS

❌ Un utilisateur peut nettoyer localStorage et obtenir un nouveau player_id
❌ Un utilisateur peut jouer depuis plusieurs navigateurs = plusieurs player_ids
❌ Pas de rate limiting par player_id (uniquement par IP)

**C'est voulu** : système anonyme = pas de contrainte forte.

### Rétrocompatibilité

✅ Les anciens scores (sans player_id) restent valides
✅ Le système fonctionne avec ou sans player token
✅ Si pas de token fourni : player_id = NULL (OK)

---

## 📝 CHANGELOG

### Version 1.0 - Player Token System

**Ajouté :**
- Table `players` avec stats (total_games, total_score)
- Endpoint `generate-player-token` (JWT, 1 an d'expiration)
- Service client `PlayerAuth` (auto-init, auto-refresh)
- Validation JWT dans `start.js` et `submit.js`
- Association `player_id` dans scores et sessions
- Migration SQL `002_add_player_tokens.sql`
- Documentation complète de test

**Modifié :**
- `package.json` : ajout `jsonwebtoken@^9.0.2`
- `start.js` : validation player token, update last_seen
- `submit.js` : association player_id, update stats joueur
- `api.js` : injection Authorization header automatique

**Inchangé :**
- Calcul des scores (formule Sigmoid V2)
- Anti-cheat (recalcul côté serveur)
- CSRF protection
- Rate limiting
- Sélection des capitales

---

## 🆘 SUPPORT

En cas de problème :

1. **Vérifier les logs Netlify Functions** :
   - Dashboard Netlify → Functions → Logs

2. **Vérifier la base de données** :
   ```sql
   SELECT * FROM players ORDER BY created_at DESC LIMIT 5;
   SELECT * FROM scores WHERE player_id IS NOT NULL LIMIT 5;
   ```

3. **Tester en local** :
   ```bash
   netlify dev
   # Puis ouvrir http://localhost:8888
   ```

4. **Consulter `PLAYER_TOKEN_TESTING.md`** pour troubleshooting détaillé

---

**Système prêt à déployer ! 🚀**
