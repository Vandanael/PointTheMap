/**
 * Shared game mathematics functions
 * Used by both client (src/) and server (netlify/functions/)
 */

import { SCORING_V1, SCORING_FORMULA } from '../config/scoring.js';

// Simple logger for server-side (compatible with both client and server)
const globalAny = typeof globalThis !== 'undefined' ? /** @type {any} */ (globalThis) : {};
const isTest = Boolean(
  globalAny.__vitest__ ||
  globalAny.__VITEST__ ||
  globalAny.process?.env?.VITEST ||
  globalAny.process?.env?.NODE_ENV === 'test'
);
/** @type {{ error: (...args: any[]) => void, warn: (...args: any[]) => void, info: (...args: any[]) => void }} */
const logger = {
  error: (...args) => {
    if (!isTest) console.error(...args);
  },
  warn: (...args) => {
    if (!isTest) console.warn(...args);
  },
  info: (...args) => {
    if (!isTest) console.info(...args);
  },
};

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Calculate Haversine distance between two coordinates
 * @param {[number, number]} coords1 - [lat, lng] of first point
 * @param {[number, number]} coords2 - [lat, lng] of second point
 * @returns {number} Distance in kilometers
 */
export const haversine = ([lat1, lon1], [lat2, lon2]) => {
  let dLon = lon2 - lon1;
  if (dLon > 180) dLon -= 360;
  else if (dLon < -180) dLon += 360;
  const dLatRad = toRad(lat2 - lat1);
  const dLonRad = toRad(dLon);
  const a =
    Math.sin(dLatRad / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLonRad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

/**
 * Calculate score based on distance - VERSION 1 (Legacy)
 *
 * Formula with smooth transitions:
 * - < 0.5km: Perfect score (5000)
 * - 0.5-2km: Smooth transition from perfect to excellent
 * - 2-100km: Exponential decay
 * - 100-500km: Linear interpolation (ensures C0 continuity)
 * - > 500km: Exponential decay (ensures C0 continuity)
 *
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Score (0-5000)
 */
export const calculateScoreV1 = (distanceKm) => {
  const {
    MAX_SCORE_PER_ROUND,
    PERFECT_TRANSITION_START,
    PERFECT_TRANSITION_END,
    EXPONENTIAL_END,
    LINEAR_END,
    EXPONENTIAL_K,
    LINEAR_SCORE_AT_END,
    EXPONENTIAL_TAIL,
  } = SCORING_V1;

  // Thresholds (matching SCORING_THRESHOLDS from config.js)

  // Perfect zone: < 0.5km = max score
  if (distanceKm < PERFECT_TRANSITION_START) {
    return MAX_SCORE_PER_ROUND;
  }

  // Smooth transition zone: 0.5-2km
  // Linear interpolation from 5000 to score at 2km
  if (distanceKm < PERFECT_TRANSITION_END) {
    // Calculate score at 2km using exponential formula
    const scoreAt2km = MAX_SCORE_PER_ROUND * Math.exp(-2 / EXPONENTIAL_K);
    const progress =
      (distanceKm - PERFECT_TRANSITION_START) / (PERFECT_TRANSITION_END - PERFECT_TRANSITION_START);
    return Math.round(MAX_SCORE_PER_ROUND + (scoreAt2km - MAX_SCORE_PER_ROUND) * progress);
  }

  // Exponential decay: 2-100km
  if (distanceKm < EXPONENTIAL_END) {
    return Math.round(MAX_SCORE_PER_ROUND * Math.exp(-distanceKm / EXPONENTIAL_K));
  }

  // Linear interpolation: 100-500km (ensures C0 continuity)
  // Calculate exact score at 100km from exponential formula
  if (distanceKm < LINEAR_END) {
    const scoreAt100 = MAX_SCORE_PER_ROUND * Math.exp(-EXPONENTIAL_END / EXPONENTIAL_K);
    const scoreAt500 = LINEAR_SCORE_AT_END;
    const progress = (distanceKm - EXPONENTIAL_END) / (LINEAR_END - EXPONENTIAL_END);
    // Use exact exponential value at 100km to ensure continuity
    return Math.round(scoreAt100 + (scoreAt500 - scoreAt100) * progress);
  }

  // Exponential decay: > 500km (ensures C0 continuity)
  // Start from exact score at 500km (1000) to ensure continuity
  const excess = distanceKm - LINEAR_END;
  return Math.max(0, Math.round(LINEAR_SCORE_AT_END * Math.exp(-excess / EXPONENTIAL_TAIL)));
};

/**
 * Calculate score based on distance - VERSION 2 (Current)
 *
 * Uses a smooth sigmoid-based formula for better score distribution:
 * - < perfectThreshold: Perfect score (5000)
 * - >= perfectThreshold: Sigmoid decay formula
 *
 * Formula: score = maxScore / (1 + (distance / k)^p)
 *
 * This provides:
 * - C∞ continuity (infinitely smooth)
 * - Better granularity in the critical 1-50km zone
 * - More punishing for medium errors (100-500km)
 * - Single formula (no zone transitions)
 *
 * @param {number} distanceKm - Distance in kilometers
 * @param {Object} [config] - Configuration object
 * @param {number} [config.perfectThreshold=0.1] - Distance below which score is perfect
 * @param {number} [config.k=800] - Scale parameter (distance at ~50% score)
 * @param {number} [config.p=1.2] - Power parameter (controls decay steepness)
 * @param {number} [config.maxScore=5000] - Maximum possible score
 * @returns {number} Score (0-5000)
 */
export const calculateScoreV2 = (distanceKm, config = SCORING_FORMULA) => {
  const overrides = config && typeof config === 'object' ? config : {};
  const { perfectThreshold, k, p, maxScore } = {
    ...SCORING_FORMULA,
    ...overrides,
  };

  // Perfect zone: < perfectThreshold = max score
  if (distanceKm < perfectThreshold) {
    return maxScore;
  }

  // Sigmoid formula for smooth decay
  return Math.round(maxScore / (1 + Math.pow(distanceKm / k, p)));
};

/**
 * Calculate score based on distance (default export uses V2)
 *
 * @param {number} distanceKm - Distance in kilometers
 * @param {Object} [config] - Optional configuration (passed to V2)
 * @returns {number} Score (0-5000)
 */
export const calculateScore = calculateScoreV2;

/**
 * Normalize longitude to -180 to 180 range
 * @param {number} lng - Longitude
 * @returns {number} Normalized longitude
 */
export const normalizeLng = (lng) => {
  // Guard against invalid input (CRITICAL: prevents infinite loop)
  if (!Number.isFinite(lng)) {
    logger.error('Invalid longitude:', lng);
    return 0;
  }

  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
};

/**
 * Normalize latitude to -90 to 90 range (clamp)
 * @param {number} lat - Latitude
 * @returns {number} Normalized latitude
 */
export const normalizeLat = (lat) => {
  // Guard against NaN
  if (Number.isNaN(lat)) {
    logger.error('Invalid latitude (NaN):', lat);
    return 0;
  }

  // Clamp to valid range (handles Infinity)
  return Math.max(-90, Math.min(90, lat));
};

/**
 * Normalize coordinates
 * @param {[number, number]} coords - [lat, lng]
 * @returns {[number, number]} Normalized [lat, lng]
 */
export const normalizeCoords = ([lat, lng]) => {
  return [normalizeLat(lat), normalizeLng(lng)];
};
