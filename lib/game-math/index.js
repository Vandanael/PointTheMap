/**
 * Shared game mathematics functions
 * Used by both client (src/) and server (netlify/functions/)
 */

// Simple logger for server-side (compatible with both client and server)
const logger = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args),
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
  const [dLat, dLon] = [lat2 - lat1, lon2 - lon1].map(toRad);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

/**
 * Calculate score based on distance
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
export const calculateScore = (distanceKm) => {
  const MAX_SCORE_PER_ROUND = 5000;
  
  // Thresholds (matching SCORING_THRESHOLDS from config.js)
  const PERFECT_TRANSITION_START = 0.5;
  const PERFECT_TRANSITION_END = 2;
  const EXPONENTIAL_END = 100;
  const LINEAR_END = 500;

  // Perfect zone: < 0.5km = max score
  if (distanceKm < PERFECT_TRANSITION_START) {
    return MAX_SCORE_PER_ROUND;
  }

  // Smooth transition zone: 0.5-2km
  // Linear interpolation from 5000 to score at 2km
  if (distanceKm < PERFECT_TRANSITION_END) {
    // Calculate score at 2km using exponential formula
    const scoreAt2km = 5000 * Math.exp(-2 / 280);
    const progress = (distanceKm - PERFECT_TRANSITION_START) / (PERFECT_TRANSITION_END - PERFECT_TRANSITION_START);
    return Math.round(MAX_SCORE_PER_ROUND + (scoreAt2km - MAX_SCORE_PER_ROUND) * progress);
  }

  // Exponential decay: 2-100km
  if (distanceKm < EXPONENTIAL_END) {
    return Math.round(5000 * Math.exp(-distanceKm / 280));
  }

  // Linear interpolation: 100-500km (ensures C0 continuity)
  // Calculate exact score at 100km from exponential formula
  if (distanceKm < LINEAR_END) {
    const scoreAt100 = 5000 * Math.exp(-EXPONENTIAL_END / 280);
    const scoreAt500 = 1000;
    const progress = (distanceKm - EXPONENTIAL_END) / (LINEAR_END - EXPONENTIAL_END);
    // Use exact exponential value at 100km to ensure continuity
    return Math.round(scoreAt100 + (scoreAt500 - scoreAt100) * progress);
  }

  // Exponential decay: > 500km (ensures C0 continuity)
  // Start from exact score at 500km (1000) to ensure continuity
  const excess = distanceKm - LINEAR_END;
  return Math.max(0, Math.round(1000 * Math.exp(-excess / 800)));
};

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
