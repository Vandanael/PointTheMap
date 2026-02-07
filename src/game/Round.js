import { GAME } from '../config/index.js';
import { MODE_IDS } from '../config/game-modes.js';
import { normalizeCoords } from '@lib/game-math/index.js';
import { logger } from '../utils/logger.js';

const COORD_WARN_INTERVAL_MS = 5000;
let lastCoordWarnAt = 0;

/** @param {number} [totalTimeAllowed] - From state.runtimeConfig (timerMs + graceMs); fallback GAME for tests */
function getTotalTimeAllowed(totalTimeAllowed) {
  return totalTimeAllowed ?? GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
}

/**
 * Create a new round
 * @param {import('./Game.js').Capital|import('./Game.js').Country|import('./Game.js').Stadium|import('./Game.js').Civilization} target - Target to find
 * @param {number} roundNumber - Round number (0-indexed)
 * @param {string} [gameType='capital'] - 'capital', 'country', 'stadium', or 'civilization'
 * @returns {import('./Game.js').Round}
 */
export const createRound = (target, roundNumber, gameType = 'capital') => ({
  capital: gameType === 'capital' ? /** @type {import('./Game.js').Capital} */ (target) : null,
  country:
    gameType === MODE_IDS.COUNTRY ? /** @type {import('./Game.js').Country} */ (target) : null,
  stadium:
    gameType === MODE_IDS.STADIUM ? /** @type {import('./Game.js').Stadium} */ (target) : null,
  civilization:
    gameType === MODE_IDS.CIVILIZATION
      ? /** @type {import('./Game.js').Civilization} */ (target)
      : null,
  roundNumber,
  startTime: Date.now(),
  endTime: null,
  click: null,
  distance: null,
  score: null,
  status: 'playing',
  gameType,
});

/**
 * Record user click and calculate score
 * @param {import('./Game.js').Round} round - Current round
 * @param {[number, number]} clickCoords - [lat, lng] of user click
 * @param {string} [gameMode='classic'] - Game mode ('classic', 'daily', or 'country')
 * @param {number} [totalTimeAllowed] - From state.runtimeConfig (timerMs + graceMs); fallback GAME for tests
 * @param {Object} [countryData] - Country-specific data for country mode
 * @param {Object} [civilizationData] - Civilization-specific data for civilization mode
 * @param {import('./ports.js').RoundRulesPort} [roundRules] - Round rules interface for validation and scoring
 * @returns {import('./Game.js').Round}
 */
