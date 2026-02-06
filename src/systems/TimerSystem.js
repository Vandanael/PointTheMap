/**
 * TimerSystem - Centralized timer management to prevent memory leaks
 *
 * Fixes CRITIQUE #1 from technical audit:
 * - Tracks ALL timeouts and intervals
 * - Ensures proper cleanup on stop()
 * - No orphaned callbacks
 * - Uses EventBus for decoupled communication
 */

import { GAME } from '@lib/config';
import { eventBus } from '../core/EventBus.js';

/**
 * @typedef {Object} TimerRuntimeConfig
 * @property {number} timerMs - Round timer duration (ms)
 * @property {number} graceMs - Grace period before timer starts (ms)
 * @property {number} dangerZoneMs - Time before expiry for "danger" visual (ms)
 */

/**
 * @typedef {Object} TimerCallbacks
 * @property {() => void} [onStart] - Called when timer starts (after grace period)
 * @property {() => void} [onDangerZone] - Called when entering danger zone
 * @property {() => void} [onTimeout] - Called when timer expires
 * @property {(remaining: number) => void} [onTick] - Called on each tick (every 50ms)
 */

export class TimerSystem {
  /** @type {Array<ReturnType<typeof setTimeout>>} */
  #timeouts = [];
  /** @type {Array<ReturnType<typeof setInterval>>} */
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
   * Start the game timer with runtime config (from state.runtimeConfig).
   * Emits events: timer:started { timerMs }, timer:danger, timer:timeout, timer:tick
   * @param {TimerRuntimeConfig | null} [config] - From state.runtimeConfig; null = fallback GAME for tests
   */
  start(config = null) {
    // Stop any existing timer first
    this.stop();

    const timerMs = config?.timerMs ?? GAME.TIMER_MS;
    const graceMs = config?.graceMs ?? GAME.GRACE_PERIOD_MS;
    const dangerZoneMs = config?.dangerZoneMs ?? GAME.DANGER_ZONE_MS;

    this.#isRunning = true;

    // Grace period timeout (before timer UI starts)
    const gracePeriodTimeout = setTimeout(() => {
      if (!this.#isRunning) return;

      // Emit timer started event with duration for UI (transition)
      eventBus.emit('timer:started', { timerMs });

      // Danger zone timeout (visual warning)
      const dangerZoneTimeout = setTimeout(() => {
        if (!this.#isRunning) return;
        eventBus.emit('timer:danger', undefined);
      }, timerMs - dangerZoneMs);

      this.#timeouts.push(dangerZoneTimeout);

      // Main timeout (game over)
      const mainTimeout = setTimeout(() => {
        if (!this.#isRunning) return;
        eventBus.emit('timer:timeout', undefined);
        this.stop();
      }, timerMs);

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
    }, graceMs);

    this.#timeouts.push(gracePeriodTimeout);
  }

  /**
   * Stop and cleanup all timers
   * CRITICAL: Clears ALL tracked timeouts and intervals
   */
  stop() {
    this.#isRunning = false;

    // Clear all timeouts
    this.#timeouts.forEach((timeout) => clearTimeout(timeout));
    this.#timeouts = [];

    // Clear all intervals
    this.#intervals.forEach((interval) => clearInterval(interval));
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
