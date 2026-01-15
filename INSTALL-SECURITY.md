# 🚀 Installation Rapide - Sécurité PointTheMap

Guide rapide pour sécuriser votre application PointTheMap en 5 minutes.

## ⚡ Installation Express (5 minutes)

### Étape 1 : Exécuter le script SQL (2 minutes)

1. Ouvrez votre [Dashboard Supabase](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor** (menu de gauche)
4. Cliquez sur **New query**
5. Copiez **TOUT** le contenu du fichier `supabase-security.sql`
6. Collez dans l'éditeur SQL
7. Cliquez sur **Run** (ou appuyez sur `Ctrl+Enter`)

✅ **Vérification** : Vous devriez voir des messages de succès dans la console.

### Étape 2 : Vérifier que tout fonctionne (1 minute)

Dans le SQL Editor, exécutez cette requête pour vérifier :

```sql
-- Vérifier que RLS est activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'leaderboard';
```

Le résultat doit montrer `rowsecurity = true`.

### Étape 3 : Tester votre application (2 minutes)

1. Ouvrez votre application PointTheMap
2. Jouez une partie
3. Essayez de soumettre un score
4. Vérifiez que ça fonctionne normalement

✅ **C'est tout !** Votre application est maintenant sécurisée.

## 🔍 Vérifications supplémentaires (optionnel)

### Vérifier les politiques RLS

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'leaderboard';
```

Vous devriez voir au moins 2 politiques :
- `Allow anonymous inserts to leaderboard`
- `Allow public read access to leaderboard`

### Vérifier le trigger

```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'leaderboard';
```

Vous devriez voir le trigger `validate_leaderboard_before_insert`.

## 🛡️ Test de sécurité

Pour tester que la sécurité fonctionne, essayez d'insérer un score invalide :

```sql
-- Cette requête devrait ÉCHOUER
INSERT INTO leaderboard (pseudo, score, time, wordle, date, timestamp, session_id)
VALUES ('AB', 999999, 1, 'test', '2024-01-01', 1234567890, 'test');
```

Vous devriez recevoir une erreur de validation.

## ⚠️ En cas de problème

### Erreur : "relation does not exist"
- Vérifiez que la table `leaderboard` existe dans votre projet Supabase
- Vérifiez que vous êtes connecté au bon projet

### Erreur : "permission denied"
- Assurez-vous d'utiliser un compte administrateur Supabase
- Vérifiez que vous avez les droits sur le projet

### Les scores ne s'enregistrent plus
- Vérifiez les logs Supabase : Dashboard → Logs → Postgres Logs
- Vérifiez que les politiques RLS permettent les INSERT anonymes
- Vérifiez que le trigger ne rejette pas toutes les entrées

## 📚 Documentation complète

Pour plus de détails, consultez `SECURITY.md`.

## ✅ Checklist finale

- [ ] Script SQL exécuté sans erreur
- [ ] RLS activé (vérifié avec la requête)
- [ ] Politiques créées (vérifié avec la requête)
- [ ] Trigger actif (vérifié avec la requête)
- [ ] Application testée et fonctionnelle
- [ ] Test de sécurité réussi (insertion invalide rejetée)

---

**Besoin d'aide ?** Consultez `SECURITY.md` pour la documentation complète.
