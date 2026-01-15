# 📁 Configuration Supabase

Ce dossier contient toute la configuration et la documentation liée à Supabase pour PointTheMap.

## 📂 Structure

```
supabase/
├── sql/
│   ├── security.sql              # ⭐ Script principal de sécurité (à utiliser)
│   ├── security-complete.sql      # Version complète (alternative)
│   └── security-old.sql           # Ancienne version (archive)
├── docs/
│   ├── SECURITY.md                # Documentation complète de sécurité
│   └── INSTALL-SECURITY.md        # Guide d'installation rapide
└── edge-function.ts               # Fonction Edge optionnelle
```

## 🚀 Installation rapide

1. Ouvrez votre [Dashboard Supabase](https://app.supabase.com)
2. Allez dans **SQL Editor**
3. Copiez-collez le contenu de `sql/security.sql`
4. Exécutez le script

Pour plus de détails, consultez [`docs/INSTALL-SECURITY.md`](docs/INSTALL-SECURITY.md)

## 📚 Documentation

- **[INSTALL-SECURITY.md](docs/INSTALL-SECURITY.md)** : Guide d'installation en 5 minutes
- **[SECURITY.md](docs/SECURITY.md)** : Documentation complète de sécurité

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
