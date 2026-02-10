// Point The Map - Storage Service

import { MODE_IDS } from '@lib/config/game-modes.js';
import { storageManager, QuotaExceededError } from '../storage/StorageManager.js';
import { logger } from '../utils/logger.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/eventTypes.js';

// Export storage manager for direct access if needed
export { storageManager, QuotaExceededError };

// Legacy API - kept for backwards compatibility
export const storage = {
  /** @param {string} key */
  get: (key) => storageManager.get(key),
  /** @param {string} key @param {unknown} value */
  set: (key, value) => {
    try {
      return storageManager.set(key, value);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        // Handle quota exceeded
        logger.error('Storage quota exceeded. Attempting cleanup...');

        // Emit event for UI notification
        eventBus.emit(EVENTS.STORAGE_QUOTA_EXCEEDED, {
          message: 'Storage limit reached. Cleaning up old data...',
        });

        try {
          // Try to free up 1MB
          const freed = storageManager.autoCleanup(1024 * 1024);
          logger.info(`Cleaned up ${freed} bytes`);

          // Retry the operation
          const success = storageManager.set(key, value);

          if (success) {
            // Emit success event
            eventBus.emit(EVENTS.STORAGE_QUOTA_RECOVERED, {
              message: `Cleaned up ${Math.round(freed / 1024)}KB successfully.`,
              freedBytes: freed,
            });
          } else {
            // Emit failure event
            eventBus.emit(EVENTS.STORAGE_QUOTA_FAILED, {
              message: 'Unable to free enough space. Some data may not be saved.',
            });
          }

          return success;
        } catch (retryError) {
          logger.error('Failed to save after cleanup', retryError);

          // Emit failure event
          eventBus.emit(EVENTS.STORAGE_QUOTA_FAILED, {
            message: 'Storage full. Unable to save data.',
          });

          return false;
        }
      }
      return false;
    }
  },
};

export const getLastPseudo = () => storage.get('lastPseudo');
/** @param {string} pseudo */
export const setLastPseudo = (pseudo) => storage.set('lastPseudo', pseudo);
export const getTheme = () => storage.get('theme') || 'dark';
/** @param {string} theme */
export const setTheme = (theme) => storage.set('theme', theme);

export const getMapView = () => storage.get('mapView');
/** @param {{ lat: number; lng: number } | [number, number]} center @param {number} zoom */
export const setMapView = (center, zoom) => storage.set('mapView', { center, zoom });

const RETRY_QUEUE_KEY = 'retry_queue';

export const getRetryQueue = () => {
  try {
    const queue = storageManager.get(RETRY_QUEUE_KEY);
    return queue || [];
  } catch (error) {
    logger.error('Error parsing retry queue:', error);
    try {
      storageManager.remove(RETRY_QUEUE_KEY);
    } catch {
      // iOS Private Mode: localStorage.removeItem may also fail
    }
    return [];
  }
};

/** @param {Array<{ token: string; rounds: unknown; pseudo: string; gameType?: string; attempts?: number; addedAt?: number }>} queue */
export const saveRetryQueue = (queue) => {
  try {
    return storageManager.set(RETRY_QUEUE_KEY, queue);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      logger.warn('Quota exceeded while saving retry queue. Attempting cleanup...');

      try {
        // Try to clean up old queue entries
        const freed = storageManager.autoCleanup(512 * 1024); // 512KB
        logger.info(`Cleaned up ${freed} bytes`);

        // Retry
        return storageManager.set(RETRY_QUEUE_KEY, queue);
      } catch (retryError) {
        logger.error('Failed to save retry queue after cleanup', retryError);
        return false;
      }
    }

    // iOS Private Mode: localStorage.setItem fails completely
    logger.warn('Cannot save retry queue (iOS Private Mode?)', error);
    return false;
  }
};

/** @param {string} token @param {unknown} rounds @param {string} pseudo @param {string} [gameType] */
export const addToRetryQueue = (token, rounds, pseudo, gameType = MODE_IDS.CLASSIC) => {
  const queue = getRetryQueue();
  queue.push({
    token,
    rounds,
    pseudo,
    gameType,
    attempts: 0,
    addedAt: Date.now(),
  });
  const saved = saveRetryQueue(queue);
  if (!saved) {
    logger.warn('Retry queue not saved (iOS Private Mode?)');
  }
  return saved;
};

/** @param {number} index */
export const removeFromRetryQueue = (index) => {
  const queue = getRetryQueue();
  queue.splice(index, 1);
  return saveRetryQueue(queue);
};
