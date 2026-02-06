/**
 * Storage Manager with versioning and migrations
 *
 * Handles localStorage with:
 * - Version tracking
 * - Automatic migrations
 * - Quota management
 * - Error handling
 */

import { logger } from '../utils/logger.js';
import { migrations } from './migrations.js';

const STORAGE_VERSION_KEY = 'ptm_storage_version';
const CURRENT_VERSION = 2;

/**
 * @typedef {Object} StorageInfo
 * @property {number} used - Bytes used
 * @property {number} quota - Total quota (estimate)
 * @property {number} percentage - Percentage used
 */

export class StorageManager {
  #prefix = 'ptm_';
  #version = CURRENT_VERSION;

  constructor() {
    this.#initializeStorage();
  }

  /**
   * Initialize storage and run migrations if needed
   */
  #initializeStorage() {
    try {
      const storedVersion = this.#getStorageVersion();

      if (storedVersion === null) {
        // First time initialization
        logger.info('Storage: First initialization');
        this.#setStorageVersion(this.#version);
      } else if (storedVersion < this.#version) {
        // Run migrations
        logger.info(`Storage: Migrating from v${storedVersion} to v${this.#version}`);
        this.#runMigrations(storedVersion, this.#version);
        this.#setStorageVersion(this.#version);
      } else if (storedVersion > this.#version) {
        // Newer version than current (downgrade scenario)
        logger.warn(
          `Storage: Stored version (${storedVersion}) is newer than current (${this.#version})`
        );
      }
    } catch (error) {
      logger.error('Storage: Initialization failed', error);
    }
  }

  /**
   * Get current storage version
   * @returns {number|null}
   */
  #getStorageVersion() {
    try {
      const version = localStorage.getItem(STORAGE_VERSION_KEY);
      return version ? parseInt(version, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set storage version
   * @param {number} version
   */
  #setStorageVersion(version) {
    try {
      localStorage.setItem(STORAGE_VERSION_KEY, version.toString());
    } catch (error) {
      logger.error('Storage: Failed to set version', error);
    }
  }

  /**
   * Run migrations from oldVersion to newVersion
   * @param {number} fromVersion
   * @param {number} toVersion
   */
  #runMigrations(fromVersion, toVersion) {
    const migrationsToRun = migrations
      .filter((m) => m.version > fromVersion && m.version <= toVersion)
      .sort((a, b) => a.version - b.version);

    for (const migration of migrationsToRun) {
      try {
        logger.info(`Storage: Running migration v${migration.version}: ${migration.name}`);
        migration.up(this);
        logger.info(`Storage: Migration v${migration.version} completed`);
      } catch (error) {
        logger.error(`Storage: Migration v${migration.version} failed`, error);
        throw new Error(`Migration failed at v${migration.version}: ${error.message}`);
      }
    }
  }

  /**
   * Get item from storage
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    try {
      const item = localStorage.getItem(this.#prefix + key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      logger.warn(`Storage: Failed to get ${key}`, error);
      return null;
    }
  }

  /**
   * Set item in storage
   * @param {string} key
   * @param {any} value
   * @returns {boolean}
   */
  set(key, value) {
    try {
      localStorage.setItem(this.#prefix + key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (this.#isQuotaExceeded(error)) {
        logger.error('Storage: Quota exceeded', error);
        throw new QuotaExceededError('Storage quota exceeded');
      }
      logger.error(`Storage: Failed to set ${key}`, error);
      return false;
    }
  }

  /**
   * Remove item from storage
   * @param {string} key
   * @returns {boolean}
   */
  remove(key) {
    try {
      localStorage.removeItem(this.#prefix + key);
      return true;
    } catch (error) {
      logger.error(`Storage: Failed to remove ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all items with prefix
   * @returns {boolean}
   */
  clear() {
    try {
      const keys = this.getAllKeys();
      for (const key of keys) {
        localStorage.removeItem(this.#prefix + key);
      }
      return true;
    } catch (error) {
      logger.error('Storage: Failed to clear', error);
      return false;
    }
  }

  /**
   * Get all keys (without prefix)
   * @returns {string[]}
   */
  getAllKeys() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.#prefix)) {
          keys.push(key.substring(this.#prefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }

  /**
   * Get raw key (with prefix) - for migrations
   * @param {string} key
   * @returns {string}
   */
  getRawKey(key) {
    return this.#prefix + key;
  }

  /**
   * Get storage info
   * @returns {StorageInfo}
   */
  getStorageInfo() {
    try {
      const used = this.#calculateStorageSize();
      const quota = this.#estimateQuota();
      const percentage = quota > 0 ? (used / quota) * 100 : 0;

      return {
        used,
        quota,
        percentage,
      };
    } catch (error) {
      logger.error('Storage: Failed to get storage info', error);
      return { used: 0, quota: 0, percentage: 0 };
    }
  }

  /**
   * Calculate current storage size in bytes
   * @returns {number}
   */
  #calculateStorageSize() {
    let size = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.#prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            // Calculate size: key + value in UTF-16 (2 bytes per char)
            size += (key.length + value.length) * 2;
          }
        }
      }
    } catch {
      // Ignore
    }
    return size;
  }

  /**
   * Estimate localStorage quota
   * Most browsers: 5-10MB, we estimate 5MB to be safe
   * @returns {number}
   */
  #estimateQuota() {
    // Try to use Storage API if available
    if (navigator.storage && navigator.storage.estimate) {
      // Note: This returns a Promise, but we'll use the estimate for now
      // In production, this should be async
      return 5 * 1024 * 1024; // 5MB default estimate
    }

    // Fallback: 5MB (conservative estimate for localStorage)
    return 5 * 1024 * 1024;
  }

  /**
   * Check if error is quota exceeded
   * @param {Error} error
   * @returns {boolean}
   */
  #isQuotaExceeded(error) {
    return (
      error instanceof DOMException &&
      // Everything except Firefox
      (error.code === 22 ||
        // Firefox
        error.code === 1014 ||
        // Test name field too, because code might not be present
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    );
  }

  /**
   * Auto-cleanup old data (LRU - Least Recently Used)
   * @param {number} targetBytes - Target size to reach
   * @returns {number} - Bytes freed
   */
  autoCleanup(targetBytes = 1024 * 1024) {
    logger.info('Storage: Starting auto-cleanup');

    try {
      const items = [];

      // Collect all items with timestamp
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.#prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const parsed = JSON.parse(value);
              // Get timestamp from various possible fields
              const timestamp = parsed.addedAt || parsed.timestamp || parsed.lastAccess || 0;
              items.push({
                key,
                size: (key.length + value.length) * 2,
                timestamp,
              });
            } catch {
              // Skip non-JSON items
            }
          }
        }
      }

      // Sort by timestamp (oldest first)
      items.sort((a, b) => a.timestamp - b.timestamp);

      let freedBytes = 0;
      for (const item of items) {
        if (freedBytes >= targetBytes) {
          break;
        }

        localStorage.removeItem(item.key);
        freedBytes += item.size;
        logger.debug(`Storage: Removed ${item.key} (${item.size} bytes)`);
      }

      logger.info(`Storage: Cleanup freed ${freedBytes} bytes`);
      return freedBytes;
    } catch (error) {
      logger.error('Storage: Auto-cleanup failed', error);
      return 0;
    }
  }
}

/**
 * Custom error for quota exceeded
 */
export class QuotaExceededError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

// Singleton instance
export const storageManager = new StorageManager();
