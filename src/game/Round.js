import { GAME } from "../config.js";
import { haversine } from "../utils.js";
import { calculateScore as calculateScoreLib, normalizeLat as normalizeLatLib, normalizeLng as normalizeLngLib } from '@lib/game-math/index.js';

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

// Use normalize functions from shared library
const normalizeLng = normalizeLngLib;
const normalizeLat = normalizeLatLib;

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

  // Normalize coordinates to valid ranges
  const normalizedLat = normalizeLat(clickCoords[0]);
  const normalizedLng = normalizeLng(clickCoords[1]);
  const normalizedCoords = [normalizedLat, normalizedLng];

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

  const capitalCoords = [round.capital.lat, round.capital.lng];
  const distance = haversine(normalizedCoords, capitalCoords);
  const score = calculateScore(distance);

  return {
    ...round,
    endTime,
    click: { lat: normalizedLat, lng: normalizedLng },
    distance: Math.round(distance),
    score: Math.round(score),
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
 * Calculate score based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Score (0-5000)
 */
// Use calculateScore from shared library
export const calculateScore = calculateScoreLib;

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
