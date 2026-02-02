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
import { t } from '../i18n.js';
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
      eventBus.subscribe('timer:grace-start', (/** @type {{ graceMs?: number } | undefined } */ payload) => {
        this.#onGraceStart(payload);
      })
    );

    this.#unsubscribers.push(
      eventBus.subscribe('timer:grace-end', () => {
        this.#onGraceEnd();
      })
    );

    this.#unsubscribers.push(
      eventBus.subscribe('timer:started', (/** @type {{ timerMs?: number } | undefined } */ payload) => {
        this.#onTimerStarted(payload);
      })
    );

    this.#unsubscribers.push(
      eventBus.subscribe('timer:danger', () => {
        this.#onTimerDanger();
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
   * Grace period started - show "Get Ready" overlay
   * @private
   * @param {{ graceMs?: number } | undefined} payload - Grace period duration
   */
  #onGraceStart(payload) {
    const timerBar = document.getElementById("timer-bar");
    if (timerBar) {
      timerBar.classList.add('timer-grace');
    }

    // Show "Get Ready" overlay
    const overlay = document.createElement('div');
    overlay.id = 'grace-overlay';
    overlay.className = 'fixed inset-0 flex items-center justify-center';
    overlay.style.zIndex = 'var(--z-base)';
    overlay.style.pointerEvents = 'none';
    overlay.innerHTML = `
      <div class="text-4xl font-black text-yellow-400 animate-pulse">
        ${t('getReady')}
      </div>
    `;
    document.body.appendChild(overlay);
  }

  /**
   * Grace period ended - remove overlay and prepare for timer
   * @private
   */
  #onGraceEnd() {
    const timerBar = document.getElementById("timer-bar");
    if (timerBar) {
      timerBar.classList.remove('timer-grace');
    }

    const overlay = document.getElementById('grace-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  /**
   * Timer started - update progress bar (duration from runtime config via event payload)
   * @private
   * @param {{ timerMs?: number } | undefined} payload - From timer:started; timerMs from state.runtimeConfig
   */
  #onTimerStarted(payload) {
    const timerProgress = document.getElementById("timer-progress");
    if (!timerProgress) return;

    const timerMs = payload?.timerMs ?? GAME.TIMER_MS;
    timerProgress.style.transition = `width ${timerMs}ms linear`;
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
