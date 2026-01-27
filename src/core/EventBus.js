/**
 * EventBus - Decoupled event communication system
 *
 * Features:
 * - Wildcard support: "timer:*" matches all timer events
 * - Error isolation: One handler error doesn't break others
 * - Memory leak prevention: WeakMap tracking
 * - Re-entrance protection
 *
 * Event naming convention: <domain>:<action>[:<detail>]
 * Examples: theme:changed, timer:started, game:round:completed
 */

import { logger } from '../utils/logger.js';

class EventBus {
  constructor() {
    this._listeners = new Map();
    this._onceListeners = new WeakMap();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name (supports wildcards like "timer:*")
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, handler) {
    if (typeof event !== 'string' || !event) {
      throw new Error('Event name must be a non-empty string');
    }
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);

    // Return unsubscribe function
    return () => this.unsubscribe(event, handler);
  }

  /**
   * Subscribe to an event and auto-unsubscribe after first call
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  once(event, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    const wrappedHandler = (data) => {
      this.unsubscribe(event, wrappedHandler);
      handler(data);
    };

    // Track original handler for manual unsubscribe
    this._onceListeners.set(wrappedHandler, handler);

    return this.subscribe(event, wrappedHandler);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} handler - Event handler to remove
   */
  unsubscribe(event, handler) {
    const listeners = this._listeners.get(event);
    if (!listeners) return;

    // Check if handler is a once wrapper
    for (const listener of listeners) {
      if (this._onceListeners.get(listener) === handler) {
        listeners.delete(listener);
        return;
      }
    }

    listeners.delete(handler);

    // Cleanup empty listener sets
    if (listeners.size === 0) {
      this._listeners.delete(event);
    }
  }

  /**
   * Emit an event with optional data
   * @param {string} event - Event name
   * @param {*} data - Event payload
   */
  emit(event, data) {
    if (typeof event !== 'string' || !event) {
      throw new Error('Event name must be a non-empty string');
    }

    const handlers = new Set();

    // Collect exact matches
    const exactListeners = this._listeners.get(event);
    if (exactListeners) {
      exactListeners.forEach(h => handlers.add(h));
    }

    // Collect wildcard matches (e.g., "timer:*" matches "timer:started")
    for (const [listenerEvent, listeners] of this._listeners.entries()) {
      if (listenerEvent.includes('*')) {
        const pattern = listenerEvent.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(event)) {
          listeners.forEach(h => handlers.add(h));
        }
      }
    }

    // Execute handlers with error isolation
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error(`EventBus: Error in handler for "${event}":`, error);
        // Continue executing other handlers
      }
    });
  }

  /**
   * Clear all event listeners
   */
  clear() {
    this._listeners.clear();
  }

  /**
   * Get the number of listeners for an event
   * @param {string} event - Event name
   * @returns {number} Number of listeners
   */
  listenerCount(event) {
    const listeners = this._listeners.get(event);
    return listeners ? listeners.size : 0;
  }
}

// Export singleton instance
export const eventBus = new EventBus();

// Export class for testing
export { EventBus };
