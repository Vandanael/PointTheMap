import { MAP } from '../config.js';

/**
 * Heuristic for low-end devices to reduce caching overhead.
 * @returns {boolean}
 */
export const isLowEndDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const nav = /** @type {{ deviceMemory?: number, hardwareConcurrency?: number }} */ (navigator);
  const memory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
  const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null;

  if (memory !== null && memory <= MAP.GEOJSON_CACHE_MAX_DEVICE_MEMORY_GB) return true;
  if (cores !== null && cores <= MAP.GEOJSON_CACHE_MAX_HW_CONCURRENCY) return true;
  return false;
};
