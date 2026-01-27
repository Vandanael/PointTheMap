/**
 * InputSystem - Centralizes input handling
 *
 * Responsibilities:
 * - Handle map clicks
 * - Handle button clicks
 * - Handle keyboard input
 * - Emit input events via EventBus
 */

import { eventBus } from '../core/EventBus.js';

export class InputSystem {
  #initialized = false;
  #mapClickEnabled = false;
  #mapClickCallback = null;

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
   * @private
   */
  #setupKeyboardListeners() {
    // Enter and Space can be used to trigger actions
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        // Check if focus is on a button or input
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'BUTTON') {
          // Let the button handle it naturally
          return;
        }

        // Otherwise, emit a generic action event
        eventBus.emit('input:action', { key: e.key });
      }

      // Escape key
      if (e.key === 'Escape') {
        eventBus.emit('input:escape');
      }
    });
  }

  /**
   * Enable map click input
   * @param {Function} callback - Callback receiving [lat, lng]
   */
  enableMapInput(callback) {
    this.#mapClickEnabled = true;
    this.#mapClickCallback = callback;

    // Subscribe to map:click events
    eventBus.subscribe('map:click', ({ lat, lng }) => {
      if (this.#mapClickEnabled && this.#mapClickCallback) {
        this.#mapClickCallback([lat, lng]);
      }
    });

    eventBus.emit('input:map-enabled');
  }

  /**
   * Disable map click input
   */
  disableMapInput() {
    this.#mapClickEnabled = false;
    this.#mapClickCallback = null;

    eventBus.emit('input:map-disabled');
  }

  /**
   * Handle "next round" button click
   * Emits input:next-round event
   */
  handleNextRound() {
    eventBus.emit('input:next-round');
  }

  /**
   * Handle "submit" button click
   * Emits input:submit event
   * @param {string} pseudo - Player pseudo
   */
  handleSubmit(pseudo) {
    eventBus.emit('input:submit', { pseudo });
  }

  /**
   * Handle "replay" button click
   * Emits input:replay event
   */
  handleReplay() {
    eventBus.emit('input:replay');
  }

  /**
   * Handle "start game" button click
   * Emits input:start-game event
   * @param {string} gameType - Game type (classic/daily)
   */
  handleStartGame(gameType = 'classic') {
    eventBus.emit('input:start-game', { gameType });
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
    this.#initialized = false;
  }
}

// Singleton instance
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
