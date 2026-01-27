import { GAME } from "../config.js";
import { normalizeCoords } from '@lib/game-math/index.js';
import { validationSystem } from "../systems/ValidationSystem.js";
import { scoringSystem } from "../systems/ScoringSystem.js";
import { logger } from "../utils/logger.js";

/**
 * Create a new round
 * @param {import('./Game.js').Capital} capital - Capital to find
 * @param {number} roundNumber - Round number (0-indexed)
 * @returns {import('./Game.js').Round}
 */
export const createRound = (capital, roundNumber) => ({
  capital,
  roundNumber,
  startTime: Date.now(),
  endTime: null,
  click: null,
  distance: null,
  score: null,
  status: "playing",
});

/**
 * Record user click and calculate score
 * @param {import('./Game.js').Round} round - Current round
 * @param {[number, number]} clickCoords - [lat, lng] of user click
 * @returns {import('./Game.js').Round}
 */
export const recordClick = (round, clickCoords) => {
  const endTime = Date.now();
  const elapsed = endTime - round.startTime;
  const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;

  // Validate coordinates before processing
  const coordValidation = validationSystem.validateCoordinates(clickCoords[0], clickCoords[1]);
  if (!coordValidation.valid) {
    // Log error and use normalized values as fallback
    logger.warn('Invalid coordinates:', coordValidation.error);
  }

  // Normalize coordinates to valid ranges
  const normalizedCoords = normalizeCoords(clickCoords);
  const [normalizedLat, normalizedLng] = normalizedCoords;

  const capitalCoords = [round.capital.lat, round.capital.lng];
  
  // Check timeout first (before calculating score)
  if (elapsed > totalTimeAllowed) {
    return {
      ...round,
      endTime,
      click: { lat: normalizedLat, lng: normalizedLng },
      distance: null,
      score: 0,
      status: "timeout",
    };
  }

  // Use ScoringSystem for consistent architecture
  const scoreResult = scoringSystem.calculateClickScore(
    normalizedCoords,
    capitalCoords,
    elapsed
  );

  return {
    ...round,
    endTime,
    click: { lat: normalizedLat, lng: normalizedLng },
    distance: scoreResult.distance !== null && scoreResult.distance !== undefined 
      ? Math.round(scoreResult.distance) 
      : null,
    score: Math.round(scoreResult.score),
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
 * @returns {number} Remaining time in milliseconds
 */
export const getRemainingTime = (round) => {
  const elapsed = Date.now() - round.startTime;
  const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
  return Math.max(0, totalTimeAllowed - elapsed);
};
