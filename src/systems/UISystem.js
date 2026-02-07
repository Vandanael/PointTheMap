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
import { GAME, TIMING } from '@lib/config';
import { formatScore } from '../utils/format.js';
import { animateValue } from './AnimationController.js';
import { logger } from '../utils/logger.js';

export class UISystem {
  /** @type {import('./AnimationController.js').AnimationController | null} */
  #scoreAnimationController = null;
  /** @type {Array<() => void>} */
  #unsubscribers = [];

  constructor() {
    this.#setupEventListeners();
  }

  /**
   * Setup all EventBus subscriptions
   */
  #setupEventListeners() {
    // Timer UI events
    this.#unsubscribers.push(
      eventBus.subscribe(
        'timer:started',
        (/** @type {{ timerMs?: number } | undefined } */ payload) => {
          this.#onTimerStarted(payload);
        }
      )
    );

    this.#unsubscribers.push(
      eventBus.subscribe('timer:danger', () => {
        this.#onTimerDanger();
      })
    );

    // Score update events
    this.#unsubscribers.push(
      eventBus.subscribe(
        'score:updated',
        (/** @type {{ oldScore: number, newScore: number }} */ payload) => {
          this.#animateScore(payload.oldScore, payload.newScore);
        }
      )
    );

    logger.debug('UISystem: Event listeners setup complete');
  }

  /**
   * Timer started - update progress bar (duration from runtime config via event payload)
   * @param {{ timerMs?: number } | undefined} payload - From timer:started; timerMs from state.runtimeConfig
   */
  #onTimerStarted(payload) {
    const timerProgress = document.getElementById('timer-progress');
    if (!timerProgress) return;

    const timerMs = payload?.timerMs ?? GAME.TIMER_MS;
    timerProgress.style.transition = `width ${timerMs}ms linear`;
    timerProgress.style.width = '0%';
  }

  /**
   * Timer entered danger zone - visual warning
   */
  #onTimerDanger() {
    const progress = document.getElementById('timer-progress');
    if (progress) {
      progress.classList.add('timer-danger');
    }
  }

  /**
   * Animate score count-up
   * @param {number} oldScore - Previous score
   * @param {number} newScore - New score
   */
  #animateScore(oldScore, newScore) {
    // Stop any existing animation
    if (this.#scoreAnimationController) {
      this.#scoreAnimationController.stop();
    }

    const scoreEl = /** @type {HTMLElement | null} */ (
      document.querySelector('#game-header .text-yellow-400')
    );
    if (!scoreEl) return; // No element to animate

    scoreEl.classList.remove('score-burst');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('score-burst');

    // Use AnimationController for proper cleanup
    this.#scoreAnimationController = animateValue(
      scoreEl,
      oldScore,
      newScore,
      TIMING.SCORE_ANIMATION_MS,
      formatScore
    );

    setTimeout(() => {
      scoreEl.classList.remove('score-burst');
    }, 450);
  }

  /**
   * Initialize UI system
   */
  init() {
    logger.info('UISystem initialized');
  }

  /**
   * Cleanup - unsubscribe from all events
   */
  destroy() {
    this.#unsubscribers.forEach((unsub) => unsub());
    this.#unsubscribers = [];

    if (this.#scoreAnimationController) {
      this.#scoreAnimationController.stop();
      this.#scoreAnimationController = null;
    }

    logger.info('UISystem destroyed');
  }
}

/** @type {UISystem | null} */
let uiSystemInstance = null;

/**
 * Get singleton UISystem instance (lazy).
 * @returns {UISystem}
 */
export const getUISystem = () => {
  if (!uiSystemInstance) uiSystemInstance = new UISystem();
  return uiSystemInstance;
};
