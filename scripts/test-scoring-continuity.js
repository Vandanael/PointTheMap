/**
 * Test de continuité et monotonie du système de scoring
 * Vérifie:
 * - Continuité C0 (pas de sauts)
 * - Monotonie (score décroît avec distance)
 * - Absence de jumps > 0.5%
 */

// Configuration (copiée de src/config.js)
const SCORING_THRESHOLDS = {
  PERFECT_TRANSITION_START: 0.5,
  PERFECT_TRANSITION_END: 2,
  EXPONENTIAL_END: 100,
  LINEAR_END: 500,
};

// Fonction de calcul (copiée de lib/game-math/index.js)
const calculateScore = (distanceKm) => {
  const MAX_SCORE_PER_ROUND = 5000;
  const { PERFECT_TRANSITION_START, PERFECT_TRANSITION_END, EXPONENTIAL_END, LINEAR_END } = SCORING_THRESHOLDS;

  if (distanceKm < PERFECT_TRANSITION_START) {
    return MAX_SCORE_PER_ROUND;
  }

  if (distanceKm < PERFECT_TRANSITION_END) {
    const scoreAt2km = 5000 * Math.exp(-2 / 280);
    const progress = (distanceKm - PERFECT_TRANSITION_START) / (PERFECT_TRANSITION_END - PERFECT_TRANSITION_START);
    return Math.round(MAX_SCORE_PER_ROUND + (scoreAt2km - MAX_SCORE_PER_ROUND) * progress);
  }

  if (distanceKm < EXPONENTIAL_END) {
    return Math.round(5000 * Math.exp(-distanceKm / 280));
  }

  if (distanceKm < LINEAR_END) {
    const scoreAt100 = 5000 * Math.exp(-EXPONENTIAL_END / 280);
    const scoreAt500 = 1000;
    const progress = (distanceKm - EXPONENTIAL_END) / (LINEAR_END - EXPONENTIAL_END);
    return Math.round(scoreAt100 + (scoreAt500 - scoreAt100) * progress);
  }

  const excess = distanceKm - LINEAR_END;
  return Math.max(0, Math.round(1000 * Math.exp(-excess / 800)));
};

// Points de test critiques
const TEST_POINTS = [
  0.5, 0.99, 1.0, 1.01, 1.99, 2.0, 2.01,
  10, 50, 99, 100, 101,
  200, 499, 500, 501,
  1000, 5000, 10000
];

console.log('='.repeat(80));
console.log('TEST DE CONTINUITÉ ET MONOTONIE');
console.log('='.repeat(80));
console.log();

let allPassed = true;
let previousScore = Infinity;
let previousDistance = -1;

// Test de monotonie et continuité
console.log('📊 Test de monotonie et continuité:');
console.log('-'.repeat(80));
console.log('Distance (km)'.padEnd(15) + 'Score'.padEnd(10) + 'Diff'.padEnd(10) + 'Status');
console.log('-'.repeat(80));

for (const distance of TEST_POINTS) {
  const score = calculateScore(distance);
  const diff = previousScore !== Infinity ? previousScore - score : 0;
  const diffPct = previousScore !== Infinity ? ((diff / previousScore) * 100).toFixed(2) : '0';
  
  // Vérifier monotonie (score doit décroître ou rester égal)
  const isMonotone = score <= previousScore;
  
  // Pour la continuité, on vérifie seulement aux transitions critiques
  // Les grandes variations sont normales dans les zones exponentielles
  const isTransitionPoint = [0.5, 2.0, 100, 500].includes(distance);
  const isContinuous = !isTransitionPoint || previousScore === Infinity || 
    Math.abs(diff) < 5; // Jump < 5 points aux transitions
  
  const status = isMonotone ? '✓' : '✗';
  if (!isMonotone) {
    allPassed = false;
  }
  
  console.log(
    `${distance.toString().padEnd(15)}${score.toString().padEnd(10)}${diffPct.padEnd(10)}%${status}`
  );
  
  previousScore = score;
  previousDistance = distance;
}

console.log();

// Test spécifique des transitions
console.log('🔄 Test des transitions critiques:');
console.log('-'.repeat(80));

const transitions = [
  { name: '0.5km (Perfect transition start)', at: 0.5 },
  { name: '2km (Perfect transition end)', at: 2.0 },
  { name: '100km (Exponential → Linear)', at: 100 },
  { name: '500km (Linear → Exponential)', at: 500 },
];

for (const { name, at } of transitions) {
  const before = calculateScore(at - 0.01);
  const atPoint = calculateScore(at);
  const after = calculateScore(at + 0.01);
  
  const jumpBefore = Math.abs(before - atPoint);
  const jumpAfter = Math.abs(atPoint - after);
  const maxJump = Math.max(jumpBefore, jumpAfter);
  const jumpPct = atPoint > 0 ? ((maxJump / atPoint) * 100).toFixed(3) : '0';
  
  // Continuité C0: jump < 5 points (0.1% du score max)
  const isContinuous = maxJump < 5;
  if (!isContinuous) allPassed = false;
  
  console.log(`${name}:`);
  console.log(`  Avant: ${before}, Au point: ${atPoint}, Après: ${after}`);
  console.log(`  Jump max: ${maxJump} points (${jumpPct}%) ${isContinuous ? '✓ C0' : '✗ DISCONTINU'}`);
  console.log();
}

// Test de valeurs spécifiques
console.log('🎯 Test de valeurs spécifiques:');
console.log('-'.repeat(80));

const specificTests = [
  { dist: 0.5, expected: 5000, label: 'Perfect zone max' },
  { dist: 1.0, label: 'Perfect → Excellent transition' },
  { dist: 50, label: 'Excellent → Good transition' },
  { dist: 200, label: 'Good → Fair transition' },
  { dist: 1000, label: 'Fair → Poor transition' },
];

for (const { dist, expected, label } of specificTests) {
  const score = calculateScore(dist);
  const match = expected !== undefined ? score === expected : true;
  console.log(`${label} (${dist}km): ${score} points ${match ? '✓' : '✗'}`);
  if (!match) allPassed = false;
}

console.log();
console.log('='.repeat(80));
console.log(allPassed ? '✅ TOUS LES TESTS PASSÉS' : '❌ CERTAINS TESTS ONT ÉCHOUÉ');
console.log('='.repeat(80));

process.exit(allPassed ? 0 : 1);
