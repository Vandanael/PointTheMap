// Point The Map - UI Controller
// Clean, minimal UI controller using components

import { api } from "../services/api.js";
import { getLastPseudo, getTheme, setTheme } from "../services/storage.js";
import { toggleLang, t } from "../i18n.js";
import { logger } from "../utils/logger.js";
import { eventBus } from "../core/EventBus.js";
import { UI_TIMING } from "../config/visual-constants.js";
import { debounce } from "../utils/performance.js";
import { inputSystem } from "../systems/InputSystem.js";
import { safeAsync } from "../core/ErrorHandler.js";
import { validationSystem } from "../systems/ValidationSystem.js";
import {
  Modal,
  TimerBar,
  GameHeader,
  GameHeaderSkeleton,
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
  HelpModal,
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

// Track start screen listeners for cleanup
let _startScreenListeners = [];

// Track toast timers for cleanup
const _toastTimers = new Map();

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
  if (theme === "light") {
    document.body.classList.add("light-theme");
    document.body.classList.remove("dark-theme");
  } else {
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
  }
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
    try {
      await UI.showLeaderboardModal([], "classic", true);
    } catch (error) {
      console.error('Failed to load classic leaderboard:', error);
      const content = _domCache.get("leaderboard-content");
      if (content) {
        content.innerHTML = `
          <div class="text-center py-8">
            <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
            <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
              ${t('error.retry')}
            </button>
          </div>
        `;
        bindClick("btn-retry-leaderboard", () => {
          UI.showLeaderboardModal([], "classic", true);
        });
      }
    }
  });

  bindClick("btn-leaderboard-daily", async () => {
    try {
      await UI.showLeaderboardModal([], "daily", true);
    } catch (error) {
      console.error('Failed to load daily leaderboard:', error);
      const content = _domCache.get("leaderboard-content");
      if (content) {
        content.innerHTML = `
          <div class="text-center py-8">
            <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
            <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
              ${t('error.retry')}
            </button>
          </div>
        `;
        bindClick("btn-retry-leaderboard", () => {
          UI.showLeaderboardModal([], "daily", true);
        });
      }
    }
  });

  bindClick("btn-leaderboard-country", async () => {
    try {
      await UI.showLeaderboardModal([], "country", true);
    } catch (error) {
      console.error('Failed to load country leaderboard:', error);
      const content = _domCache.get("leaderboard-content");
      if (content) {
        content.innerHTML = `
          <div class="text-center py-8">
            <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
            <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
              ${t('error.retry')}
            </button>
          </div>
        `;
        bindClick("btn-retry-leaderboard", () => {
          UI.showLeaderboardModal([], "country", true);
        });
      }
    }
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

    // Timer UI (timer:started, timer:danger) is handled by UISystem only to avoid duplicate subscriptions.

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
    document.body.classList.add('start-screen-visible');
    // Subscribe to language changes
    const unsubscribe = eventBus.subscribe('language:changed', () => {
      UI.hideStart();
      UI.showStart(); // Re-render with new language
    });
    this._langChangeCleanup = unsubscribe;

    render(StartScreen());

    // State for lobby selections
    let selectedCategory = "capitals"; // Default
    let selectedMode = "classic"; // Default

    // Helper to get category info
    const getCategoryInfo = (category) => {
      const infoMap = {
        capitals: {
          title: t("challenge"),
          info: t("capitalsInfo"),
          desc: t("clickToWin")
        },
        countries: {
          title: t("challenge"),
          info: t("countriesInfo"),
          desc: t("clickToWin")
        },
        civilizations: {
          title: t("challenge"),
          info: t("civilizationsInfo"),
          desc: t("clickToWin")
        },
        stadiums: {
          title: t("challenge"),
          info: t("stadiumsInfo"),
          desc: t("clickToWin")
        }
      };
      return infoMap[category] || infoMap.capitals;
    };

    // Helper to update challenge card with fade animation
    const updateChallengeCard = (category) => {
      const card = document.getElementById("challenge-card");
      if (!card) return;

      const info = getCategoryInfo(category);

      // Fade out
      card.classList.add("fade-out");
      card.classList.remove("fade-in");

      setTimeout(() => {
        // Update content
        const title = card.querySelector(".challenge-title");
        const infoText = card.querySelector(".challenge-info");
        const desc = card.querySelector(".challenge-desc");

        if (title) title.textContent = info.title;
        if (infoText) infoText.textContent = info.info;
        if (desc) {
          desc.textContent = info.desc;
          // Apply color for "coming soon" text: black in light mode, yellow in dark mode
          if (info.desc === t("comingSoon")) {
            const theme = getTheme();
            desc.style.color = theme === 'dark' ? 'var(--accent)' : '#000000';
            desc.style.fontWeight = "bold";
          } else {
            desc.style.color = "";  // Reset to default
            desc.style.fontWeight = "";
          }
        }

        // Fade in
        card.classList.remove("fade-out");
        card.classList.add("fade-in");
      }, UI_TIMING.CHALLENGE_CARD_FADE);
    };

    // Category selection handlers
    const categoryButtons = ["capitals", "countries", "civilizations", "stadiums"];
    categoryButtons.forEach(category => {
      const btn = document.getElementById(`category-${category}`);
      if (btn) {
        const categoryListener = () => {
          selectedCategory = category;

          // Update challenge card
          updateChallengeCard(category);

          // Update active states
          categoryButtons.forEach(cat => {
            const catBtn = document.getElementById(`category-${cat}`);
            if (catBtn) {
              if (cat === category) {
                catBtn.classList.add("category-active");
                catBtn.style.borderColor = "var(--accent)";
                // Change text color to primary
                const textEl = catBtn.querySelector(".text-secondary, .text-primary");
                if (textEl) {
                  textEl.classList.remove("text-secondary");
                  textEl.classList.add("text-primary");
                }
              } else {
                catBtn.classList.remove("category-active");
                catBtn.style.borderColor = "var(--border-color)";
                // Change text color to secondary
                const textEl = catBtn.querySelector(".text-primary, .text-secondary");
                if (textEl) {
                  textEl.classList.remove("text-primary");
                  textEl.classList.add("text-secondary");
                }
              }
            }
          });
        };
        btn.addEventListener("click", categoryListener);
        _startScreenListeners.push({ element: btn, listener: categoryListener });
      }
    });

    // Mode selection handlers with pill slider
    const modeButtons = ["classic", "daily"];
    const slider = document.getElementById("pill-slider");

    modeButtons.forEach(mode => {
      const btn = document.getElementById(`mode-${mode}`);
      if (btn) {
        const modeListener = () => {
          selectedMode = mode;

          // Update slider position
          if (slider) {
            if (mode === "daily") {
              slider.classList.add("slide-right");
            } else {
              slider.classList.remove("slide-right");
            }
          }

          // Update active states
          modeButtons.forEach(m => {
            const modeBtn = document.getElementById(`mode-${m}`);
            if (modeBtn) {
              if (m === mode) {
                modeBtn.classList.add("pill-option-active");
              } else {
                modeBtn.classList.remove("pill-option-active");
              }
            }
          });
        };
        btn.addEventListener("click", modeListener);
        _startScreenListeners.push({ element: btn, listener: modeListener });
      }
    });

    // Start game button with selected category and mode
    bindClick("btn-start-game", async () => {
      // Map category to game mode
      let gameMode;

      if (selectedCategory === "capitals") {
        gameMode = selectedMode; // Use selected mode (classic or daily)
      } else if (selectedCategory === "countries") {
        gameMode = "country";

        // Load countries GeoJSON if not already loaded
        UI.showLoader();
        UI.updateLoader(30);

        try {
          const { mapSystem } = await import("../systems/MapSystem.js");
          UI.updateLoader(60);

          const loaded = await mapSystem.loadCountriesGeoJSON();
          UI.updateLoader(100);

          if (!loaded) {
            UI.hideLoader();
            UI.showToast(t('error.countriesLoadFailed') || "Failed to load countries data. Please try again.", "error", 4000);
            return;
          }

          UI.hideLoader();
        } catch (error) {
          logger.error('Error loading countries:', error);
          UI.hideLoader();
          UI.showToast(t('error.countriesLoadFailed') || "Error loading countries: " + error.message, "error", 4000);
          return;
        }
      } else if (selectedCategory === "civilizations") {
        gameMode = "civilization";

        UI.showLoader();
        UI.updateLoader(30);

        try {
          const { mapSystem } = await import("../systems/MapSystem.js");
          UI.updateLoader(60);

          const loaded = await mapSystem.loadCivilizationsGeoJSON();
          UI.updateLoader(100);

          if (!loaded) {
            UI.hideLoader();
            UI.showToast(t('error.civilizationsLoadFailed') || "Failed to load civilizations data. Please try again.", "error", 4000);
            return;
          }

          UI.hideLoader();
        } catch (error) {
          logger.error('Error loading civilizations:', error);
          UI.hideLoader();
          UI.showToast(t('error.civilizationsLoadFailed') || "Error loading civilizations: " + error.message, "error", 4000);
          return;
        }
      } else if (selectedCategory === "stadiums") {
        gameMode = "stadium";
      } else {
        return;
      }

      inputSystem.handleStartGame(gameMode);
    });

    bindClick("btn-help", () => UI.showHelpModal());
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
    document.body.classList.remove('start-screen-visible');

    // Clean up tracked listeners
    _startScreenListeners.forEach(({ element, listener }) => {
      element?.removeEventListener("click", listener);
    });
    _startScreenListeners = [];

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

      // Modal may have been closed while loading; do not update or bind
      if (!document.getElementById("leaderboard-modal")) return;

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
      const btns = ["btn-leaderboard-classic", "btn-leaderboard-daily", "btn-leaderboard-country"];
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

  showHelpModal() {
    remove("help-modal");

    render(HelpModal());
    bindClick("btn-close-help", () => remove("help-modal"));
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
    const modal = _domCache.get("question-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
    if (_questionModalClickHandler) {
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
    let modal = _domCache.get("question-modal");
    if (!modal) {
      if (requireButton) {
        render(QuestionModalWithButton(capitalName, country));
      } else {
        render(QuestionModal(capitalName, country));
      }
      modal = _domCache.get("question-modal");
    } else {
      const capitalEl = modal.querySelector("#capitalName");
      const countryEl = modal.querySelector("#countryName");
      if (capitalEl) capitalEl.textContent = capitalName;
      if (countryEl) countryEl.textContent = country;
      modal.classList.remove("hidden");
    }
    
    // Shared close handler
    const close = () => {
      this.hideQuestion();
      // Explicit focus management to prevent "first tap = focus restoration"
      // After long wait (tab inactive/minimized), first tap would normally restore focus
      // By proactively focusing the map container, we ensure subsequent taps work as clicks
      const mapContainer = document.getElementById("map");
      if (mapContainer) {
        mapContainer.focus({ preventScroll: true });
      } else {
        // Fallback to body if map container not found
        document.body.focus({ preventScroll: true });
      }

      // Double RAF to handle browser throttling after long idle
      // After tab inactive or long wait, browser may throttle RAF/layout
      // Single RAF works for fast taps, but double ensures map is fully ready after idle
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
      _questionModalClickHandler = (event) => {
        event.stopPropagation();
        close();
      };
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
      const submitBtn = document.getElementById("btn-submit");

      // Rate limiting check
      const now = Date.now();
      const elapsed = now - lastSubmitTime;
      const remaining = MIN_SUBMIT_INTERVAL - elapsed;

      if (remaining > 0) {
        // Show countdown instead of error
        if (submitBtn) {
          submitBtn.disabled = true;
          const originalText = submitBtn.textContent;
          submitBtn.textContent = `${t('waitSeconds', { seconds: Math.ceil(remaining / 1000) })}`;

          setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }, remaining);
        }
        return;
      }

      const pseudo = input?.value.trim();
      const error = _domCache.get("pseudo-error");
      const validation = validationSystem.validatePseudo(pseudo);
      if (!validation.valid) {
        input?.setAttribute("aria-invalid", "true");
        input?.classList.add("input-error-shake");
        error?.classList.remove("hidden");
        input?.style.setProperty("border-color", "#ef4444");

        // Remove shake class after animation
        setTimeout(() => {
          input?.classList.remove("input-error-shake");
        }, UI_TIMING.INPUT_ERROR_SHAKE);
        return;
      }
      input?.setAttribute("aria-invalid", "false");
      error?.classList.add("hidden");
      input?.style.setProperty("border-color", "var(--accent)");

      lastSubmitTime = now; // Update last submit time
      inputSystem.handleSubmit(pseudo);
    }, UI_TIMING.DEBOUNCE_SUBMIT)); // Debounce delay

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

  showPseudoLockedDialog(pseudo, onConfirm) {
    render(PseudoLockedDialog(pseudo));
    bindClick("btn-pseudo-locked-ok", () => {
      remove("pseudo-locked-modal");
      _domCache.invalidate("pseudo-locked-modal");
      // Call the confirm callback to resubmit with locked pseudo
      if (onConfirm) onConfirm();
    });
  },

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type: 'info', 'warning', 'error', 'success'
   * @param {number} duration - Duration in ms (default: 5000, 0 = no auto-close)
   * @param {{ compact?: boolean, center?: boolean }} [options] - compact: smaller, no emoji, text only; center: center text horizontally
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
      const timerId = setTimeout(() => {
        this.closeToast(toastId);
      }, duration);
      _toastTimers.set(toastId, timerId);
    }

    return toastId;
  },

  /**
   * Close a toast notification
   * @param {string} toastId - Toast ID to close
   */
  closeToast(toastId) {
    // Clear timer if exists
    const timerId = _toastTimers.get(toastId);
    if (timerId) {
      clearTimeout(timerId);
      _toastTimers.delete(toastId);
    }

    const toast = document.getElementById(toastId);
    if (!toast) return;

    // Add slide-down animation
    toast.classList.remove("toast-slide-up");
    toast.classList.add("toast-slide-down");

    // Remove after animation
    setTimeout(() => {
      remove(toastId);
    }, UI_TIMING.TOAST_SLIDE_OUT);
  },
};
