# 📁 Configuration Supabase

Ce dossier contient toute la configuration et la documentation liée à Supabase pour PointTheMap.

## 📂 Structure

```
supabase/
├── sql/
│   ├── security.sql                    # ⭐ Script principal de sécurité
│   ├── anti-hack-simple.sql            # ⭐ Renforce le trigger (anti-hack)
│   ├── fix-leaderboard-read-access.sql # ⭐ Corrige l'erreur 401 (lecture publique)
│   ├── reactiver-insert-anonymes.sql   # Réactiver les INSERT si bloqués
│   └── verifier-securite.sql           # Script de vérification
└── docs/
    ├── INSTALL-SECURITY.md       # ⭐ Installation en 5 minutes
    ├── SECURITY.md               # Documentation complète
    ├── TROUBLESHOOTING.md        # ⭐ Dépannage et solutions
    └── VERIFIER-SECURITE.md      # Guide de vérification
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
- **[VERIFIER-SECURITE.md](docs/VERIFIER-SECURITE.md)** : Guide de vérification

## 🔧 Fichiers

### `sql/security.sql` ⭐
**Script principal à utiliser** - Version sécurisée avec vérifications avant suppression.

### `sql/anti-hack-simple.sql` ⭐
**Script anti-hack** - Renforce le trigger avec validations basées sur la logique du jeu.

## ✅ Checklist de sécurité

- [ ] Script `sql/security.sql` exécuté dans Supabase
- [ ] RLS activé sur la table `leaderboard`
- [ ] Trigger de validation actif
- [ ] Politiques de sécurité créées
- [ ] Application testée et fonctionnelle

---

**Dernière mise à jour** : 2024