export const recordClick = (
  round,
  clickCoords,
  gameMode = MODE_IDS.CLASSIC,
  totalTimeAllowed = undefined,
  countryData = null,
  civilizationData = null,
  roundRules
) => {
  if (!roundRules) {
    throw new Error('Round rules are required');
  }
  const endTime = Date.now();
  const elapsed = endTime - round.startTime;
  const total = getTotalTimeAllowed(totalTimeAllowed);

  // Validate coordinates before processing
  const coordValidation = roundRules.validateCoordinates(clickCoords[0], clickCoords[1]);
  if (!coordValidation.valid) {
    // Log error and use normalized values as fallback
    const now = Date.now();
    if (now - lastCoordWarnAt >= COORD_WARN_INTERVAL_MS) {
      logger.warn('Invalid coordinates:', coordValidation.error);
      lastCoordWarnAt = now;
    }
  }

  // Normalize coordinates to valid ranges
  const normalizedCoords = /** @type {[number, number]} */ (normalizeCoords(clickCoords));
  const [normalizedLat, normalizedLng] = normalizedCoords;

  // Check timeout first (before calculating score)
  if (elapsed > total) {
    return {
      ...round,
      endTime,
      click: { lat: normalizedLat, lng: normalizedLng },
      distance: null,
      score: 0,
      status: 'timeout',
    };
  }

  // Handle country mode
  if (round.gameType === MODE_IDS.COUNTRY && countryData && round.country) {
    const scoreResult = roundRules.calculateCountryClickScore(
      normalizedCoords,
      countryData.targetCountryFeature,
      countryData.isInsideTargetCountry,
      elapsed,
      gameMode,
      total
    );

    return {
      ...round,
      endTime,
      click: { lat: normalizedLat, lng: normalizedLng },
      distance: Number.isFinite(scoreResult.distance) ? scoreResult.distance : null,
      distanceToTargetKm: Number.isFinite(scoreResult.distanceToCountry)
        ? scoreResult.distanceToCountry
        : null,
      score: Math.round(scoreResult.totalScore),
      baseScore: Math.round(scoreResult.score),
      timeBonus: Math.round(scoreResult.timeBonus),
      correctCountryId: round.country.countryId,
      clickedCountryId: countryData.clickedCountryId,
      status: 'completed',
    };
  }

  // Civilization mode: same flow and scoring as country (distance to polygon;
  // click aside = some points, too far = fewer points, inside = max)
  if (round.gameType === MODE_IDS.CIVILIZATION && civilizationData && round.civilization) {
    const feature = civilizationData.targetCivilizationFeature;
    const scoreResult = feature
      ? roundRules.calculateCountryClickScore(
          normalizedCoords,
          feature,
          civilizationData.isInsideTargetCivilization,
          elapsed,
          gameMode,
          total
        )
      : {
          distance: null,
          distanceToCountry: Infinity,
          score: 0,
          timeBonus: 0,
          totalScore: 0,
        };

    return {
      ...round,
      endTime,
      click: { lat: normalizedLat, lng: normalizedLng },
      distance: Number.isFinite(scoreResult.distance) ? scoreResult.distance : null,
      distanceToTargetKm: Number.isFinite(scoreResult.distanceToCountry)
        ? scoreResult.distanceToCountry
        : null,
      score: Math.round(scoreResult.totalScore),
      baseScore: Math.round(scoreResult.score),
      timeBonus: Math.round(scoreResult.timeBonus),
      correctCivilizationId: round.civilization.id,
      clickedCivilizationId: civilizationData.clickedCivilizationId,
      status: 'completed',
    };
  }

  // Handle stadium mode (point-to-point, same as capital)
  if (round.gameType === MODE_IDS.STADIUM && round.stadium) {
    const stadiumCoords = /** @type {[number, number]} */ ([round.stadium.lat, round.stadium.lng]);
    const scoreResult = roundRules.calculateClickScore(
      normalizedCoords,
      stadiumCoords,
      elapsed,
      gameMode,
      total
    );

    return {
      ...round,
      endTime,
      click: { lat: normalizedLat, lng: normalizedLng },
      distance:
        scoreResult.distance !== null && scoreResult.distance !== undefined
          ? Math.round(scoreResult.distance)
          : null,
      score: Math.round(scoreResult.totalScore),
      baseScore: Math.round(scoreResult.score),
      timeBonus: Math.round(scoreResult.timeBonus),
      status: 'completed',
    };
  }

  // Handle capital mode (default)
  const capitalCoords = /** @type {[number, number]} */ ([round.capital.lat, round.capital.lng]);
  const scoreResult = roundRules.calculateClickScore(
    normalizedCoords,
    capitalCoords,
    elapsed,
    gameMode,
    total
  );

  return {
    ...round,
    endTime,
    click: { lat: normalizedLat, lng: normalizedLng },
    distance:
      scoreResult.distance !== null && scoreResult.distance !== undefined
        ? Math.round(scoreResult.distance)
        : null,
    score: Math.round(scoreResult.totalScore), // Use totalScore (includes time bonus)
    baseScore: Math.round(scoreResult.score), // Base score before bonus
    timeBonus: Math.round(scoreResult.timeBonus), // Time bonus points
    status: 'completed',
  };
};

/**
 * Mark round as timed out
 * @param {import('./Game.js').Round} round - Current round
 * @returns {import('./Game.js').Round}
 */
export const timeoutRound = (round) => ({
  ...round,
  endTime: Date.now(),
  click: null,
  distance: null,
  score: 0,
  status: 'timeout',
});

/**
 * Get remaining time for current round
 * @param {import('./Game.js').Round} round - Current round
 * @param {number} [totalTimeAllowed] - From state.runtimeConfig (timerMs + graceMs); fallback GAME for tests
 * @returns {number} Remaining time in milliseconds
 */
export const getRemainingTime = (round, totalTimeAllowed = undefined) => {
  const elapsed = Date.now() - round.startTime;
  const total = getTotalTimeAllowed(totalTimeAllowed);
  return Math.max(0, total - elapsed);
};
