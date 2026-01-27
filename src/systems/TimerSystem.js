/**
 * TimerSystem - Centralized timer management to prevent memory leaks
 *
 * Fixes CRITIQUE #1 from technical audit:
 * - Tracks ALL timeouts and intervals
 * - Ensures proper cleanup on stop()
 * - No orphaned callbacks
 * - Uses EventBus for decoupled communication
 */

import { GAME } from '../config.js';
import { eventBus } from '../core/EventBus.js';

/**
 * @typedef {Object} TimerCallbacks
 * @property {() => void} [onStart] - Called when timer starts (after grace period)
 * @property {() => void} [onDangerZone] - Called when entering danger zone
 * @property {() => void} [onTimeout] - Called when timer expires
 * @property {(remaining: number) => void} [onTick] - Called on each tick (every 50ms)
 */

export class TimerSystem {
  #timeouts = [];
  #intervals = [];
  #isRunning = false;

  /**
   * Check if timer is currently running
   * @returns {boolean}
   */
  get isRunning() {
    return this.#isRunning;
  }

  /**
   * Start the game timer
   * Emits events: timer:started, timer:danger, timer:timeout, timer:tick
   */
  start() {
    // Stop any existing timer first
    this.stop();

    this.#isRunning = true;

    // Grace period timeout (before timer UI starts)
    const gracePeriodTimeout = setTimeout(() => {
      if (!this.#isRunning) return;

      // Emit timer started event
      eventBus.emit('timer:started');

      // Danger zone timeout (visual warning)
      const dangerZoneTimeout = setTimeout(() => {
        if (!this.#isRunning) return;
        eventBus.emit('timer:danger');
      }, GAME.TIMER_MS - GAME.DANGER_ZONE_MS);

      this.#timeouts.push(dangerZoneTimeout);

      // Main timeout (game over)
      const mainTimeout = setTimeout(() => {
        if (!this.#isRunning) return;
        eventBus.emit('timer:timeout');
        this.stop();
      }, GAME.TIMER_MS);

      this.#timeouts.push(mainTimeout);

      // Tick interval (for updates)
      const tickInterval = setInterval(() => {
        if (!this.#isRunning) {
          clearInterval(tickInterval);
          return;
        }
        eventBus.emit('timer:tick', { timestamp: Date.now() });
      }, 50);

      this.#intervals.push(tickInterval);
    }, GAME.GRACE_PERIOD_MS);

    this.#timeouts.push(gracePeriodTimeout);
  }

  /**
   * Stop and cleanup all timers
   * CRITICAL: Clears ALL tracked timeouts and intervals
   */
  stop() {
    this.#isRunning = false;

    // Clear all timeouts
    this.#timeouts.forEach(timeout => clearTimeout(timeout));
    this.#timeouts = [];

    // Clear all intervals
    this.#intervals.forEach(interval => clearInterval(interval));
    this.#intervals = [];
  }

  /**
   * Reset the system (alias for stop)
   */
  reset() {
    this.stop();
  }
}

// Export singleton instance
export const timerSystem = new TimerSystem();
