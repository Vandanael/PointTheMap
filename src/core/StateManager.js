/**
 * StateManager - Centralized immutable state management
 *
 * Features:
 * - Immutable updates (old state never mutated)
 * - Validation on setState
 * - State history (max 50 entries) — linear log of snapshots, not undo/redo stack
 * - Integration with EventBus
 * - DevTools support
 */

import { eventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';

export class StateManager {
  #state;
  #history = [];
  #maxHistorySize = 50;
  #subscribers = new Set();
  #validators = new Map();

  /**
   * Create a new StateManager
   * @param {*} initialState - Initial state value
   */
  constructor(initialState) {
    this.#state = initialState;
  }

  /**
   * Get current state (immutable)
   * @returns {*} Current state
   */
  getState() {
    return this.#state;
  }

  /**
   * Update state (immutable)
   * @param {* | Function} stateOrUpdater - New state or updater function
   * @param {string} action - Action name for debugging
   * @returns {*} New state
   */
  setState(stateOrUpdater, action = 'unknown') {
    const prevState = this.#state;

    // Support updater function pattern
    // Clone prevState to prevent accidental mutations in updater functions
    const nextState =
      typeof stateOrUpdater === 'function'
        ? stateOrUpdater(this.#cloneState(prevState))
        : stateOrUpdater;

    // Validate new state
    this.#validate(nextState, prevState);

    // Update state
    this.#state = nextState;

    // Add to history
    this.#addToHistory(prevState, nextState, action);

    // Notify subscribers
    this.#notifySubscribers(nextState, prevState, action);

    // Emit event
    eventBus.emit('state:changed', { state: nextState, prevState, action });

    return nextState;
  }

  /**
   * Clone state with fallback for older browsers.
   * @param {any} value
   * @returns {any}
   */
  #cloneState(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Callback function (state, prevState, action) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.#subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.#subscribers.delete(callback);
    };
  }

  /**
   * Register a validator for a specific path
   * @param {string} path - Path to validate (e.g., 'totalScore')
   * @param {Function} validator - Validator function (value) => true | string (error message)
   */
  registerValidator(path, validator) {
    if (typeof validator !== 'function') {
      throw new Error('Validator must be a function');
    }

    this.#validators.set(path, validator);
  }

  /**
   * Get state history
   * @returns {Array} History entries
   */
  getHistory() {
    return [...this.#history];
  }

  /**
   * Clear state history
   */
  clearHistory() {
    this.#history = [];
  }

  /**
   * Restore state to the snapshot at the given history index.
   * Replaces current state with that snapshot and pushes a new history entry;
   * this is not undo/redo — the history list is not rewound or altered.
   * @param {number} index - History index (0 = oldest, length-1 = most recent)
   */
  restoreFromHistory(index) {
    if (index < 0 || index >= this.#history.length) {
      throw new Error(`Invalid history index: ${index}`);
    }

    const entry = this.#history[index];
    this.setState(entry.state, `restore:${entry.action}`);
  }

  /**
   * Validate state using registered validators
   */
  #validate(nextState, prevState) {
    for (const [path, validator] of this.#validators.entries()) {
      const value = this.#getValueAtPath(nextState, path);
      const result = validator(value, nextState, prevState);

      if (result !== true) {
        const errorMessage = typeof result === 'string' ? result : `Validation failed for ${path}`;
        logger.error(`StateManager validation error:`, errorMessage);
        throw new Error(errorMessage);
      }
    }
  }

  /**
   * Get value at path (supports nested paths like 'a.b.c')
   */
  #getValueAtPath(obj, path) {
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }
    return value;
  }

  /**
   * Add entry to history
   */
  #addToHistory(prevState, nextState, action) {
    this.#history.push({
      state: nextState,
      prevState,
      action,
      timestamp: Date.now(),
    });

    // Limit history size
    if (this.#history.length > this.#maxHistorySize) {
      this.#history.shift();
    }
  }

  /**
   * Notify all subscribers
   */
  #notifySubscribers(nextState, prevState, action) {
    this.#subscribers.forEach((callback) => {
      try {
        callback(nextState, prevState, action);
      } catch (error) {
        logger.error('StateManager: Error in subscriber:', error);
      }
    });
  }
}

// Note: stateManager instance will be created in main.js after createGameState is available
