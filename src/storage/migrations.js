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
 * Migration v2: Initialize stats and achievements
 *
 * Adds personal statistics tracking and achievement system
 */
const migrationV2 = {
  version: 2,
  name: "Initialize stats and achievements",
  up: (storageManager) => {
    // Initialize stats with defaults
    if (!storageManager.get('stats')) {
      storageManager.set('stats', {
        bestClassic: Infinity,
        bestDaily: Infinity,
        averageDistance: 0,
        perfectCount: 0,
        playCount: 0,
        streakDaily: 0,
        lastDailyDate: null,
        totalRoundsPlayed: 0,
        under20kmCount: 0,
        lastUpdated: Date.now(),
        lastAccess: Date.now()
      });
      logger.info("Migration v2: Initialized stats");
    }

    // Initialize achievements with all false
    if (!storageManager.get('achievements')) {
      storageManager.set('achievements', {
        perfectRound: false,
        perfectGame: false,
        avgUnder10: false,
        avgUnder50: false,
        top1pct: false,
        streak3: false,
        play10: false,
        play50: false,
        lastAccess: Date.now()
      });
      logger.info("Migration v2: Initialized achievements");
    }
  },
  down: (storageManager) => {
    // Rollback: remove stats and achievements
    storageManager.remove('stats');
    storageManager.remove('achievements');
    logger.info("Migration v2: Removed stats and achievements");
  },
};

/**
 * All migrations in order
 * Add new migrations to this array
 */
export const migrations = [
  migrationV1,
  migrationV2,
];
