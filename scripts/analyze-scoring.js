/**
 * Analyse du système de scoring - Point de vue Game Designer
 * 
 * Ce script analyse :
 * - La courbe de score en fonction de la distance
 * - Les seuils de catégories (perfect, excellent, good, fair, poor)
 * - La progression et l'équilibrage
 * - Les points d'inflexion et zones problématiques
 */

// Configuration (copiée de src/config.js)
const GAME = {
  ROUNDS: 5,
  TIMER_MS: 5000,
  GRACE_PERIOD_MS: 500,
  DANGER_ZONE_MS: 1500,
  MAX_SCORE_PER_ROUND: 5000,
};

// Fonction de calcul de score (copiée de lib/game-math/index.js)
const calculateScore = (distanceKm) => {
  const MAX_SCORE_PER_ROUND = 5000;

  if (distanceKm < 1) {
    return MAX_SCORE_PER_ROUND;
  }

  if (distanceKm < 100) {
    return Math.round(5000 * Math.exp(-distanceKm / 280));
  }

  if (distanceKm < 500) {
    const scoreAt100 = 5000 * Math.exp(-100 / 280);
    const scoreAt500 = 1000;
    const progress = (distanceKm - 100) / 400;
    return Math.round(scoreAt100 + (scoreAt500 - scoreAt100) * progress);
  }

  const excess = distanceKm - 500;
  return Math.max(0, Math.round(1000 * Math.exp(-excess / 800)));
};

// Catégories de score actuelles
const SCORE_CATEGORIES = {
  perfect: { min: 0, max: 1, label: 'Perfect (< 1km)' },
  excellent: { min: 1, max: 50, label: 'Excellent (1-50km)' },
  good: { min: 50, max: 200, label: 'Good (50-200km)' },
  fair: { min: 200, max: 1000, label: 'Fair (200-1000km)' },
  poor: { min: 1000, max: Infinity, label: 'Poor (> 1000km)' },
};

// Distances de référence pour analyse
const REFERENCE_DISTANCES = [
  { name: 'Très proche', km: 0.5 },
  { name: 'Proche', km: 5 },
  { name: 'Région', km: 50 },
  { name: 'Pays voisin', km: 200 },
  { name: 'Continent', km: 1000 },
  { name: 'Loin', km: 5000 },
  { name: 'Très loin', km: 10000 },
  { name: 'Extrême', km: 20000 },
];

console.log('='.repeat(80));
console.log('ANALYSE DU SYSTÈME DE SCORING - GAME DESIGN REVIEW');
console.log('='.repeat(80));
console.log();

// 1. Configuration du jeu
console.log('📊 CONFIGURATION DU JEU');
console.log('-'.repeat(80));
console.log(`Rounds par partie: ${GAME.ROUNDS}`);
console.log(`Score max par round: ${GAME.MAX_SCORE_PER_ROUND}`);
console.log(`Score total maximum: ${GAME.ROUNDS * GAME.MAX_SCORE_PER_ROUND}`);
console.log(`Timer: ${GAME.TIMER_MS}ms + ${GAME.GRACE_PERIOD_MS}ms grâce`);
console.log();

// 2. Analyse de la courbe de score
console.log('📈 COURBE DE SCORE - Points de référence');
console.log('-'.repeat(80));
console.log('Distance (km)'.padEnd(20) + 'Score'.padEnd(15) + 'Pourcentage'.padEnd(15) + 'Catégorie');
console.log('-'.repeat(80));

REFERENCE_DISTANCES.forEach(({ name, km }) => {
  const score = calculateScore(km);
  const percentage = ((score / GAME.MAX_SCORE_PER_ROUND) * 100).toFixed(1);
  
  let category = 'N/A';
  if (km < 1) category = 'Perfect';
  else if (km < 50) category = 'Excellent';
  else if (km < 200) category = 'Good';
  else if (km < 1000) category = 'Fair';
  else category = 'Poor';
  
  console.log(
    `${name.padEnd(18)} ${km.toString().padEnd(10)} ${score.toString().padEnd(15)} ${percentage.padEnd(15)}% ${category}`
  );
});
console.log();

// 3. Analyse des seuils de catégories
console.log('🎯 SEUILS DE CATÉGORIES');
console.log('-'.repeat(80));

