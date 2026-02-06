// Point The Map - UI Controller
// Clean, minimal UI controller using components

import { domCache as _domCache, render, remove } from './dom.js';
import { eventBus } from '../core/EventBus.js';
import { LoadingSpinner } from './components.js';
import { createStartScreen, loadLeaderboard as _loadLeaderboard } from './screens/StartScreen.js';
import { createGameScreen } from './screens/GameScreen.js';
import { createResultScreen } from './screens/ResultScreen.js';

/** @type {{ handleStartGame: (gameMode: string) => void; handleNextRound: () => void; handleSubmit: (pseudo: string) => void; handleReplay: () => void } | null} */
let _inputSystem = null;
/** @type {{ validatePseudo: (pseudo: string) => { valid: boolean } } | null} */
let _validationSystem = null;
/** @type {{ isInitialized: () => boolean; init: (mapId: string) => Promise<void>; loadCountriesGeoJSON: () => Promise<boolean>; loadCivilizationsGeoJSON: () => Promise<boolean> } | null} */
let _mapSystem = null;

/**
 * Configure UI dependencies (injected by main).
 * @param {{ inputSystem?: { handleStartGame: (gameMode: string) => void; handleNextRound: () => void; handleSubmit: (pseudo: string) => void; handleReplay: () => void }; validationSystem?: { validatePseudo: (pseudo: string) => { valid: boolean } }; mapSystem?: { isInitialized: () => boolean; init: (mapId: string) => Promise<void>; loadCountriesGeoJSON: () => Promise<boolean>; loadCivilizationsGeoJSON: () => Promise<boolean> } }} deps
 */
export const configureUI = (deps = {}) => {
  if (deps.inputSystem) _inputSystem = deps.inputSystem;
  if (deps.validationSystem) _validationSystem = deps.validationSystem;
  if (deps.mapSystem) _mapSystem = deps.mapSystem;
};

// Store UI.init() subscriptions for cleanup
/** @type {Array<() => void>} */
let _uiInitUnsubscribers = [];
// Export for testing
export const _domCacheForTesting = _domCache;

const showLoader = () => {
  if (document.getElementById('loading-progress')) return;
  if (document.getElementById('loading-spinner')) return;
  const spinner = render(LoadingSpinner());
  if (spinner) {
    void (/** @type {HTMLElement} */ (spinner).offsetHeight);
    _domCache._cache['loading-spinner'] = /** @type {HTMLElement} */ (spinner);
    _domCache._cache['loading-progress'] = document.getElementById('loading-progress');
  }
};

const hideLoader = () => {
  remove('loading-spinner');
};

/** @param {number} percent */
const updateLoader = (percent) => {
  const p = _domCache.get('loading-progress');
  if (p) p.style.transform = `scaleX(${Math.min(100, percent) / 100})`;
};

const resultScreen = createResultScreen({
  getInputSystem: () => _inputSystem,
  getValidationSystem: () => _validationSystem,
});
const startScreen = createStartScreen({
  getInputSystem: () => _inputSystem,
  getMapSystem: () => _mapSystem,
  showLoader,
  hideLoader,
  updateLoader,
  showToast: (message, type, duration, options) =>
    resultScreen.showToast(message, type, duration, options),
  onRetryLeaderboard: (type) => UI.showLeaderboardModal([], type, true),
});
const gameScreen = createGameScreen({
  getInputSystem: () => _inputSystem,
});

export const loadLeaderboard = _loadLeaderboard;

