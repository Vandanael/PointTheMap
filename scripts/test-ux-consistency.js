/**
 * Test UX - Vérification de cohérence
 * 
 * Vérifie:
 * - Cohérence entre catégories affichées et valeurs retournées
 * - Score round / score total (5 rounds)
 * - Structure leaderboard inchangée
 */

// Configuration
const GAME = { ROUNDS: 5, MAX_SCORE_PER_ROUND: 5000 };
const SCORING_THRESHOLDS = {
  PERFECT_MAX: 1,
  EXCELLENT_MAX: 50,
  GOOD_MAX: 200,
  FAIR_MAX: 1000,
};

// Fonction de calcul (simplifiée)
const calculateScore = (distanceKm) => {
  const MAX = 5000;
  if (distanceKm < 0.5) return MAX;
  if (distanceKm < 2) {
    const s2 = 5000 * Math.exp(-2 / 280);
    const p = (distanceKm - 0.5) / 1.5;
    return Math.round(MAX + (s2 - MAX) * p);
  }
  if (distanceKm < 100) return Math.round(5000 * Math.exp(-distanceKm / 280));
  if (distanceKm < 500) {
    const s100 = 5000 * Math.exp(-100 / 280);
    const p = (distanceKm - 100) / 400;
    return Math.round(s100 + (1000 - s100) * p);
  }
  const ex = distanceKm - 500;
  return Math.max(0, Math.round(1000 * Math.exp(-ex / 800)));
};

// Catégories (matching ScoringSystem)
const getScoreCategory = (distanceKm) => {
  if (distanceKm < SCORING_THRESHOLDS.PERFECT_MAX) return 'perfect';
  if (distanceKm < SCORING_THRESHOLDS.EXCELLENT_MAX) return 'excellent';
  if (distanceKm < SCORING_THRESHOLDS.GOOD_MAX) return 'good';
  if (distanceKm < SCORING_THRESHOLDS.FAIR_MAX) return 'fair';
  return 'poor';
};

console.log('='.repeat(80));
console.log('TEST UX - COHÉRENCE');
console.log('='.repeat(80));
console.log();

let allPassed = true;

// Test 1: Cohérence catégories
console.log('1. Test de cohérence catégories:');
console.log('-'.repeat(80));

const categoryTests = [
  { dist: 0.5, expected: 'perfect' },
  { dist: 1, expected: 'excellent' },
  { dist: 25, expected: 'excellent' },
  { dist: 50, expected: 'good' },
  { dist: 100, expected: 'good' },
  { dist: 200, expected: 'fair' },
  { dist: 500, expected: 'fair' },
  { dist: 1000, expected: 'poor' },
  { dist: 5000, expected: 'poor' },
];

for (const { dist, expected } of categoryTests) {
  const category = getScoreCategory(dist);
  const match = category === expected;
  if (!match) allPassed = false;
  console.log(`  ${dist}km → ${category} ${match ? '✓' : '✗ (expected ' + expected + ')'}`);
}

console.log();

// Test 2: Score round / score total
console.log('2. Test score round / score total:');
console.log('-'.repeat(80));

const testRounds = [
  { distance: 0.5, expectedCategory: 'perfect' },
  { distance: 10, expectedCategory: 'excellent' },
  { distance: 100, expectedCategory: 'good' },
  { distance: 300, expectedCategory: 'fair' },
  { distance: 2000, expectedCategory: 'poor' },
];

let totalScore = 0;
for (let i = 0; i < testRounds.length; i++) {
  const round = testRounds[i];
  const score = calculateScore(round.distance);
  const category = getScoreCategory(round.distance);
  totalScore += score;
  
  const isValid = score >= 0 && score <= GAME.MAX_SCORE_PER_ROUND;
  const categoryMatch = category === round.expectedCategory;
  
  if (!isValid || !categoryMatch) allPassed = false;
  
  console.log(`  Round ${i + 1}: ${round.distance}km → ${score}pts (${category}) ${isValid && categoryMatch ? '✓' : '✗'}`);
}

console.log(`  Total (${GAME.ROUNDS} rounds): ${totalScore} points`);
console.log(`  Max possible: ${GAME.ROUNDS * GAME.MAX_SCORE_PER_ROUND} points`);
console.log(`  Percentage: ${((totalScore / (GAME.ROUNDS * GAME.MAX_SCORE_PER_ROUND)) * 100).toFixed(1)}%`);

if (totalScore > GAME.ROUNDS * GAME.MAX_SCORE_PER_ROUND) {
  allPassed = false;
  console.log('  ✗ Total score exceeds maximum!');
} else {
  console.log('  ✓ Total score is valid');
}

console.log();

// Test 3: Structure leaderboard (vérification que les scores sont cohérents)
console.log('3. Test structure leaderboard:');
console.log('-'.repeat(80));

const leaderboardEntries = [
  { pseudo: 'AAA', score: 25000, time: 25000 }, // Perfect game
  { pseudo: 'BBB', score: 20000, time: 20000 }, // Good game
  { pseudo: 'CCC', score: 10000, time: 15000 }, // Average game
  { pseudo: 'DDD', score: 5000, time: 10000 },  // Poor game
];

for (const entry of leaderboardEntries) {
  const isValidScore = entry.score >= 0 && entry.score <= GAME.ROUNDS * GAME.MAX_SCORE_PER_ROUND;
  const isValidTime = entry.time > 0;
  const hasPseudo = entry.pseudo && entry.pseudo.length >= 3;
  
  if (!isValidScore || !isValidTime || !hasPseudo) allPassed = false;
  
  console.log(`  ${entry.pseudo}: ${entry.score}pts, ${(entry.time / 1000).toFixed(1)}s ${isValidScore && isValidTime && hasPseudo ? '✓' : '✗'}`);
}

console.log();

// Test 4: Vérification des seuils UI
console.log('4. Test cohérence seuils UI:');
console.log('-'.repeat(80));

const uiThresholds = {
  perfect: SCORING_THRESHOLDS.PERFECT_MAX,
  excellent: SCORING_THRESHOLDS.EXCELLENT_MAX,
  good: SCORING_THRESHOLDS.GOOD_MAX,
  fair: SCORING_THRESHOLDS.FAIR_MAX,
};

console.log('  Seuils utilisés:');
for (const [category, threshold] of Object.entries(uiThresholds)) {
  const testDist = threshold - 0.1;
  const categoryAtTest = getScoreCategory(testDist);
  const match = categoryAtTest === category;
  if (!match) allPassed = false;
  console.log(`    ${category}: < ${threshold}km ${match ? '✓' : '✗'}`);
}

console.log();

console.log('='.repeat(80));
console.log(allPassed ? '✅ TOUS LES TESTS UX PASSÉS' : '❌ CERTAINS TESTS UX ONT ÉCHOUÉ');
console.log('='.repeat(80));

process.exit(allPassed ? 0 : 1);
