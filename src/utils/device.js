import { MAP } from '@lib/config/index.js';

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

/**
 * Detect iOS devices (iPhone, iPad, iPod)
 * @returns {boolean}
 */
export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ); // iPad avec iPadOS 13+
};
