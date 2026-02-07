/**
 * GeoJSON Data Loader
 *
 * Lazy-loads GeoJSON datasets (countries, civilizations) with dual-layer caching:
 * - In-memory cache for instant access within session
 * - CacheStorage API for persistence across sessions (when available)
 *
 * Prevents redundant network requests and improves performance for country/civilization modes.
 */

import { logger } from '../utils/logger.js';
import { isLowEndDevice } from '../utils/device.js';
import { MAP } from '@lib/config';

const CACHE_NAME = 'ptm-geo-v2';
const CACHE_URLS = {
  countries: '/data/countries.geojson',
  civilizations: '/data/civilizations.geojson',
};

/**
 * In-memory cache for instant access within the same session
 * @type {Map<string, any>}
 */
const memoryCache = new Map();

/**
 * Track in-flight loads to avoid duplicate fetch/parse work
 * @type {Map<string, Promise<any>>}
 */
const inFlight = new Map();

/**
 * Check if CacheStorage API is available
 * @returns {boolean}
 */
function isCacheStorageAvailable() {
  if (isLowEndDevice()) {
    return false;
  }
  return typeof caches !== 'undefined' && 'open' in caches;
}

/**
 * Try to load from CacheStorage
 * @param {string} url - URL to load
 * @returns {Promise<any|null>} Parsed JSON or null if not cached
 */
async function loadFromCacheStorage(url) {
  if (!isCacheStorageAvailable()) {
    return null;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);

    if (response) {
      logger.info(`GeoDataLoader: Cache hit (CacheStorage) for ${url}`);
      return response.json();
    }
  } catch (error) {
    logger.warn(`GeoDataLoader: CacheStorage read failed for ${url}:`, error);
  }

  return null;
}

/**
 * Save to CacheStorage
 * @param {string} url - URL key
 * @param {Response} response - Fetch response to cache
 * @returns {Promise<void>}
 */
async function saveToCacheStorage(url, response) {
  if (!isCacheStorageAvailable()) {
    return;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, response.clone());
    logger.info(`GeoDataLoader: Saved to CacheStorage: ${url}`);
  } catch (error) {
    logger.warn(`GeoDataLoader: CacheStorage write failed for ${url}:`, error);
  }
}

/**
 * Generic loader with dual-layer caching
 * @param {string} key - Cache key ('countries' or 'civilizations')
 * @param {string} url - URL to fetch
 * @returns {Promise<any>} Parsed GeoJSON data
 */
async function loadGeoJSON(key, url) {
  // Layer 1: Check in-memory cache (instant)
  if (memoryCache.has(key)) {
    logger.info(`GeoDataLoader: Cache hit (memory) for ${key}`);
    return memoryCache.get(key);
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const loadPromise = (async () => {
    // Layer 2: Check CacheStorage (fast)
    const cachedData = await loadFromCacheStorage(url);
    if (cachedData) {
      memoryCache.set(key, cachedData);
      return cachedData;
    }

    // Layer 3: Fetch from network (slow)
    logger.info(`GeoDataLoader: Fetching from network: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }

    const contentLength = response.headers?.get?.('content-length');
    if (contentLength) {
      const sizeMb = Number(contentLength) / (1024 * 1024);
      if (Number.isFinite(sizeMb) && sizeMb >= MAP.GEOJSON_WARN_MB) {
        logger.warn(`GeoDataLoader: Large GeoJSON (${sizeMb.toFixed(2)} MB) for ${url}`);
      }
    }

    // Save to CacheStorage for next session
    await saveToCacheStorage(url, response);

    // Parse and cache in memory
    const data = await response.json();
    memoryCache.set(key, data);

    return data;
  })();

  inFlight.set(key, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Schedule a task during idle time (fallback to setTimeout).
 * @template T
 * @param {() => Promise<T> | T} task
 * @returns {Promise<T>}
 */
function scheduleIdle(task) {
  return new Promise((resolve) => {
    const run = () => {
      Promise.resolve().then(task).then(resolve).catch(resolve);
    };
    const idleCallback =
      typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : null;
    if (idleCallback) {
      idleCallback(run);
    } else {
      setTimeout(run, 0);
    }
  });
}

/**
 * Load countries GeoJSON with caching
 * @returns {Promise<any>} Countries GeoJSON FeatureCollection
 */
export async function getCountriesGeoJSON() {
  return loadGeoJSON('countries', CACHE_URLS.countries);
}

/**
 * Load civilizations GeoJSON with caching
 * @returns {Promise<any>} Civilizations GeoJSON FeatureCollection
 */
export async function getCivilizationsGeoJSON() {
  return loadGeoJSON('civilizations', CACHE_URLS.civilizations);
}

/**
 * Preload countries GeoJSON in idle time.
 * @returns {Promise<any | null>}
 */
export function preloadCountriesGeoJSON() {
  return scheduleIdle(() => loadGeoJSON('countries', CACHE_URLS.countries).catch(() => null));
}

/**
 * Preload civilizations GeoJSON in idle time.
 * @returns {Promise<any | null>}
 */
export function preloadCivilizationsGeoJSON() {
  return scheduleIdle(() =>
    loadGeoJSON('civilizations', CACHE_URLS.civilizations).catch(() => null)
  );
}

/**
 * Clear all caches (for testing/debugging)
 * @returns {Promise<void>}
 */
export async function clearGeoCache() {
  memoryCache.clear();

  if (isCacheStorageAvailable()) {
    try {
      await caches.delete(CACHE_NAME);
      logger.info('GeoDataLoader: Cache cleared');
    } catch (error) {
      logger.warn('GeoDataLoader: Failed to clear CacheStorage:', error);
    }
  }
}

/**
 * Get cache stats (for debugging)
 * @returns {{ memorySize: number, hasCacheStorage: boolean }}
 */
export function getCacheStats() {
  return {
    memorySize: memoryCache.size,
    hasCacheStorage: isCacheStorageAvailable(),
  };
}
