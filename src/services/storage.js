// Point The Map - Storage Service

import { MODE_IDS } from "../config/game-modes.js";
import { storageManager, QuotaExceededError } from "../storage/StorageManager.js";
import { logger } from "../utils/logger.js";
import { eventBus } from "../core/EventBus.js";

// Export storage manager for direct access if needed
export { storageManager, QuotaExceededError };

// Legacy API - kept for backwards compatibility
export const storage = {
  get: (key) => storageManager.get(key),
  set: (key, value) => {
    try {
      return storageManager.set(key, value);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        // Handle quota exceeded
        logger.error("Storage quota exceeded. Attempting cleanup...");

        // Emit event for UI notification
        eventBus.emit("storage:quota-exceeded", {
          message: "Storage limit reached. Cleaning up old data...",
        });

        try {
          // Try to free up 1MB
          const freed = storageManager.autoCleanup(1024 * 1024);
          logger.info(`Cleaned up ${freed} bytes`);

          // Retry the operation
          const success = storageManager.set(key, value);

          if (success) {
            // Emit success event
            eventBus.emit("storage:quota-recovered", {
              message: `Cleaned up ${Math.round(freed / 1024)}KB successfully.`,
              freedBytes: freed,
            });
          } else {
            // Emit failure event
            eventBus.emit("storage:quota-failed", {
              message: "Unable to free enough space. Some data may not be saved.",
            });
          }

          return success;
        } catch (retryError) {
          logger.error("Failed to save after cleanup", retryError);

          // Emit failure event
          eventBus.emit("storage:quota-failed", {
            message: "Storage full. Unable to save data.",
          });

          return false;
        }
      }
      return false;
    }
  },
};

export const getLastPseudo = () => storage.get("lastPseudo");
export const setLastPseudo = (pseudo) => storage.set("lastPseudo", pseudo);
export const getTheme = () => storage.get("theme") || "dark";
export const setTheme = (theme) => storage.set("theme", theme);

const RETRY_QUEUE_KEY = "retry_queue";

export const getRetryQueue = () => {
  try {
    const queue = storageManager.get(RETRY_QUEUE_KEY);
    return queue || [];
  } catch (error) {
    logger.error("Erreur parsing retry queue:", error);
    try {
      storageManager.remove(RETRY_QUEUE_KEY); // Nettoyer la valeur corrompue
    } catch {
      // iOS Private Mode: localStorage.removeItem peut aussi échouer
    }
    return [];
  }
};

export const saveRetryQueue = (queue) => {
  try {
    return storageManager.set(RETRY_QUEUE_KEY, queue);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      logger.warn("Quota exceeded while saving retry queue. Attempting cleanup...");

      try {
        // Try to clean up old queue entries
        const freed = storageManager.autoCleanup(512 * 1024); // 512KB
        logger.info(`Cleaned up ${freed} bytes`);

        // Retry
        return storageManager.set(RETRY_QUEUE_KEY, queue);
      } catch (retryError) {
        logger.error("Failed to save retry queue after cleanup", retryError);
        return false;
      }
    }

    // iOS Private Mode: localStorage.setItem échoue complètement
    logger.warn("Impossible de sauvegarder la retry queue (iOS Private Mode?)", error);
    return false;
  }
};

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
    logger.warn("⚠️ Retry queue non sauvegardée (mode privé iOS?)");
  }
  return saved;
};

export const removeFromRetryQueue = (index) => {
  const queue = getRetryQueue();
  queue.splice(index, 1);
  return saveRetryQueue(queue);
};