export const UI = {
  init() {
    // Subscribe to error events
    _uiInitUnsubscribers.push(
      eventBus.subscribe('error:show', (/** @type {{ message: string }} */ { message }) => {
        UI.showError(message);
      })
    );

    // Timer UI (timer:started, timer:danger) is handled by UISystem only to avoid duplicate subscriptions.

    // Subscribe to storage quota events
    _uiInitUnsubscribers.push(
      eventBus.subscribe(
        'storage:quota-exceeded',
        (/** @type {{ message: string }} */ { message }) => {
          UI.showToast(message, 'warning', 4000);
        }
      )
    );

    _uiInitUnsubscribers.push(
      eventBus.subscribe(
        'storage:quota-recovered',
        (/** @type {{ message: string }} */ { message }) => {
          UI.showToast(message, 'success', 3000);
        }
      )
    );

    _uiInitUnsubscribers.push(
      eventBus.subscribe(
        'storage:quota-failed',
        (/** @type {{ message: string }} */ { message }) => {
          UI.showToast(message, 'error', 6000);
        }
      )
    );
  },

  /**
   * Cleanup UI subscriptions
   */
  destroy() {
    _uiInitUnsubscribers.forEach((unsub) => unsub());
    _uiInitUnsubscribers = [];
    startScreen.destroy();
    gameScreen.destroy();
    resultScreen.destroy();
    _domCache.invalidate();
  },

  // Loader
  showLoader,
  hideLoader,
  updateLoader,

  // Start screen
  showStart: startScreen.showStart,
  hideStart: startScreen.hideStart,

  /**
   * Show leaderboard modal with lazy loading
   * @param {Array<any>} initialScores - Initial scores (empty for lazy load)
   * @param {string} type - Leaderboard type
   * @param {boolean} lazyLoad - If true, show skeleton and load data
   */
  showLeaderboardModal: startScreen.showLeaderboardModal,
  showStatsModal: startScreen.showStatsModal,

  // Game UI
  /**
   * @param {number} roundNum
   * @param {number} totalRounds
   * @param {number} totalScore
   */
  showGameUI(roundNum, totalRounds, totalScore) {
    gameScreen.showGameUI(roundNum, totalRounds, totalScore);
  },
  /**
   * @param {number} roundNum
   * @param {number} totalRounds
   * @param {number} totalScore
   */
  updateGameUI(roundNum, totalRounds, totalScore) {
    gameScreen.updateGameUI(roundNum, totalRounds, totalScore);
  },
  hideGameUI() {
    gameScreen.hideGameUI();
  },

  /**
   * Hide question modal
   */
  hideQuestion() {
    gameScreen.hideQuestion();
  },

  /**
   * Show question modal
   * @param {string} capitalName - Capital name
   * @param {string} country - Country name
   * @param {() => void} onClose - Callback when modal closes
   * @param {{ requireButton?: boolean }} [options] - Options
   */
  showQuestion(capitalName, country, onClose, { requireButton = false } = {}) {
    gameScreen.showQuestion(capitalName, country, onClose, { requireButton });
  },

  resetTimer() {
    gameScreen.resetTimer();
  },

  // Round result
  /**
   * @param {number | null} distance - Distance in km, or null on timeout with no click
   * @param {number} score
   * @param {boolean} isTimeout
   * @param {boolean} isLast
   * @param {number} baseScore
   * @param {number} timeBonus
   */
  showRoundResult(distance, score, isTimeout, isLast, baseScore, timeBonus) {
    gameScreen.showRoundResult(distance, score, isTimeout, isLast, baseScore, timeBonus);
  },
  hideRoundResult() {
    gameScreen.hideRoundResult();
  },

  // Game over / submit
  /** @param {number} totalScore */
  showGameOver(totalScore) {
    resultScreen.showGameOver(totalScore);
  },

  /**
   * @param {number} totalScore
   * @param {string} pseudo
   * @param {{ rank: number, isTopFifty: boolean }} result
   * @param {boolean} [isNewSessionBest]
   */
  showFinalResults(totalScore, pseudo, result, isNewSessionBest = false) {
    resultScreen.showFinalResults(totalScore, pseudo, result, isNewSessionBest);
  },

  hideGameOver() {
    resultScreen.hideGameOver();
  },

  /** @param {string} message */
  showError(message) {
    resultScreen.showError(message);
  },

  /**
   * @param {string} pseudo
   * @param {() => void} onConfirm
   */
  showPseudoLockedDialog(pseudo, onConfirm) {
    resultScreen.showPseudoLockedDialog(pseudo, onConfirm);
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {"info" | "warning" | "error" | "success"} type - Type: 'info', 'warning', 'error', 'success'
   * @param {number} duration - Duration in ms (default: 5000, 0 = no auto-close)
   * @param {{ compact?: boolean, center?: boolean }} [options] - compact: smaller, no emoji, text only; center: center text horizontally
   * @returns {string} Toast ID
   */
  showToast(message, type = 'info', duration = 5000, options = {}) {
    return resultScreen.showToast(message, type, duration, options);
  },

  /**
   * Close a toast notification
   * @param {string} toastId - Toast ID to close
   */
  closeToast(toastId) {
    resultScreen.closeToast(toastId);
  },
};