Object.entries(SCORE_CATEGORIES).forEach(([key, cat]) => {
  const minScore = calculateScore(cat.min === 0 ? 0.1 : cat.min);
  const maxScore = cat.max === Infinity ? 0 : calculateScore(cat.max);
  const minPct = ((minScore / GAME.MAX_SCORE_PER_ROUND) * 100).toFixed(1);
  const maxPct = cat.max === Infinity ? '0' : ((maxScore / GAME.MAX_SCORE_PER_ROUND) * 100).toFixed(1);
  
  console.log(`${cat.label}:`);
  console.log(`  Distance: ${cat.min}km - ${cat.max === Infinity ? '∞' : cat.max + 'km'}`);
  console.log(`  Score: ${maxScore} - ${minScore} points (${maxPct}% - ${minPct}%)`);
  console.log();
});

// 4. Analyse des zones de transition
console.log('🔄 ZONES DE TRANSITION (Points d\'inflexion)');
console.log('-'.repeat(80));

const transitions = [
  { name: 'Perfect → Excellent', at: 1 },
  { name: 'Excellent → Good', at: 50 },
  { name: 'Good → Fair', at: 200 },
  { name: 'Fair → Poor', at: 1000 },
];

transitions.forEach(({ name, at }) => {
  const before = calculateScore(at - 0.1);
  const atPoint = calculateScore(at);
  const after = calculateScore(at + 0.1);
  const drop = before - after;
  const dropPct = ((drop / before) * 100).toFixed(2);
  
  console.log(`${name} (${at}km):`);
  console.log(`  Avant: ${before} points`);
  console.log(`  Au seuil: ${atPoint} points`);
  console.log(`  Après: ${after} points`);
  console.log(`  Chute: ${drop} points (${dropPct}%)`);
  console.log();
});

// 5. Analyse de la progression (dérivée)
console.log('📉 TAUX DE DÉCROISSANCE (Sensibilité du score)');
console.log('-'.repeat(80));

const sensitivityPoints = [
  { km: 1, label: 'Début Excellent' },
  { km: 10, label: 'Milieu Excellent' },
  { km: 50, label: 'Fin Excellent' },
  { km: 100, label: 'Début Good' },
  { km: 200, label: 'Fin Good' },
  { km: 500, label: 'Milieu Fair' },
  { km: 1000, label: 'Début Poor' },
];

sensitivityPoints.forEach(({ km, label }) => {
  const score1 = calculateScore(km);
  const score2 = calculateScore(km + 10); // +10km
  const drop = score1 - score2;
  const dropPct = score1 > 0 ? ((drop / score1) * 100).toFixed(2) : '0';
  
  console.log(`${label} (${km}km):`);
  console.log(`  Score: ${score1} points`);
  console.log(`  Perte pour +10km: ${drop} points (${dropPct}%)`);
  console.log();
});

// 6. Analyse de l'équilibrage
console.log('⚖️  ANALYSE D\'ÉQUILIBRAGE');
console.log('-'.repeat(80));

// Score moyen théorique pour différentes habiletés
const skillLevels = [
  { name: 'Expert', avgDistance: 50, description: 'Connaît bien la géographie' },
  { name: 'Intermédiaire', avgDistance: 300, description: 'Connaissances moyennes' },
  { name: 'Débutant', avgDistance: 2000, description: 'Peu de connaissances' },
];

console.log('Score moyen théorique par niveau de compétence:');
skillLevels.forEach(({ name, avgDistance, description }) => {
  const score = calculateScore(avgDistance);
  const totalScore = score * GAME.ROUNDS;
  const percentage = ((score / GAME.MAX_SCORE_PER_ROUND) * 100).toFixed(1);
  
  console.log(`${name} (${description}):`);
  console.log(`  Distance moyenne: ~${avgDistance}km`);
  console.log(`  Score/round: ~${score} points (${percentage}%)`);
  console.log(`  Score total (${GAME.ROUNDS} rounds): ~${totalScore} points`);
  console.log();
});

// 7. Problèmes potentiels identifiés
console.log('⚠️  PROBLÈMES POTENTIELS IDENTIFIÉS');
console.log('-'.repeat(80));

const issues = [];

