# ✅ Vérifier que les Joueurs Peuvent Soumettre leurs Scores

## 🔍 Situation Actuelle

Votre code JavaScript est configuré avec un **fallback automatique** :

1. **Essaie d'abord** la Edge Function (si déployée)
2. **Si ça échoue** → utilise l'insertion directe automatiquement
3. **Les joueurs peuvent toujours soumettre** leurs scores ✅

## ✅ Vérification Rapide

### Option 1 : Edge Function déployée (Recommandé)

Si vous avez déployé la Edge Function `validate-leaderboard` :

✅ **Les joueurs peuvent soumettre** via la Edge Function
✅ **Les hacks sont bloqués** par la validation serveur
✅ **Tout fonctionne normalement**

### Option 2 : Edge Function non déployée

Si la Edge Function n'est **pas encore déployée** :

✅ **Les joueurs peuvent toujours soumettre** (fallback automatique)
✅ **L'insertion directe fonctionne** (via le trigger PostgreSQL)
⚠️ **Les hacks CORS sont possibles** (mais bloqués par le trigger)

## 🚨 Problème : INSERT Directs Bloqués

Si vous avez exécuté `block-direct-api.sql` qui bloque les INSERT anonymes :

❌ **Les joueurs ne peuvent plus soumettre** si la Edge Function n'est pas déployée
✅ **Solution** : Déployez la Edge Function OU réactivez les INSERT directs

### Solution A : Déployer la Edge Function (Recommandé)

1. Déployez la Edge Function `validate-leaderboard`
2. Les joueurs pourront soumettre via la fonction
3. Les hacks seront bloqués

### Solution B : Réactiver les INSERT Directs

Si vous voulez permettre les insertions directes (moins sécurisé) :

```sql
-- Dans Supabase SQL Editor
-- Réactiver les INSERT anonymes
DROP POLICY IF EXISTS "Only authenticated inserts" ON leaderboard;

CREATE POLICY "Public insert access"
ON leaderboard
FOR INSERT
TO anon
WITH CHECK (true);
```

⚠️ **Note** : Cela permet les hacks CORS, mais le trigger PostgreSQL les bloquera quand même.

## 🧪 Test Rapide

1. **Ouvrez votre application**
2. **Jouez une partie**
3. **Soumettez un score**
4. **Vérifiez la console** (F12) :
   - Si vous voyez "Edge Function not available" → La fonction n'est pas déployée, mais le fallback fonctionne
   - Si pas d'erreur → Tout fonctionne ✅

## 📊 État Actuel de Votre Code

Votre code dans `index.html` fait ceci :

```javascript
try {
    // 1. Essaie la Edge Function
    const result = await supabaseClient.functions.invoke('validate-leaderboard', {...});
    // Si succès → utilise le résultat
} catch (error) {
    // 2. Si échec → fallback automatique sur insertion directe
    const result = await supabaseClient.from('leaderboard').insert([entry]);
    // Les joueurs peuvent toujours soumettre !
}
```

## ✅ Conclusion

**Les joueurs peuvent toujours soumettre leurs scores** grâce au fallback automatique.

**Pour une sécurité maximale** :
- ✅ Déployez la Edge Function
- ✅ (Optionnel) Bloquez les INSERT directs avec `block-direct-api.sql`

**Pour garder la simplicité** :
- ✅ Laissez le code actuel (fallback automatique)
- ✅ Le trigger PostgreSQL bloque déjà les hacks

---

**Tout fonctionne normalement pour les joueurs !** 🎮
