// Point The Map - UI Controller
// Clean, minimal UI controller using components

import { api } from "../services/api.js";
import { getLastPseudo, getTheme, setTheme } from "../services/storage.js";
import { toggleLang, t } from "../i18n.js";
import { logger } from "../utils/logger.js";
import { eventBus } from "../core/EventBus.js";
import { GAME } from "../config.js";
import { UI_TIMING } from "../config/visual-constants.js";
import { debounce } from "../utils/performance.js";
import { inputSystem } from "../systems/InputSystem.js";
import { safeAsync } from "../core/ErrorHandler.js";
import { validationSystem } from "../systems/ValidationSystem.js";
import {
  Modal,
  TimerBar,
  GameHeader,
  QuestionModal,
  QuestionModalWithButton,
  RoundResult,
  StartScreen,
  GameOverScreen,
  FinalResults,
  Leaderboard,
  LeaderboardModal,
  LoadingSpinner,
  PseudoLockedDialog,
  Toast,
  MyStatsModal,
  AchievementUnlockModal,
} from "./components.js";
import { getStats } from "../features/StatsManager.js";
import { shareGameResults } from "../features/Share.js";

// Rate limiting for submit button
const MIN_SUBMIT_INTERVAL = 2000; // 2 seconds between submissions
let lastSubmitTime = 0;

// Store UI.init() subscriptions for cleanup
let _uiInitUnsubscribers = [];

// Store dynamic event listeners for cleanup
let _questionModalClickHandler = null;
let _pseudoInputHandler = null;
let _pseudoKeypressHandler = null;
let _pseudoFocusHandler = null;

// Store click handlers to allow removal before adding new ones
const _clickHandlers = new Map();

// DOM cache to avoid repeated queries
const _domCache = {
  _cache: {},
  get(id) {
    if (!this._cache[id] || !document.body.contains(this._cache[id])) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  },
  invalidate(id) {
    if (id) {
      delete this._cache[id];
    } else {
      this._cache = {};
    }
  }
};

const app = () => {
  const el = _domCache.get("app");
  if (!el) {
    logger.error("Element #app introuvable");
    return document.body; // Fallback
  }
  return el;
};

const render = (html, container = app()) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const el = div.firstElementChild;
  container.appendChild(el);
  return el;
};

const remove = (id) => {
  const el = document.getElementById(id) || _domCache.get(id);
  if (el) {
    el.remove();
  }
  _domCache.invalidate(id);
  // Also remove click handler when element is removed
  _clickHandlers.delete(id);
};

const bindClick = (id, handler) => {
  // Try cache first, then direct DOM lookup
  let el = _domCache.get(id);
  if (!el) {
    el = document.getElementById(id);
    if (el) {
      // Update cache if found
      _domCache._cache[id] = el;
    }
  }
  
  if (el) {
    // Remove previous handler if it exists
    const previousHandler = _clickHandlers.get(id);
    if (previousHandler) {
      el.removeEventListener("click", previousHandler);
    }
    // Add new handler and store it
    el.addEventListener("click", handler);
    _clickHandlers.set(id, handler);
  } else {
    logger.warn(`bindClick: Element #${id} not found`);
  }
};

const applyTheme = (theme) => {
  if (theme === "light") document.body.classList.add("light-theme");
  else document.body.classList.remove("light-theme");
  const icon = _domCache.get("theme-icon");
  if (icon) icon.textContent = theme === "light" ? "☀️" : "🌙";
};

const toggleTheme = () => {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  applyTheme(next);
  eventBus.emit('theme:changed', { theme: next });
};

const handleToggleLang = () => {
  const newLang = toggleLang();
  const icon = _domCache.get("lang-icon");
  if (icon) icon.textContent = newLang.toUpperCase();
  eventBus.emit('language:changed', { language: newLang });
};

const LEADERBOARD_TIMEOUT_MS = 5000; // 5 seconds timeout

export const loadLeaderboard = async (type) => {
  const scores = await safeAsync(
    () => Promise.race([
      api.getLeaderboard(type),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), LEADERBOARD_TIMEOUT_MS)
      )
    ]),
    'leaderboard:load',
    []
  );
  return scores;
};

const setupLeaderboardTabs = () => {
  bindClick("btn-leaderboard-classic", async () => {
    UI.showLeaderboardModal([], "classic", true);
  });

  bindClick("btn-leaderboard-daily", async () => {
    UI.showLeaderboardModal([], "daily", true);
  });
};

// Export for testing
export const _domCacheForTesting = _domCache;

