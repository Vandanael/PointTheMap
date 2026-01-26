/**
 * TimerSystem - Centralized timer management to prevent memory leaks
 *
 * Fixes CRITIQUE #1 from technical audit:
 * - Tracks ALL timeouts and intervals
 * - Ensures proper cleanup on stop()
 * - No orphaned callbacks
 */

import { GAME } from '../config.js';

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
   * Start the game timer with callbacks
   * @param {TimerCallbacks} callbacks - Event callbacks
   */
  start(callbacks = {}) {
    // Stop any existing timer first
    this.stop();

    this.#isRunning = true;
    const { onStart, onDangerZone, onTimeout, onTick } = callbacks;

    // Grace period timeout (before timer UI starts)
    const gracePeriodTimeout = setTimeout(() => {
      if (!this.#isRunning) return;

      // Notify timer has started
      onStart?.();

      // Danger zone timeout (visual warning)
      if (onDangerZone) {
        const dangerZoneTimeout = setTimeout(() => {
          if (!this.#isRunning) return;
          onDangerZone();
        }, GAME.TIMER_MS - GAME.DANGER_ZONE_MS);

        this.#timeouts.push(dangerZoneTimeout);
      }

      // Main timeout (game over)
      if (onTimeout) {
        const mainTimeout = setTimeout(() => {
          if (!this.#isRunning) return;
          onTimeout();
          this.stop();
        }, GAME.TIMER_MS);

        this.#timeouts.push(mainTimeout);
      }

      // Tick interval (for UI updates)
      if (onTick) {
        const tickInterval = setInterval(() => {
          if (!this.#isRunning) {
            clearInterval(tickInterval);
            return;
          }
          onTick(Date.now());
        }, 50);

        this.#intervals.push(tickInterval);
      }
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
