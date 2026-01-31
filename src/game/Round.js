import { GAME } from "../config.js";
import { normalizeCoords } from '@lib/game-math/index.js';
import { validationSystem } from "../systems/ValidationSystem.js";
import { scoringSystem } from "../systems/ScoringSystem.js";
import { logger } from "../utils/logger.js";

/** @param {number} [totalTimeAllowed] - From state.runtimeConfig (timerMs + graceMs); fallback GAME for tests */
function getTotalTimeAllowed(totalTimeAllowed) {
  return totalTimeAllowed ?? (GAME.TIMER_MS + GAME.GRACE_PERIOD_MS);
}

/**
 * Create a new round
 * @param {import('./Game.js').Capital|import('./Game.js').Country} target - Capital or Country to find
 * @param {number} roundNumber - Round number (0-indexed)
 * @param {string} [gameType='capital'] - 'capital' or 'country'
 * @returns {import('./Game.js').Round}
 */
export const createRound = (target, roundNumber, gameType = 'capital') => ({
  capital: gameType === 'capital' ? target : null,
  country: gameType === 'country' ? target : null,
  roundNumber,
  startTime: Date.now(),
  endTime: null,
  click: null,
  distance: null,
  score: null,
  status: "playing",
  gameType,
});

/**
 * Record user click and calculate score
 * @param {import('./Game.js').Round} round - Current round
 * @param {[number, number]} clickCoords - [lat, lng] of user click
 * @param {string} [gameMode='classic'] - Game mode ('classic', 'daily', or 'country')
 * @param {number} [totalTimeAllowed] - From state.runtimeConfig (timerMs + graceMs); fallback GAME for tests
 * @param {Object} [countryData] - Country-specific data for country mode
 * @param {Object} [countryData.targetCountryFeature] - GeoJSON feature of target country
 * @param {boolean} [countryData.isInsideTargetCountry] - Whether click is inside target country
 * @param {string|null} [countryData.clickedCountryId] - ID of clicked country (null if ocean)
 * @returns {import('./Game.js').Round}
 */
export const recordClick = (round, clickCoords, gameMode = 'classic', totalTimeAllowed = undefined, countryData = null) => {
  const endTime = Date.now();
  const elapsed = endTime - round.startTime;
  const total = getTotalTimeAllowed(totalTimeAllowed);

  // Validate coordinates before processing
  const coordValidation = validationSystem.validateCoordinates(clickCoords[0], clickCoords[1]);
  if (!coordValidation.valid) {
    // Log error and use normalized values as fallback
    logger.warn('Invalid coordinates:', coordValidation.error);
  }

  // Normalize coordinates to valid ranges
  const normalizedCoords = normalizeCoords(clickCoords);
  const [normalizedLat, normalizedLng] = normalizedCoords;

  // Check timeout first (before calculating score)
  if (elapsed > total) {
    return {
      ...round,
      endTime,
      click: { lat: normalizedLat, lng: normalizedLng },
      distance: null,
      score: 0,
      status: "timeout",
    };
  }

  // Handle country mode
  if (round.gameType === 'country' && countryData) {
    const scoreResult = scoringSystem.calculateCountryClickScore(
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
      distance: scoreResult.distance,
      distanceToTargetKm: scoreResult.distanceToCountry,
      score: Math.round(scoreResult.totalScore),
      baseScore: Math.round(scoreResult.score),
      timeBonus: Math.round(scoreResult.timeBonus),
      correctCountryId: round.country.countryId,
      clickedCountryId: countryData.clickedCountryId,
      status: "completed",
    };
  }

  // Handle capital mode (default)
  const capitalCoords = [round.capital.lat, round.capital.lng];
  const scoreResult = scoringSystem.calculateClickScore(
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
    distance: scoreResult.distance !== null && scoreResult.distance !== undefined
      ? Math.round(scoreResult.distance)
      : null,
    score: Math.round(scoreResult.totalScore), // Use totalScore (includes time bonus)
    baseScore: Math.round(scoreResult.score),   // Base score before bonus
    timeBonus: Math.round(scoreResult.timeBonus), // Time bonus points
    status: "completed",
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
  status: "timeout",
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
