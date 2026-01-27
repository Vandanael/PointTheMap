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
} from "./components.js";

// Rate limiting for submit button
const MIN_SUBMIT_INTERVAL = 2000; // 2 seconds between submissions
let lastSubmitTime = 0;

const app = () => {
  const el = document.getElementById("app");
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

const remove = (id) => document.getElementById(id)?.remove();
const bindClick = (id, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
};

const applyTheme = (theme) => {
  if (theme === "light") document.body.classList.add("light-theme");
  else document.body.classList.remove("light-theme");
  const icon = document.getElementById("theme-icon");
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
  const icon = document.getElementById("lang-icon");
  if (icon) icon.textContent = newLang.toUpperCase();
  eventBus.emit('language:changed', { language: newLang });
};

const loadLeaderboard = async (type) => {
  const scores = await safeAsync(
    () => api.getLeaderboard(type),
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

export const UI = {
  _langChangeCleanup: null,

  init() {
    applyTheme(getTheme());

    // Subscribe to error events
    eventBus.subscribe('error:show', ({ message }) => {
      UI.showError(message);
    });

    // Subscribe to timer UI events
    eventBus.subscribe('timer:started', () => {
      const timerProgress = document.getElementById("timer-progress");
      if (!timerProgress) return;
      timerProgress.style.transition = `width ${GAME.TIMER_MS}ms linear`;
      timerProgress.style.width = "0%";
    });

    eventBus.subscribe('timer:danger', () => {
      const progress = document.getElementById("timer-progress");
      if (progress) progress.classList.add("timer-danger");
    });

    // Subscribe to storage quota events
    eventBus.subscribe('storage:quota-exceeded', ({ message }) => {
      this.showToast(message, 'warning', 4000);
    });

    eventBus.subscribe('storage:quota-recovered', ({ message }) => {
      this.showToast(message, 'success', 3000);
    });

    eventBus.subscribe('storage:quota-failed', ({ message }) => {
      this.showToast(message, 'error', 6000);
    });
  },

  // Loader
  showLoader() {
    const existing = document.getElementById("loading-spinner");
    if (existing) return;
    render(LoadingSpinner());
  },
  hideLoader() {
    remove("loading-spinner");
  },
  updateLoader(percent) {
    const p = document.getElementById("loading-progress");
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
    bindClick("btn-leaderboard", () => {
      // Show skeleton immediately, load data in background
      UI.showLeaderboardModal([], "classic", true);
    });
  },
  hideStart() {
    remove("start-modal");
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
      const contentEl = document.getElementById("leaderboard-content");
      if (contentEl) {
        contentEl.outerHTML = Leaderboard(scores, null, false);
      }

      // Re-enable buttons
      const btns = ["btn-leaderboard-classic", "btn-leaderboard-daily"];
      btns.forEach(id => {
        const btn = document.getElementById(id);
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

  // Game UI
  showGameUI(roundNum, totalRounds, capitalName, country, totalScore) {
    render(TimerBar());
    render(GameHeader(roundNum, totalRounds, capitalName, country, totalScore));
  },
  updateGameUI(roundNum, totalRounds, capitalName, country, totalScore) {
    remove("game-header");
    render(GameHeader(roundNum, totalRounds, capitalName, country, totalScore));
  },
  hideGameUI() {
    remove("game-header");
    remove("timer-bar");
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
    // Render appropriate modal variant
    if (requireButton) {
      render(QuestionModalWithButton(capitalName, country));
    } else {
      render(QuestionModal(capitalName, country));
    }

    // Shared close handler
    const close = () => {
      remove("question-modal");
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
      document.getElementById("question-modal")?.addEventListener("click", close);
      setTimeout(close, UI_TIMING.QUESTION_AUTO_CLOSE);
    }
  },

  resetTimer() {
    const p = document.getElementById("timer-progress");
    if (!p) return;
    p.style.transition = "none";
    p.style.width = "100%";
    p.classList.remove("timer-danger");
    p.offsetHeight; // Force reflow
  },

  // Round result
  showRoundResult(distance, score, isTimeout, isLast) {
    const content = RoundResult(distance, score, isTimeout, isLast);
    render(Modal("round-result", content, true));
    bindClick("btn-next", () => inputSystem.handleNextRound());
  },
  hideRoundResult() {
    remove("round-result");
  },

  // Game over / submit
  showGameOver(totalScore) {
    const lastPseudo = getLastPseudo() || "";
    render(GameOverScreen(totalScore, lastPseudo));

    const input = document.getElementById("pseudo-input");
    if (input) {
      input.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const btn = document.getElementById("btn-submit");
          if (btn) btn.click();
        }
      });
      input.addEventListener("focus", (e) => {
        e.target.style.outline = "none";
        e.target.style.boxShadow = "none";
      });
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
      const error = document.getElementById("pseudo-error");
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
    });
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type: 'info', 'warning', 'error', 'success'
   * @param {number} duration - Duration in ms (default: 5000, 0 = no auto-close)
   * @returns {string} Toast ID
   */
  showToast(message, type = "info", duration = 5000) {
    const toastId = `toast-${Date.now()}`;
    render(Toast(toastId, message, type));

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
