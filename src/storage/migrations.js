/**
 * Storage Migrations
 *
 * Each migration should have:
 * - version: number (migration version)
 * - name: string (description)
 * - up: function (migration logic)
 * - down: function (rollback logic - optional)
 */

import { logger } from "../utils/logger.js";

/**
 * Migration v1: Add timestamps to existing data
 *
 * Adds `lastAccess` timestamp to all existing storage items
 * to enable LRU cleanup
 */
const migrationV1 = {
  version: 1,
  name: "Add timestamps to existing data",
  up: (storageManager) => {
    const keys = storageManager.getAllKeys();
    const now = Date.now();

    for (const key of keys) {
      try {
        const value = storageManager.get(key);

        if (value && typeof value === "object") {
          // Add lastAccess if not present
          if (!value.lastAccess && !value.addedAt && !value.timestamp) {
            value.lastAccess = now;
            storageManager.set(key, value);
            logger.debug(`Migration v1: Added timestamp to ${key}`);
          }
        }
      } catch (error) {
        logger.warn(`Migration v1: Failed to migrate ${key}`, error);
        // Continue with other keys
      }
    }
  },
  down: (storageManager) => {
    // Rollback: remove lastAccess field
    const keys = storageManager.getAllKeys();

    for (const key of keys) {
      try {
        const value = storageManager.get(key);

        if (value && typeof value === "object" && value.lastAccess) {
          delete value.lastAccess;
          storageManager.set(key, value);
        }
      } catch (error) {
        logger.warn(`Migration v1 rollback: Failed to rollback ${key}`, error);
      }
    }
  },
};

/**
 * Example Migration v2: Rename retry_queue to retryQueue
 * (Not active yet, but shows how to add future migrations)
 */
const migrationV2Example = {
  version: 2,
  name: "Rename retry_queue to retryQueue",
  up: (storageManager) => {
    // Get old data
    const oldKey = "retry_queue";
    const oldData = storageManager.get(oldKey);

    if (oldData) {
      // Save with new key
      storageManager.set("retryQueue", oldData);
      // Remove old key
      storageManager.remove(oldKey);
      logger.info("Migration v2: Renamed retry_queue to retryQueue");
    }
  },
  down: (storageManager) => {
    // Rollback: rename back
    const newData = storageManager.get("retryQueue");

    if (newData) {
      storageManager.set("retry_queue", newData);
      storageManager.remove("retryQueue");
    }
  },
};

/**
 * All migrations in order
 * Add new migrations to this array
 */
export const migrations = [
  migrationV1,
  // migrationV2Example, // Uncomment when ready to activate
];