export const UI = {
  _langChangeCleanup: null,

  init() {
    applyTheme(getTheme());

    // Subscribe to error events
    _uiInitUnsubscribers.push(
      eventBus.subscribe('error:show', ({ message }) => {
        UI.showError(message);
      })
    );

    // Subscribe to timer UI events
    _uiInitUnsubscribers.push(
      eventBus.subscribe('timer:started', () => {
        const timerProgress = _domCache.get("timer-progress");
        if (!timerProgress) return;
        timerProgress.style.transition = `width ${GAME.TIMER_MS}ms linear`;
        timerProgress.style.width = "0%";
      })
    );

    _uiInitUnsubscribers.push(
      eventBus.subscribe('timer:danger', () => {
        const progress = _domCache.get("timer-progress");
        if (progress) progress.classList.add("timer-danger");
      })
    );

    // Subscribe to storage quota events
    _uiInitUnsubscribers.push(
      eventBus.subscribe('storage:quota-exceeded', ({ message }) => {
        UI.showToast(message, 'warning', 4000);
      })
    );

    _uiInitUnsubscribers.push(
      eventBus.subscribe('storage:quota-recovered', ({ message }) => {
        UI.showToast(message, 'success', 3000);
      })
    );

    _uiInitUnsubscribers.push(
      eventBus.subscribe('storage:quota-failed', ({ message }) => {
        UI.showToast(message, 'error', 6000);
      })
    );
  },

  /**
   * Cleanup UI subscriptions
   */
  destroy() {
    _uiInitUnsubscribers.forEach(unsub => unsub());
    _uiInitUnsubscribers = [];

    // Clean up dynamic listeners
    const questionModal = document.getElementById("question-modal");
    if (questionModal && _questionModalClickHandler) {
      questionModal.removeEventListener("click", _questionModalClickHandler);
    }
    const pseudoInput = document.getElementById("pseudo-input");
    if (pseudoInput) {
      if (_pseudoInputHandler) pseudoInput.removeEventListener("input", _pseudoInputHandler);
      if (_pseudoKeypressHandler) pseudoInput.removeEventListener("keypress", _pseudoKeypressHandler);
      if (_pseudoFocusHandler) pseudoInput.removeEventListener("focus", _pseudoFocusHandler);
    }
    _domCache.invalidate();
  },

  // Loader
  showLoader() {
    const existing = document.getElementById("loading-spinner");
    if (existing) return;
    const spinner = render(LoadingSpinner());
    // Force reflow to ensure loader is rendered and visible
    if (spinner) {
      spinner.offsetHeight; // Force reflow
      // Update cache immediately
      _domCache._cache["loading-spinner"] = spinner;
      _domCache._cache["loading-progress"] = document.getElementById("loading-progress");
    }
  },
  hideLoader() {
    remove("loading-spinner");
  },
  updateLoader(percent) {
    const p = _domCache.get("loading-progress");
    if (p) p.style.width = `${Math.min(100, percent)}%`;
  },

  // Start screen
  showStart() {
    // Subscribe to language changes
    const unsubscribe = eventBus.subscribe('language:changed', () => {
      UI.hideStart();
      UI.showStart(); // Re-render with new language
    });
    this._langChangeCleanup = unsubscribe;

    render(StartScreen());
    bindClick("btn-start-classic", () => inputSystem.handleStartGame("classic"));
    bindClick("btn-start-daily", () => inputSystem.handleStartGame("daily"));
    bindClick("btn-theme", toggleTheme);
    bindClick("btn-lang", handleToggleLang);
    bindClick("btn-stats", () => UI.showStatsModal());
    bindClick("btn-leaderboard", () => {
      // Show skeleton immediately, load data in background
      UI.showLeaderboardModal([], "classic", true);
    });
    bindClick("btn-share-game", async () => {
      const shareText = t("shareGameMessage");
      const success = await shareGameResults(shareText);
      UI.showToast(
        success ? t("shareCopied") : t("shareFailed"),
        success ? "success" : "error",
        3000,
        { compact: true }
      );
    });
  },
  hideStart() {
    remove("start-modal");
    _domCache.invalidate(); // Clear cache after DOM change
    this._langChangeCleanup?.(); // Cleanup subscription
  },

  /**
   * Show leaderboard modal with lazy loading
   * @param {Array} initialScores - Initial scores (empty for lazy load)
   * @param {string} type - Leaderboard type
   * @param {boolean} lazyLoad - If true, show skeleton and load data
   */
  async showLeaderboardModal(initialScores = [], type = "classic", lazyLoad = false) {
    remove("leaderboard-modal");

    // Show skeleton immediately if lazy loading
    if (lazyLoad) {
      render(LeaderboardModal([], type, true));
      bindClick("btn-close-leaderboard", () => remove("leaderboard-modal"));

      // Load data in background
      const scores = await loadLeaderboard(type);

      // Update content with real data
      const contentEl = _domCache.get("leaderboard-content");
      if (contentEl) {
        if (scores.length === 0) {
          // Check if it's a timeout or error vs empty results
          contentEl.innerHTML = `
            <div class="text-center py-8">
              <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
              <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
                ${t('error.retry')}
              </button>
            </div>
          `;
          bindClick("btn-retry-leaderboard", () => {
            UI.showLeaderboardModal([], type, true);
          });
        } else {
          contentEl.outerHTML = Leaderboard(scores, null, false);
        }
        _domCache.invalidate("leaderboard-content");
      }

      // Re-enable buttons
      const btns = ["btn-leaderboard-classic", "btn-leaderboard-daily"];
      btns.forEach(id => {
        const btn = _domCache.get(id);
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = "";
          btn.style.cursor = "";
        }
      });

      // Setup tab switching
      setupLeaderboardTabs();
    } else {
      // Immediate render with data
      render(LeaderboardModal(initialScores, type, false));
      bindClick("btn-close-leaderboard", () => remove("leaderboard-modal"));
      setupLeaderboardTabs();
    }
  },

  showStatsModal() {
    remove("stats-modal");
    
    const stats = getStats();
    render(MyStatsModal(stats));
    bindClick("btn-close-stats", () => remove("stats-modal"));
  },

  // Game UI
  showGameUI(roundNum, totalRounds, totalScore) {
    render(TimerBar());
    render(GameHeader(roundNum, totalRounds, totalScore));
  },
  updateGameUI(roundNum, totalRounds, totalScore) {
    remove("game-header");
    _domCache.invalidate("game-header");
    render(GameHeader(roundNum, totalRounds, totalScore));
  },
  hideGameUI() {
    remove("game-header");
    remove("timer-bar");
    _domCache.invalidate();
  },

  /**
   * Hide question modal
   */
  hideQuestion() {
    remove("question-modal");
    _domCache.invalidate("question-modal");
    if (_questionModalClickHandler) {
      const modal = document.getElementById("question-modal");
      modal?.removeEventListener("click", _questionModalClickHandler);
      _questionModalClickHandler = null;
    }
  },

  /**
   * Show question modal
   * @param {string} capitalName - Capital name
   * @param {string} country - Country name
   * @param {Function} onClose - Callback when modal closes
   * @param {Object} options - Options
   * @param {boolean} options.requireButton - If true, show button instead of auto-close
   */
  showQuestion(capitalName, country, onClose, { requireButton = false } = {}) {
    // Remove existing modal first
    remove("question-modal");
    
    // Render appropriate modal variant
    if (requireButton) {
      render(QuestionModalWithButton(capitalName, country));
    } else {
      render(QuestionModal(capitalName, country));
    }

    // Shared close handler
    const close = () => {
      remove("question-modal");
      // Clean up click listener if it was set
      if (_questionModalClickHandler) {
        const modal = document.getElementById("question-modal");
        modal?.removeEventListener("click", _questionModalClickHandler);
      }
      _domCache.invalidate("question-modal");
      // Wait for DOM update before enabling clicks
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onClose?.();
        });
      });
    };

    // Setup close behavior
    if (requireButton) {
      bindClick("btn-ready", close);
    } else {
      _questionModalClickHandler = close;
      const modal = _domCache.get("question-modal");
      if (modal) modal.addEventListener("click", _questionModalClickHandler);
      setTimeout(close, UI_TIMING.QUESTION_AUTO_CLOSE);
    }
  },

  resetTimer() {
    const p = _domCache.get("timer-progress");
    if (!p) return;
    p.style.transition = "none";
    p.style.width = "100%";
    p.classList.remove("timer-danger");
    p.offsetHeight; // Force reflow
  },

  // Round result
  showRoundResult(distance, score, isTimeout, isLast, baseScore, timeBonus) {
    const content = RoundResult(distance, score, isTimeout, isLast, baseScore, timeBonus);
    render(Modal("round-result", content, true));
    bindClick("btn-next", () => inputSystem.handleNextRound());
  },
  hideRoundResult() {
    remove("round-result");
    _domCache.invalidate("round-result");
  },

  // Game over / submit
  showGameOver(totalScore) {
    const lastPseudo = getLastPseudo() || "";
    render(GameOverScreen(totalScore, lastPseudo));

    // Clean up old listeners before adding new ones
    const oldInput = document.getElementById("pseudo-input");
    if (oldInput) {
      if (_pseudoInputHandler) oldInput.removeEventListener("input", _pseudoInputHandler);
      if (_pseudoKeypressHandler) oldInput.removeEventListener("keypress", _pseudoKeypressHandler);
      if (_pseudoFocusHandler) oldInput.removeEventListener("focus", _pseudoFocusHandler);
    }

    const input = _domCache.get("pseudo-input");
    if (input) {
      _pseudoInputHandler = (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      };
      _pseudoKeypressHandler = (e) => {
        if (e.key === "Enter") {
          const btn = _domCache.get("btn-submit");
          if (btn) btn.click();
        }
      };
      _pseudoFocusHandler = (e) => {
        e.target.style.outline = "none";
        e.target.style.boxShadow = "none";
      };
      input.addEventListener("input", _pseudoInputHandler);
      input.addEventListener("keypress", _pseudoKeypressHandler);
      input.addEventListener("focus", _pseudoFocusHandler);
      input.focus();
    }

    bindClick("btn-submit", debounce(() => {
      // Rate limiting check
      const now = Date.now();
      if (now - lastSubmitTime < MIN_SUBMIT_INTERVAL) {
        UI.showError(t('error.tooFast') || "Please wait before submitting again");
        return;
      }

      const pseudo = input?.value.trim();
      const error = _domCache.get("pseudo-error");
      const validation = validationSystem.validatePseudo(pseudo);
      if (!validation.valid) {
        error?.classList.remove("hidden");
        input?.style.setProperty("border-color", "#ef4444");
        return;
      }
      error?.classList.add("hidden");
      input?.style.setProperty("border-color", "var(--accent)");

      lastSubmitTime = now; // Update last submit time
      inputSystem.handleSubmit(pseudo);
    }, 1000)); // Debounce with 1 second delay

    bindClick("btn-replay", () => inputSystem.handleReplay());
  },

  showFinalResults(totalScore, pseudo, result, isNewSessionBest = false) {
    let modal = document.getElementById("result-modal");
    if (!modal) {
      modal = render(`
        <div id="result-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true"></div>
      `);
    }
    modal.innerHTML = `
      <div class="flex items-center justify-center p-4 h-full">
        ${FinalResults(totalScore, pseudo, result.rank, result.isTopFifty, isNewSessionBest)}
      </div>
    `;
    bindClick("btn-replay", () => inputSystem.handleReplay());
  },

  hideGameOver() {
    remove("result-modal");
    _domCache.invalidate("result-modal");
  },

  showError(message) {
    const container = app();
    if (!container) return; // Protection supplémentaire
    const errorEl = document.createElement("div");
    errorEl.className = "fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-600 text-white p-4 rounded-lg shadow-lg";
    errorEl.style.zIndex = "var(--z-overlay)";
    errorEl.textContent = message;
    container.appendChild(errorEl);
    setTimeout(() => errorEl.remove(), UI_TIMING.ERROR_DISPLAY);
  },

  showPseudoLockedDialog(pseudo) {
    render(PseudoLockedDialog(pseudo));
    bindClick("btn-pseudo-locked-ok", () => {
      remove("pseudo-locked-modal");
      _domCache.invalidate("pseudo-locked-modal");
    });
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type: 'info', 'warning', 'error', 'success'
   * @param {number} duration - Duration in ms (default: 5000, 0 = no auto-close)
   * @param {{ compact?: boolean }} [options] - compact: smaller, no emoji, text only
   * @returns {string} Toast ID
   */
  showToast(message, type = "info", duration = 5000, options = {}) {
    const toastId = `toast-${Date.now()}`;
    render(Toast(toastId, message, type, options));

    // Bind close button
    bindClick(`${toastId}-close`, () => {
      this.closeToast(toastId);
    });

    // Auto-close after duration
    if (duration > 0) {
      setTimeout(() => {
        this.closeToast(toastId);
      }, duration);
    }

    return toastId;
  },

  /**
   * Close a toast notification
   * @param {string} toastId - Toast ID to close
   */
  closeToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;

    // Add slide-down animation
    toast.classList.remove("toast-slide-up");
    toast.classList.add("toast-slide-down");

    // Remove after animation
    setTimeout(() => {
      remove(toastId);
    }, 300);
  },
};
