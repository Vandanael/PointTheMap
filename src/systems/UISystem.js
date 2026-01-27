/**
 * UISystem - Centralized UI management system
 *
 * Responsibilities:
 * - Subscribe to EventBus events
 * - Manage UI state and updates
 * - Handle animations (score, timer)
 * - Coordinate UI components
 *
 * Sprint 3 - UI & Components Cleanup
 */

import { eventBus } from '../core/EventBus.js';
import { UI } from '../ui/UI.js';
import { GAME, TIMING } from '../config.js';
import { formatScore } from '../utils.js';
import { animateValue } from './AnimationController.js';
import { logger } from '../utils/logger.js';

export class UISystem {
  #scoreAnimationController = null;
  #unsubscribers = [];

  constructor() {
    this.#setupEventListeners();
  }

  /**
   * Setup all EventBus subscriptions
   * @private
   */
  #setupEventListeners() {
    // Timer UI events
    this.#unsubscribers.push(
      eventBus.subscribe('timer:started', () => {
        this.#onTimerStarted();
      })
    );

    this.#unsubscribers.push(
      eventBus.subscribe('timer:danger', () => {
        this.#onTimerDanger();
      })
    );

    this.#unsubscribers.push(
      eventBus.subscribe('timer:tick', ({ timestamp }) => {
        this.#onTimerTick(timestamp);
      })
    );

    this.#unsubscribers.push(
      eventBus.subscribe('timer:timeout', () => {
        this.#onTimerTimeout();
      })
    );

    // Score update events
    this.#unsubscribers.push(
      eventBus.subscribe('score:updated', ({ oldScore, newScore }) => {
        this.#animateScore(oldScore, newScore);
      })
    );

    logger.debug('UISystem: Event listeners setup complete');
  }

  /**
   * Timer started - update progress bar
   * @private
   */
  #onTimerStarted() {
    const timerProgress = document.getElementById("timer-progress");
    if (!timerProgress) return;

    timerProgress.style.transition = `width ${GAME.TIMER_MS}ms linear`;
    timerProgress.style.width = "0%";
  }

  /**
   * Timer entered danger zone - visual warning
   * @private
   */
  #onTimerDanger() {
    const progress = document.getElementById("timer-progress");
    if (progress) {
      progress.classList.add("timer-danger");
    }
  }

  /**
   * Timer tick - update UI
   * @private
   */
  #onTimerTick(timestamp) {
    // Could be used for countdown display if needed
    // Currently handled by CSS transition
  }

  /**
   * Timer timeout - handle timeout state
   * @private
   */
  #onTimerTimeout() {
    // Timeout handling is done in main.js game logic
    // UI just reacts to the visual state
  }

  /**
   * Animate score count-up
   * @param {number} oldScore - Previous score
   * @param {number} newScore - New score
   * @private
   */
  #animateScore(oldScore, newScore) {
    // Stop any existing animation
    if (this.#scoreAnimationController) {
      this.#scoreAnimationController.stop();
    }

    const scoreEl = document.querySelector("#game-header .text-yellow-400");
    if (!scoreEl) return; // No element to animate

    // Use AnimationController for proper cleanup
    this.#scoreAnimationController = animateValue(
      scoreEl,
      oldScore,
      newScore,
      TIMING.SCORE_ANIMATION_MS,
      formatScore
    );
  }

  /**
   * Initialize UI system
   */
  init() {
    UI.init();
    logger.info('UISystem initialized');
  }

  /**
   * Cleanup - unsubscribe from all events
   */
  destroy() {
    this.#unsubscribers.forEach(unsub => unsub());
    this.#unsubscribers = [];

    if (this.#scoreAnimationController) {
      this.#scoreAnimationController.stop();
      this.#scoreAnimationController = null;
    }

    // Also cleanup UI subscriptions
    UI.destroy();

    logger.info('UISystem destroyed');
  }
}

// Export singleton instance
export const uiSystem = new UISystem();
