/**
 * Lazy loader for capitals data
 * Delays loading the capitals.js file until actually needed
 * Reduces initial bundle size by ~15KB
 */

import { logger } from '../utils/logger.js';

// Cache for loaded capitals
let capitalsCache = null;
let selectBalancedCapitalsCache = null;

/**
 * Lazy load capitals data
 * @returns {Promise<Array>} Capitals array
 */
export async function loadCapitals() {
  if (capitalsCache) {
    return capitalsCache;
  }

  // Dynamic import - only loaded when this function is called
  const module = await import('../../capitals.js');
  capitalsCache = module.capitals;

  return capitalsCache;
}

/**
 * Lazy load selectBalancedCapitals function
 * @returns {Promise<Function>} selectBalancedCapitals function
 */
export async function loadSelectBalancedCapitals() {
  if (selectBalancedCapitalsCache) {
    return selectBalancedCapitalsCache;
  }

  // Dynamic import
  const module = await import('../../capitals.js');
  selectBalancedCapitalsCache = module.selectBalancedCapitals;

  return selectBalancedCapitalsCache;
}

/**
 * Preload capitals data (optional, for performance)
 * Call this when you know capitals will be needed soon
 */
export function preloadCapitals() {
  // Fire and forget - just trigger the import
  loadCapitals().catch(err => {
    logger.error('Failed to preload capitals:', err);
  });
}
