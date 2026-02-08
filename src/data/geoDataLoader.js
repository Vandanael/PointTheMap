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
const CACHE_URLS_LOW = {
  countries: '/data/countries.low.geojson',
  civilizations: '/data/civilizations.low.geojson',
};

const IDB_DB_NAME = 'ptm_geojson';
const IDB_DB_VERSION = 1;
const IDB_STORE = 'geojson';

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
 * Cache hit stats for quick verification on repeat visits.
 */
const cacheStats = {
  requests: 0,
  hits: {
    memory: 0,
    indexedDb: 0,
    cacheStorage: 0,
    network: 0,
  },
};

/**
 * Check if we should avoid background refresh (tests).
 * @returns {boolean}
 */
function isTestEnv() {
  return Boolean(globalThis.__vitest__ || globalThis.__VITEST__);
}

/**
 * Check if IndexedDB is available
 * @returns {boolean}
 */
function isIndexedDbAvailable() {
  if (isLowEndDevice()) return false;
  if (typeof indexedDB === 'undefined') return false;
  return true;
}

/**
 * Open IndexedDB for GeoJSON cache
 * @returns {Promise<IDBDatabase>}
 */
function openGeoDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = /** @type {IDBOpenDBRequest} */ (event.target).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

/**
 * Load parsed GeoJSON from IndexedDB
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function loadFromIndexedDb(key) {
  if (!isIndexedDbAvailable()) return null;
  try {
    const db = await openGeoDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([IDB_STORE], 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    logger.warn(`GeoDataLoader: IndexedDB read failed for ${key}:`, error);
    return null;
  }
}

/**
 * Save parsed GeoJSON to IndexedDB
 * @param {string} key
 * @param {any} data
 * @returns {Promise<void>}
 */
