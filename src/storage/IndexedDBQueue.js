/**
 * IndexedDB Queue for Retry System
 *
 * Provides:
 * - Large volume support (1000+ entries)
 * - Multi-tab concurrency
 * - Automatic migration from localStorage
 * - Better performance than localStorage
 */

import { MODE_IDS } from '../config/game-modes.js';
import { logger } from '../utils/logger.js';

const DB_NAME = 'ptm_retry_queue';
const DB_VERSION = 1;
const STORE_NAME = 'retry_queue';

/**
 * @typedef {Object} RetryQueueEntry
 * @property {string} id - Unique ID
 * @property {string} token - Game token
 * @property {Array} rounds - Rounds data
 * @property {string} pseudo - Player pseudo
 * @property {string} gameType - Game type (classic, daily)
 * @property {number} attempts - Number of retry attempts
 * @property {number} addedAt - Timestamp when added
 */

export class IndexedDBQueue {
  #db = null;
  #dbPromise = null;

  constructor() {
    this.#dbPromise = this.#initDB();
  }

  /**
   * Initialize IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  async #initDB() {
    if (this.#db) {
      return this.#db;
    }

    // Check IndexedDB support
    if (!window.indexedDB) {
      logger.warn('IndexedDB not supported, will use localStorage fallback');
      throw new Error('IndexedDB not supported');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('IndexedDB open failed', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.#db = request.result;
        logger.info('IndexedDB opened successfully');
        resolve(this.#db);
      };

      request.onupgradeneeded = (event) => {
        const db = /** @type {IDBOpenDBRequest} */ (event.target).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });

          // Create indexes
          store.createIndex('addedAt', 'addedAt', { unique: false });
          store.createIndex('attempts', 'attempts', { unique: false });
          store.createIndex('gameType', 'gameType', { unique: false });

          logger.info('IndexedDB object store created');
        }
      };
    });
  }

  /**
   * Get database instance
   * @returns {Promise<IDBDatabase>}
   */
  async #getDB() {
    if (this.#db) {
      return this.#db;
    }
    if (!this.#dbPromise) {
      throw new Error('Database is closed');
    }
    return await this.#dbPromise;
  }

  /**
   * Generate unique ID
   * @returns {string}
   */
  #generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add entry to queue
   * @param {string} token
   * @param {Array} rounds
   * @param {string} pseudo
   * @param {string} gameType
   * @returns {Promise<string>} Entry ID
   */
  async add(token, rounds, pseudo, gameType = MODE_IDS.CLASSIC) {
    try {
      const db = await this.#getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const entry = {
        id: this.#generateId(),
        token,
        rounds,
        pseudo,
        gameType,
        attempts: 0,
        addedAt: Date.now(),
      };

      await new Promise((resolve, reject) => {
        const request = store.add(entry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      logger.debug(`IndexedDBQueue: Added entry ${entry.id}`);
      return entry.id;
    } catch (error) {
      logger.error('IndexedDBQueue: Failed to add entry', error);
      throw error;
    }
  }

  /**
   * Get all entries from queue
   * @returns {Promise<RetryQueueEntry[]>}
   */
  async getAll() {
    try {
      const db = await this.#getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error('IndexedDBQueue: Failed to get all entries', error);
      return [];
    }
  }

  /**
   * Get entry by ID
   * @param {string} id
   * @returns {Promise<RetryQueueEntry|null>}
   */
  async get(id) {
    try {
      const db = await this.#getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error(`IndexedDBQueue: Failed to get entry ${id}`, error);
      return null;
    }
  }

  /**
   * Update entry
   * @param {string} id
   * @param {Partial<RetryQueueEntry>} updates
   * @returns {Promise<boolean>}
   */
  async update(id, updates) {
    try {
      const db = await this.#getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Get existing entry
      const entry = await new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!entry) {
        logger.warn(`IndexedDBQueue: Entry ${id} not found for update`);
        return false;
      }

      // Update entry
      const updatedEntry = { ...entry, ...updates };

      await new Promise((resolve, reject) => {
        const request = store.put(updatedEntry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      logger.debug(`IndexedDBQueue: Updated entry ${id}`);
      return true;
    } catch (error) {
      logger.error(`IndexedDBQueue: Failed to update entry ${id}`, error);
      return false;
    }
  }

  /**
   * Remove entry from queue
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async remove(id) {
    try {
      const db = await this.#getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      logger.debug(`IndexedDBQueue: Removed entry ${id}`);
      return true;
    } catch (error) {
      logger.error(`IndexedDBQueue: Failed to remove entry ${id}`, error);
      return false;
    }
  }

  /**
   * Clear all entries
   * @returns {Promise<boolean>}
   */
  async clear() {
    try {
      // Check if DB is closed
      if (!this.#db && !this.#dbPromise) {
        logger.warn('IndexedDBQueue: Cannot clear - database is closed');
        return false;
      }

      const db = await this.#getDB();
      if (!db) {
        logger.warn('IndexedDBQueue: Cannot clear - database is null');
        return false;
      }

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      logger.info('IndexedDBQueue: Cleared all entries');
      return true;
    } catch (error) {
      logger.error('IndexedDBQueue: Failed to clear', error);
      return false;
    }
  }

  /**
   * Get count of entries
   * @returns {Promise<number>}
   */
  async count() {
    try {
      const db = await this.#getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return await new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error('IndexedDBQueue: Failed to count', error);
      return 0;
    }
  }

  /**
   * Increment attempt counter for an entry
   * @param {string} id
   * @returns {Promise<number>} New attempt count
   */
  async incrementAttempts(id) {
    try {
      const entry = await this.get(id);
      if (!entry) {
        return 0;
      }

      const newAttempts = entry.attempts + 1;
      await this.update(id, { attempts: newAttempts });

      return newAttempts;
    } catch (error) {
      logger.error(`IndexedDBQueue: Failed to increment attempts for ${id}`, error);
      return 0;
    }
  }

  /**
   * Get entries sorted by oldest first
   * @param {number} limit
   * @returns {Promise<RetryQueueEntry[]>}
   */
  async getOldest(limit = 10) {
    try {
      const db = await this.#getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('addedAt');

      return await new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'next');
        const results = [];
        let transactionEnded = false;

        // Handle transaction completion
        transaction.oncomplete = () => {
          if (!transactionEnded) {
            transactionEnded = true;
            resolve(results);
          }
        };

        transaction.onerror = () => {
          if (!transactionEnded) {
            transactionEnded = true;
            reject(transaction.error || new Error('Transaction failed'));
          }
        };

        request.onsuccess = (event) => {
          const cursor = /** @type {IDBRequest} */ (event.target).result;
          if (cursor && results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            // Cursor finished or limit reached
            if (!transactionEnded) {
              transactionEnded = true;
              resolve(results);
            }
          }
        };

        request.onerror = () => {
          if (!transactionEnded) {
            transactionEnded = true;
            reject(request.error);
          }
        };
      });
    } catch (error) {
      logger.error('IndexedDBQueue: Failed to get oldest entries', error);
      return [];
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
      this.#dbPromise = null;
      logger.info('IndexedDBQueue: Database closed');
    }
  }
}

// Lazy singleton instance
let _instance = null;

/**
 * Get singleton instance of IndexedDBQueue
 * @returns {IndexedDBQueue}
 */
export function getIndexedDBQueue() {
  if (!_instance) {
    _instance = new IndexedDBQueue();
  }
  return _instance;
}