// Vérifier la continuité à 1km
const scoreAt1km = calculateScore(1);
const scoreAt099km = calculateScore(0.99);
if (scoreAt099km === 5000 && scoreAt1km < 5000) {
  issues.push({
    severity: 'HIGH',
    issue: 'Discontinuité majeure à 1km',
    description: `Le score passe de 5000 (0.99km) à ${scoreAt1km} (1km) - chute de ${5000 - scoreAt1km} points pour seulement 0.01km`,
    impact: 'Frustration si le joueur est juste au-dessus de 1km',
  });
}

// Vérifier la transition 100km
const scoreAt100 = calculateScore(100);
const scoreAt99 = calculateScore(99);
const scoreAt101 = calculateScore(101);
const drop100 = scoreAt99 - scoreAt100;
const drop101 = scoreAt100 - scoreAt101;
if (Math.abs(drop100 - drop101) > 100) {
  issues.push({
    severity: 'MEDIUM',
    issue: 'Transition abrupte à 100km',
    description: `Changement de formule à 100km peut créer une discontinuité`,
    impact: 'Courbe peut sembler injuste autour de ce seuil',
  });
}

// Vérifier la transition 500km
const scoreAt500 = calculateScore(500);
const scoreAt499 = calculateScore(499);
const scoreAt501 = calculateScore(501);
const drop500 = scoreAt499 - scoreAt500;
const drop501 = scoreAt500 - scoreAt501;
if (Math.abs(drop500 - drop501) > 50) {
  issues.push({
    severity: 'MEDIUM',
    issue: 'Transition abrupte à 500km',
    description: `Changement de formule à 500km peut créer une discontinuité`,
    impact: 'Courbe peut sembler injuste autour de ce seuil',
  });
}

// Vérifier si la zone "excellent" est trop restrictive
const excellentMax = calculateScore(50);
const excellentMin = calculateScore(1);
const excellentRange = excellentMin - excellentMax;
if (excellentRange < 1000) {
  issues.push({
    severity: 'LOW',
    issue: 'Zone "Excellent" peut être trop restrictive',
    description: `La zone excellent (1-50km) donne entre ${excellentMax} et ${excellentMin} points - écart de ${excellentRange}`,
    impact: 'Peu de différenciation entre les bonnes performances',
  });
}

// Vérifier si la zone "poor" est trop punitive
const poorMin = calculateScore(1000);
if (poorMin > 500) {
  issues.push({
    severity: 'LOW',
    issue: 'Zone "Poor" peut être trop généreuse',
    description: `À 1000km, le score est encore ${poorMin} points`,
    impact: 'Les très mauvaises performances sont encore récompensées',
  });
}

if (issues.length === 0) {
  console.log('✅ Aucun problème majeur identifié');
} else {
  issues.forEach(({ severity, issue, description, impact }) => {
    console.log(`[${severity}] ${issue}`);
    console.log(`  ${description}`);
    console.log(`  Impact: ${impact}`);
    console.log();
  });
}

// 8. Recommandations
console.log('💡 RECOMMANDATIONS');
console.log('-'.repeat(80));

const recommendations = [
  {
    category: 'Équilibrage',
    suggestion: 'Considérer un système de bonus temps pour récompenser les réponses rapides',
    rationale: 'Actuellement, le temps n\'affecte pas le score, ce qui peut réduire la tension',
  },
  {
    category: 'Feedback',
    suggestion: 'Afficher clairement la catégorie (Perfect/Excellent/Good/Fair/Poor) au joueur',
    rationale: 'Aide le joueur à comprendre sa performance et à se motiver',
  },
  {
    category: 'Progression',
    suggestion: 'Envisager des achievements/milestones basés sur les catégories',
    rationale: 'Encourage la répétition et l\'amélioration',
  },
  {
    category: 'Courbe',
    suggestion: 'Vérifier la continuité mathématique aux transitions (1km, 100km, 500km)',
    rationale: 'Assure une expérience fluide sans "sauts" de score',
  },
];

recommendations.forEach(({ category, suggestion, rationale }) => {
  console.log(`[${category}] ${suggestion}`);
  console.log(`  Raison: ${rationale}`);
  console.log();
});

console.log('='.repeat(80));
console.log('FIN DE L\'ANALYSE');
console.log('='.repeat(80));
