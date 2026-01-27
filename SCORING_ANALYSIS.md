# Analyse Game Design - Système de Scoring

**Date:** 27 janvier 2026  
**Analyste:** Game Designer / Level Designer Review  
**Version:** 1.0

---

## 📊 Vue d'ensemble

Le système de scoring actuel utilise une courbe basée uniquement sur la distance, avec un score maximum de 5000 points par round (25000 points maximum pour une partie de 5 rounds).

### Configuration actuelle
- **Rounds par partie:** 5
- **Score max par round:** 5000 points
- **Score total maximum:** 25000 points
- **Timer:** 5000ms + 500ms de grâce
- **Bonus temps:** Aucun (le temps n'affecte pas le score)

---

## 📈 Analyse de la courbe de score

### Formule mathématique

La courbe est divisée en 4 segments :

1. **< 1km** : Score fixe de 5000 points (Perfect)
2. **1-100km** : Décroissance exponentielle `5000 * exp(-distance/280)`
3. **100-500km** : Interpolation linéaire entre ~3498 et 1000 points
4. **> 500km** : Décroissance exponentielle `1000 * exp(-excess/800)`

### Points de référence

| Distance | Score | Pourcentage | Catégorie |
|----------|-------|-------------|-----------|
| 0.5 km | 5000 | 100% | Perfect |
| 5 km | 4912 | 98.2% | Excellent |
| 50 km | 4182 | 83.6% | Good |
| 200 km | 2874 | 57.5% | Fair |
| 1000 km | 535 | 10.7% | Poor |
| 5000 km | 4 | 0.1% | Poor |
| 10000+ km | 0 | 0% | Poor |

---

## 🎯 Catégories de score

### Définition actuelle (ScoringSystem)

| Catégorie | Distance | Score | Pourcentage |
|-----------|----------|-------|-------------|
| **Perfect** | < 1km | 4982-5000 | 99.6-100% |
| **Excellent** | 1-50km | 4182-4982 | 83.6-99.6% |
| **Good** | 50-200km | 2874-4182 | 57.5-83.6% |
| **Fair** | 200-1000km | 535-2874 | 10.7-57.5% |
| **Poor** | > 1000km | 0-535 | 0-10.7% |

### Problème d'incohérence UI

⚠️ **INCOHÉRENCE DÉTECTÉE:** Les seuils dans l'UI (`components.js`) ne correspondent pas aux catégories du ScoringSystem :

- UI utilise: 50km, 200km, 500km, 1000km pour les icônes
- ScoringSystem utilise: 1km, 50km, 200km, 1000km pour les catégories

---

## ⚠️ Problèmes identifiés

### 🔴 HIGH - Discontinuité à 1km

**Problème:** Le score passe de 5000 points (0.99km) à 4982 points (1km) - une chute de 18 points pour seulement 0.01km de différence.

**Impact:** 
- Frustration si le joueur est juste au-dessus de 1km
- Sentiment d'injustice
- La transition Perfect → Excellent est trop brutale

**Recommandation:**
- Lisser la transition avec une zone de transition (ex: 0.8-1.2km)
- Ou étendre la zone "Perfect" jusqu'à 2-5km pour réduire la frustration

### 🟡 MEDIUM - Transitions de formule

**Problème:** Changements de formule à 100km et 500km peuvent créer des discontinuités subtiles dans la dérivée.

**Impact:** 
- La courbe peut sembler "cassée" visuellement
- Sensation d'injustice autour de ces seuils

**Recommandation:**
- Vérifier la continuité mathématique (C1) aux points de transition
- Assurer que la dérivée est continue

### 🟢 LOW - Zone "Excellent" restrictive

**Problème:** La zone excellent (1-50km) donne entre 4182 et 4982 points - écart de seulement 800 points.

**Impact:** 
- Peu de différenciation entre les bonnes performances
- Un joueur à 1km et un à 50km ont une différence de seulement 16% de score

**Recommandation:**
- Considérer une courbe plus progressive dans cette zone
- Ou ajuster les seuils de catégories

### 🟢 LOW - Zone "Poor" généreuse

**Problème:** À 1000km, le score est encore 535 points (10.7%).

**Impact:** 
- Les très mauvaises performances sont encore récompensées
- Réduit la valeur d'une bonne performance

**Recommandation:**
- Considérer une décroissance plus rapide après 1000km
- Ou réduire le score minimum à 0 plus rapidement

---

## ⚖️ Équilibrage par niveau de compétence

### Score moyen théorique

| Niveau | Distance moyenne | Score/round | Score total (5 rounds) |
|--------|------------------|-------------|----------------------|
| **Expert** | ~50km | ~4182 (83.6%) | ~20910 |
| **Intermédiaire** | ~300km | ~2249 (45.0%) | ~11245 |
| **Débutant** | ~2000km | ~153 (3.1%) | ~765 |

### Analyse

✅ **Points positifs:**
- Bonne différenciation entre les niveaux
- Les experts peuvent atteindre ~80% du score max
- Les débutants obtiennent encore quelques points (motivation)

⚠️ **Points d'attention:**
- L'écart entre Expert et Intermédiaire est important (presque 2x)
- L'écart entre Intermédiaire et Débutant est très large (15x)

---

## 📉 Sensibilité du score (Taux de décroissance)

### Perte de points pour +10km

| Zone | Distance | Score | Perte (+10km) | % Perte |
|------|----------|-------|---------------|---------|
| Excellent (début) | 1km | 4982 | 175 | 3.51% |
| Excellent (milieu) | 10km | 4825 | 170 | 3.52% |
| Excellent (fin) | 50km | 4182 | 146 | 3.49% |
| Good (début) | 100km | 3498 | 62 | 1.77% |
| Good (fin) | 200km | 2874 | 63 | 2.19% |
| Fair (milieu) | 500km | 1000 | 12 | 1.20% |
| Poor (début) | 1000km | 535 | 6 | 1.12% |

### Analyse

✅ **Points positifs:**
- La sensibilité est élevée dans la zone "Excellent" (3.5% par 10km) - récompense la précision
- La sensibilité diminue progressivement - évite la frustration pour les grandes distances

⚠️ **Points d'attention:**
- La transition entre Excellent et Good montre une chute de sensibilité (3.5% → 1.8%)
- Cela peut créer une sensation de "mur" à 50km

---

## 💡 Recommandations prioritaires

### 1. 🔴 CRITIQUE - Corriger l'incohérence UI/ScoringSystem

**Action:** Aligner les seuils entre `components.js` et `ScoringSystem.js`

**Options:**
- Utiliser les catégories du ScoringSystem dans l'UI
- Ou créer une constante partagée pour les seuils

**Impact:** Améliore la cohérence et la compréhension du joueur

---

### 2. 🟡 IMPORTANT - Lisser la transition à 1km

**Action:** Réduire la discontinuité à la transition Perfect → Excellent

**Solution proposée:**
```javascript
// Au lieu de:
if (distanceKm < 1) return MAX_SCORE_PER_ROUND;

// Utiliser une transition douce:
if (distanceKm < 0.5) return MAX_SCORE_PER_ROUND;
if (distanceKm < 2) {
  // Transition linéaire entre 0.5km et 2km
  const progress = (distanceKm - 0.5) / 1.5;
  return Math.round(MAX_SCORE_PER_ROUND * (1 - progress * 0.05)); // 5% de réduction max
}
```

**Impact:** Réduit la frustration et améliore la perception de justice

---

### 3. 🟡 IMPORTANT - Afficher les catégories au joueur

**Action:** Utiliser `getScoreCategory()` dans l'UI pour afficher la catégorie

**Bénéfices:**
- Feedback clair et motivant
- Aide à comprendre la performance
- Encourage l'amélioration (objectif: passer à la catégorie supérieure)

**Exemple d'implémentation:**
```javascript
const category = scoringSystem.getScoreCategory(distance);
const categoryLabels = {
  perfect: 'Perfect! 🏆',
  excellent: 'Excellent! ⭐',
  good: 'Good! 👍',
  fair: 'Fair 👌',
  poor: 'Keep trying! 💪'
};
```

---

### 4. 🟢 SUGGESTION - Système de bonus temps

**Action:** Implémenter un bonus temps pour récompenser les réponses rapides

**Proposition:**
- Bonus maximum: 1000 points (20% du score max)
- Décroissance linéaire avec le temps
- Seuil: bonus seulement si distance < 200km (pour éviter l'exploitation)

**Formule proposée:**
```javascript
const timeBonus = (timeRemaining / totalTime) * 1000 * (distance < 200 ? 1 : 0);
```

**Impact:** 
- Ajoute de la tension et de l'engagement
- Récompense la connaissance ET la rapidité
- Augmente le skill ceiling

---

### 5. 🟢 SUGGESTION - Achievements/Milestones

**Action:** Ajouter des achievements basés sur les catégories

**Exemples:**
- "Perfect Round" - Obtenir Perfect sur un round
- "Excellent Player" - Obtenir Excellent sur 3 rounds consécutifs
- "Speed Demon" - Obtenir Excellent en moins de 2 secondes
- "Consistency" - Obtenir Good ou mieux sur tous les rounds

**Impact:** Encourage la répétition et l'amélioration

---

## 🔍 Vérifications techniques recommandées

### Continuité mathématique

Vérifier que la courbe est continue (C0) et idéalement lisse (C1) aux points de transition:
- ✅ 1km: Vérifier la continuité
- ✅ 100km: Vérifier la continuité et la dérivée
- ✅ 500km: Vérifier la continuité et la dérivée

### Tests de régression

Créer des tests pour s'assurer que les modifications n'affectent pas négativement:
- Les scores existants dans le leaderboard
- L'équilibrage entre les niveaux de compétence
- La progression du joueur

---

## 📊 Métriques à surveiller

Après implémentation des recommandations, surveiller:

1. **Distribution des scores:**
   - Score moyen par partie
   - Distribution des catégories obtenues
   - Écart entre les meilleurs et les moins bons joueurs

2. **Engagement:**
   - Taux de complétion des parties
   - Nombre de parties par joueur
   - Temps moyen par round

3. **Satisfaction:**
   - Feedback des joueurs sur la justice du système
   - Sentiment de progression
   - Motivation à rejouer

---

## ✅ Checklist d'implémentation

- [ ] Corriger l'incohérence UI/ScoringSystem (seuils)
- [ ] Lisser la transition à 1km
- [ ] Afficher les catégories dans l'UI
- [ ] Ajouter des tests pour la continuité mathématique
- [ ] Documenter les changements dans le code
- [ ] Tester avec différents niveaux de compétence
- [ ] Surveiller les métriques post-déploiement

---

## 📝 Notes finales

Le système de scoring actuel est **globalement bien conçu** avec une bonne différenciation entre les niveaux de compétence. Les principales améliorations concernent:

1. **Cohérence** - Aligner l'UI avec le système de scoring
2. **Justice** - Réduire les discontinuités frustrantes
3. **Feedback** - Améliorer la communication avec le joueur
4. **Engagement** - Ajouter des mécaniques qui encouragent la répétition

Les recommandations sont classées par priorité et peuvent être implémentées progressivement.

---

**Prochaines étapes suggérées:**
1. Implémenter les corrections critiques (incohérence UI, transition 1km)
2. Tester avec des joueurs réels
3. Itérer sur les ajustements d'équilibrage
4. Considérer les fonctionnalités avancées (bonus temps, achievements)