async function saveToIndexedDb(key, data) {
  if (!isIndexedDbAvailable()) return;
  try {
    const db = await openGeoDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([IDB_STORE], 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(data, key);
      req.onsuccess = () => resolve(undefined);
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    logger.warn(`GeoDataLoader: IndexedDB write failed for ${key}:`, error);
  }
}

/**
 * Check if network conditions suggest avoiding large prefetches.
 * @returns {boolean}
 */
function isSlowNetwork() {
  if (typeof navigator === 'undefined') return false;
  const nav =
    /** @type {Navigator & { connection?: { effectiveType?: string, saveData?: boolean } }} */ (
      navigator
    );
  if (!nav.connection) return false;
  const conn = nav.connection;
  const effectiveType = conn.effectiveType || '';
  return conn.saveData === true || effectiveType === 'slow-2g' || effectiveType === '2g';
}

/**
 * Check if we should prefetch large GeoJSON assets.
 * @returns {boolean}
 */
function shouldPrefetchGeoJSON() {
  if (isLowEndDevice()) return false;
  if (isSlowNetwork()) return false;
  return true;
}

/**
 * Check if background refresh should run.
 * @returns {boolean}
 */
function shouldBackgroundRefresh() {
  if (isTestEnv()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  if (isSlowNetwork()) return false;
  return true;
}

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
 * Refresh cached data in the background (stale-while-revalidate).
 * @param {string} key
 * @param {string} url
 * @returns {Promise<void>}
 */
async function refreshGeoJSON(key, url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    await saveToCacheStorage(url, response);
    const data = await response.json();
    memoryCache.set(key, data);
  } catch (error) {
    logger.warn(`GeoDataLoader: Background refresh failed for ${url}:`, error);
  }
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
  cacheStats.requests += 1;
  // Layer 1: Check in-memory cache (instant)
  if (memoryCache.has(key)) {
    cacheStats.hits.memory += 1;
    logger.info(`GeoDataLoader: Cache hit (memory) for ${key}`);
    return memoryCache.get(key);
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const loadPromise = (async () => {
    // Layer 1.5: Check IndexedDB (parsed cache)
    const idbData = await loadFromIndexedDb(key);
    if (idbData) {
      cacheStats.hits.indexedDb += 1;
      logger.info(`GeoDataLoader: Cache hit (IndexedDB) for ${key}`);
      memoryCache.set(key, idbData);
      if (shouldBackgroundRefresh()) {
        void scheduleIdle(() => refreshGeoJSON(key, url));
      }
      return idbData;
    }

    // Layer 2: Check CacheStorage (fast)
    const cachedData = await loadFromCacheStorage(url);
    if (cachedData) {
      cacheStats.hits.cacheStorage += 1;
      memoryCache.set(key, cachedData);
      void saveToIndexedDb(key, cachedData);
      if (shouldBackgroundRefresh()) {
        void scheduleIdle(() => refreshGeoJSON(key, url));
      }
      return cachedData;
    }

    // Layer 3: Fetch from network (slow)
    logger.info(`GeoDataLoader: Fetching from network: ${url}`);
    cacheStats.hits.network += 1;
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
    void saveToIndexedDb(key, data);

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
 * Load low-res countries GeoJSON for fast rendering
 * @returns {Promise<any>} Countries GeoJSON FeatureCollection (low-res)
 */
export async function getCountriesGeoJSONLow() {
  return loadGeoJSON('countries-low', CACHE_URLS_LOW.countries);
}

/**
 * Load civilizations GeoJSON with caching
 * @returns {Promise<any>} Civilizations GeoJSON FeatureCollection
 */
export async function getCivilizationsGeoJSON() {
  return loadGeoJSON('civilizations', CACHE_URLS.civilizations);
}

/**
 * Load low-res civilizations GeoJSON for fast rendering
 * @returns {Promise<any>} Civilizations GeoJSON FeatureCollection (low-res)
 */
export async function getCivilizationsGeoJSONLow() {
  return loadGeoJSON('civilizations-low', CACHE_URLS_LOW.civilizations);
}

/**
 * Preload countries GeoJSON in idle time.
 * @returns {Promise<any | null>}
 */
export function preloadCountriesGeoJSON() {
  if (!shouldPrefetchGeoJSON()) return Promise.resolve(null);
  return scheduleIdle(() =>
    loadGeoJSON('countries-low', CACHE_URLS_LOW.countries).catch(() => null)
  );
}

/**
 * Preload civilizations GeoJSON in idle time.
 * @returns {Promise<any | null>}
 */
export function preloadCivilizationsGeoJSON() {
  if (!shouldPrefetchGeoJSON()) return Promise.resolve(null);
  return scheduleIdle(() =>
    loadGeoJSON('civilizations-low', CACHE_URLS_LOW.civilizations).catch(() => null)
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
  if (isIndexedDbAvailable()) {
    try {
      const db = await openGeoDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction([IDB_STORE], 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const req = store.clear();
        req.onsuccess = () => resolve(undefined);
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      logger.warn('GeoDataLoader: Failed to clear IndexedDB:', error);
    }
  }
}

/**
 * Get cache stats (for debugging)
 * @returns {{ memorySize: number, hasCacheStorage: boolean, requests: number, hits: { memory: number, indexedDb: number, cacheStorage: number, network: number }, hitRate: number }}
 */
export function getCacheStats() {
  const totalHits =
    cacheStats.hits.memory +
    cacheStats.hits.indexedDb +
    cacheStats.hits.cacheStorage +
    cacheStats.hits.network;
  const cacheHits =
    cacheStats.hits.memory + cacheStats.hits.indexedDb + cacheStats.hits.cacheStorage;
  const hitRate = totalHits > 0 ? cacheHits / totalHits : 0;

  return {
    memorySize: memoryCache.size,
    hasCacheStorage: isCacheStorageAvailable(),
    requests: cacheStats.requests,
    hits: { ...cacheStats.hits },
    hitRate,
  };
}
