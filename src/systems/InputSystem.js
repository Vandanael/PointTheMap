/**
 * InputSystem - Centralizes input handling
 *
 * Responsibilities:
 * - Handle map clicks
 * - Handle button clicks
 * - Handle keyboard input
 * - Emit input events via EventBus
 */

import { MODE_IDS } from '@lib/config/game-modes.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/eventTypes.js';

const MAP_CLICK_ARM_DELAY_MS = 300;

export class InputSystem {
  #initialized = false;
  #mapClickEnabled = false;
  /** @type {Function | null} */
  #mapClickCallback = null;
  /** @type {(() => void) | null} */
  #mapClickUnsubscribe = null;
  /** @type {((e: KeyboardEvent) => void) | null} */
  #keyboardHandler = null;
  #mapClickEnabledAt = 0;

  constructor() {}

  /**
   * Initialize the input system
   */
  init() {
    if (this.#initialized) {
      return;
    }

    this.#setupKeyboardListeners();
    this.#initialized = true;
  }

  /**
   * Setup keyboard event listeners
   */
  #setupKeyboardListeners() {
    // Enter and Space can be used to trigger actions
    this.#keyboardHandler = /** @type {(e: KeyboardEvent) => void} */ (
      (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          // Check if focus is on a button or input
          const activeElement = document.activeElement;
          if (activeElement && activeElement.tagName === 'BUTTON') {
            // Let the button handle it naturally
            return;
          }

          // Otherwise, emit a generic action event
          eventBus.emit(EVENTS.INPUT_ACTION, { key: e.key });
        }

        // Escape key
        if (e.key === 'Escape') {
          eventBus.emit(EVENTS.INPUT_ESCAPE, {});
        }
      }
    );
    document.addEventListener('keydown', this.#keyboardHandler);
  }

  /**
   * Enable map click input
   * @param {Function} callback - Callback receiving [lat, lng]
   */
  enableMapInput(callback) {
    // Cleanup previous subscription if exists
    if (this.#mapClickUnsubscribe) {
      this.#mapClickUnsubscribe();
      this.#mapClickUnsubscribe = null;
    }

    this.#mapClickEnabled = true;
    this.#mapClickCallback = callback;
    this.#mapClickEnabledAt = Date.now();

    // Subscribe to map:click events
    this.#mapClickUnsubscribe = eventBus.subscribe(
      EVENTS.MAP_CLICK,
      (/** @type {{ lat: any, lng: any }} */ { lat, lng }) => {
        if (!this.#mapClickEnabled || !this.#mapClickCallback) return;
        if (Date.now() - this.#mapClickEnabledAt < MAP_CLICK_ARM_DELAY_MS) return;
        this.#mapClickCallback([lat, lng]);
      }
    );

    eventBus.emit(EVENTS.INPUT_MAP_ENABLED, {});
  }

  /**
   * Disable map click input
   */
  disableMapInput() {
    this.#mapClickEnabled = false;
    this.#mapClickCallback = null;

    // Unsubscribe from map:click events
    if (this.#mapClickUnsubscribe) {
      this.#mapClickUnsubscribe();
      this.#mapClickUnsubscribe = null;
    }

    eventBus.emit(EVENTS.INPUT_MAP_DISABLED, {});
  }

  /**
   * Handle "next round" button click
   * Emits input:next-round event
   */
  handleNextRound() {
    eventBus.emit(EVENTS.INPUT_NEXT_ROUND, {});
  }

  /**
   * Handle "submit" button click
   * Emits input:submit event
   * @param {string} pseudo - Player pseudo
   */
  handleSubmit(pseudo) {
    eventBus.emit(EVENTS.INPUT_SUBMIT, { pseudo });
  }

  /**
   * Handle "replay" button click
   * Emits input:replay event
   */
  handleReplay() {
    eventBus.emit(EVENTS.INPUT_REPLAY, {});
  }

  /**
   * Handle "start game" button click
   * Emits input:start-game event
   * @param {string} gameType - Game type (classic/daily)
   */
  handleStartGame(gameType = MODE_IDS.CLASSIC) {
    eventBus.emit(EVENTS.INPUT_START_GAME, { gameType });
  }

  /**
   * Check if system is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * Check if map input is enabled
   * @returns {boolean}
   */
  isMapInputEnabled() {
    return this.#mapClickEnabled;
  }

  /**
   * Destroy the input system
   */
  destroy() {
    this.disableMapInput();
    if (this.#keyboardHandler) {
      document.removeEventListener('keydown', this.#keyboardHandler);
      this.#keyboardHandler = null;
    }
    this.#initialized = false;
  }
}

// Singleton instance
/** @type {InputSystem | null} */
let _inputSystemInstance = null;

/**
 * Get the singleton instance of InputSystem
 * @returns {InputSystem}
 */
export function getInputSystem() {
  if (!_inputSystemInstance) {
    _inputSystemInstance = new InputSystem();
  }
  return _inputSystemInstance;
}

// Export singleton instance
export const inputSystem = getInputSystem();
