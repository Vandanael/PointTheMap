/**
 * AnimationController - Manages requestAnimationFrame with proper cleanup
 *
 * Fixes MOYEN #6 from technical audit:
 * - Ensures all animation frames are canceled properly
 * - Prevents orphaned frames running at 60fps
 * - No memory/CPU leaks from animations
 */

export class AnimationController {
  #frameId = null;
  #isRunning = false;

  /**
   * Check if animation is currently running
   * @returns {boolean}
   */
  get isRunning() {
    return this.#isRunning;
  }

  /**
   * Start an animation with automatic cleanup
   * @param {(currentTime: number) => boolean} callback - Animation callback. Return false to stop.
   */
  start(callback) {
    // Stop any existing animation
    this.stop();

    this.#isRunning = true;

    const animate = (currentTime) => {
      if (!this.#isRunning) return;

      // Call callback and check if we should continue
      const shouldContinue = callback(currentTime);

      if (shouldContinue) {
        this.#frameId = requestAnimationFrame(animate);
      } else {
        this.stop();
      }
    };

    this.#frameId = requestAnimationFrame(animate);
  }

  /**
   * Stop the animation and cleanup
   * CRITICAL: Always cancels the animation frame
   */
  stop() {
    if (this.#frameId !== null) {
      cancelAnimationFrame(this.#frameId);
      this.#frameId = null;
    }
    this.#isRunning = false;
  }

  /**
   * Reset (alias for stop)
   */
  reset() {
    this.stop();
  }
}

/**
 * Animate a score count-up effect
 * @param {HTMLElement} element - Element to update
 * @param {number} startValue - Starting value
 * @param {number} endValue - Target value
 * @param {number} duration - Animation duration in ms
 * @param {(value: number) => string} formatter - Format function
 * @returns {AnimationController} Controller instance
 */
export function animateValue(
  element,
  startValue,
  endValue,
  duration,
  formatter = (v) => String(v)
) {
  const controller = new AnimationController();
  const startTime = performance.now();
  const delta = endValue - startValue;

  controller.start((currentTime) => {
    // Check if element still exists
    if (!element || !element.isConnected) {
      return false; // Stop animation
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const currentValue = Math.floor(startValue + delta * progress);

    element.textContent = formatter(currentValue);

    if (progress >= 1) {
      element.textContent = formatter(endValue); // Ensure final value
      return false; // Stop animation
    }

    return true; // Continue animation
  });

  return controller;
}
