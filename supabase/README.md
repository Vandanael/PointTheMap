# 📁 Configuration Supabase

Ce dossier contient toute la configuration et la documentation liée à Supabase pour PointTheMap.

## 📂 Structure

```
supabase/
├── sql/
│   ├── security.sql              # ⭐ Script principal de sécurité
│   ├── anti-hack-simple.sql      # ⭐ Renforce le trigger (anti-hack)
│   ├── reactiver-insert-anonymes.sql  # Réactiver les INSERT si bloqués
│   ├── block-direct-api.sql      # Bloquer INSERT directs (avancé)
│   ├── security-enhanced.sql     # Version renforcée (alternative)
│   └── security-old.sql           # Archive
├── docs/
│   ├── INSTALL-SECURITY.md       # ⭐ Installation en 5 minutes
│   ├── SECURITY.md               # Documentation complète
│   ├── TROUBLESHOOTING.md        # ⭐ Dépannage et solutions
│   └── DEPLOY-EDGE-FUNCTION.md   # Déployer Edge Function
└── edge-function.ts              # Fonction Edge optionnelle
```

## 🚀 Installation rapide

1. Ouvrez votre [Dashboard Supabase](https://app.supabase.com)
2. Allez dans **SQL Editor**
3. **Première fois** : Copiez-collez le contenu de `sql/security.sql`
4. **Anti-hack** : Copiez-collez le contenu de `sql/anti-hack-simple.sql`
5. Exécutez les scripts

Pour plus de détails, consultez [`docs/INSTALL-SECURITY.md`](docs/INSTALL-SECURITY.md)

## 🛡️ Bloquer les hacks CORS/API directe

Si quelqu'un contourne votre code JavaScript :
1. Exécutez `sql/anti-hack-simple.sql` (renforce le trigger)
2. Ou consultez [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) pour les solutions

## 📚 Documentation

- **[INSTALL-SECURITY.md](docs/INSTALL-SECURITY.md)** : Guide d'installation en 5 minutes
- **[SECURITY.md](docs/SECURITY.md)** : Documentation complète de sécurité
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** : Dépannage et solutions rapides
- **[DEPLOY-EDGE-FUNCTION.md](docs/DEPLOY-EDGE-FUNCTION.md)** : Déployer la Edge Function

## 🔧 Fichiers

### `sql/security.sql` ⭐
**Script principal à utiliser** - Version sécurisée avec vérifications avant suppression.

### `sql/security-complete.sql`
Version alternative avec DROP IF EXISTS (peut générer des avertissements dans Supabase).

### `edge-function.ts`
Fonction Edge Supabase optionnelle pour validation serveur supplémentaire.

## ✅ Checklist de sécurité

- [ ] Script `sql/security.sql` exécuté dans Supabase
- [ ] RLS activé sur la table `leaderboard`
- [ ] Trigger de validation actif
- [ ] Politiques de sécurité créées
- [ ] Application testée et fonctionnelle

---

**Dernière mise à jour** : 2024
