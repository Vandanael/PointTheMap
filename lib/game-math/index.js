/**
 * Shared game mathematics functions
 * Used by both client (src/) and server (netlify/functions/)
 */

import { logger } from '../../src/utils/logger.js';

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
 * @param {number} distanceKm - Distance in kilometers
 * @returns {number} Score (0-5000)
 */
export const calculateScore = (distanceKm) => {
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
