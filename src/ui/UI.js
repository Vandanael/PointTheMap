// Point The Map - UI Controller
// Clean, minimal UI controller using components

import { MODE_IDS } from "../config/game-modes.js";
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
} from "./components.js";
import { getStats } from "../features/StatsManager.js";
import { shareGameResults } from "../features/Share.js";
import { activateFocusTrap, deactivateFocusTrap } from "../utils/focusTrap.js";

// Rate limiting for submit button
const MIN_SUBMIT_INTERVAL = 2000; // 2 seconds between submissions
let lastSubmitTime = 0;

// Store UI.init() subscriptions for cleanup
/** @type {Array<() => void>} */
let _uiInitUnsubscribers = [];

// Store dynamic event listeners for cleanup
/** @type {null | ((e: Event) => void)} */
let _questionModalClickHandler = null;
/** @type {null | ((e: Event) => void)} */
let _pseudoInputHandler = null;
/** @type {null | ((e: Event) => void)} */
let _pseudoKeypressHandler = null;
/** @type {null | ((e: Event) => void)} */
let _pseudoFocusHandler = null;

// Track start screen listeners for cleanup
/** @type {Array<{ element: HTMLElement; listener: () => void }>} */
let _startScreenListeners = [];

// Track toast timers for cleanup
const _toastTimers = new Map();

// Store click handlers to allow removal before adding new ones
const _clickHandlers = new Map();

// DOM cache to avoid repeated queries
/** @type {{ _cache: Record<string, HTMLElement | null>; get(id: string): HTMLElement | null; invalidate(id?: string): void }} */
const _domCache = {
  /** @type {Record<string, HTMLElement | null>} */
  _cache: {},
  /** @param {string} id */
  get(id) {
    if (!this._cache[id] || !document.body.contains(this._cache[id])) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  },
  /** @param {string} [id] */
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

/**
 * @param {string} html
 * @param {HTMLElement} [container]
 * @returns {Element | null}
 */
const render = (html, container = app()) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const el = div.firstElementChild;
  if (el) container.appendChild(el);
  return el;
};

/** @param {string} id */
const remove = (id) => {
  const el = document.getElementById(id) || _domCache.get(id);
  if (el) {
    el.remove();
  }
  _domCache.invalidate(id);
  // Also remove click handler when element is removed
  _clickHandlers.delete(id);
};

/**
 * @param {string} id
 * @param {(e: Event) => void} handler
 */
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

/** @param {string} theme */
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

/** @param {string} type */
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
      await UI.showLeaderboardModal([], MODE_IDS.CLASSIC, true);
        } catch (/** @type {unknown} */ error) {
      logger.error('Failed to load classic leaderboard:', error);
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
          UI.showLeaderboardModal([], MODE_IDS.CLASSIC, true);
        });
      }
    }
  });

  bindClick("btn-leaderboard-daily", async () => {
    try {
      await UI.showLeaderboardModal([], MODE_IDS.DAILY, true);
    } catch (/** @type {unknown} */ error) {
      logger.error('Failed to load daily leaderboard:', error);
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
          UI.showLeaderboardModal([], MODE_IDS.DAILY, true);
        });
      }
    }
  });

  bindClick("btn-leaderboard-country", async () => {
    try {
      await UI.showLeaderboardModal([], MODE_IDS.COUNTRY, true);
    } catch (error) {
      logger.error('Failed to load country leaderboard:', error);
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
          UI.showLeaderboardModal([], MODE_IDS.COUNTRY, true);
        });
      }
    }
  });
};

// Export for testing
export const _domCacheForTesting = _domCache;

export const UI = {
  /** @type {null | (() => void)} */
  _langChangeCleanup: null,

  init() {
    applyTheme(getTheme());

    // Subscribe to error events
    _uiInitUnsubscribers.push(
      eventBus.subscribe('error:show', (/** @type {{ message: string }} */ { message }) => {
        UI.showError(message);
      })
    );

    // Timer UI (timer:started, timer:danger) is handled by UISystem only to avoid duplicate subscriptions.

    // Subscribe to storage quota events
    _uiInitUnsubscribers.push(
      eventBus.subscribe('storage:quota-exceeded', (/** @type {{ message: string }} */ { message }) => {
        UI.showToast(message, 'warning', 4000);
      })
    );

    _uiInitUnsubscribers.push(
      eventBus.subscribe('storage:quota-recovered', (/** @type {{ message: string }} */ { message }) => {
        UI.showToast(message, 'success', 3000);
      })
    );

    _uiInitUnsubscribers.push(
      eventBus.subscribe('storage:quota-failed', (/** @type {{ message: string }} */ { message }) => {
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
      void (/** @type {HTMLElement} */ (spinner).offsetHeight); // Force reflow
      // Update cache immediately
      _domCache._cache["loading-spinner"] = /** @type {HTMLElement} */ (spinner);
      _domCache._cache["loading-progress"] = document.getElementById("loading-progress");
    }
  },
  hideLoader() {
    remove("loading-spinner");
  },
  /** @param {number} percent */
  updateLoader(percent) {
    const p = _domCache.get("loading-progress");
    if (p) p.style.transform = `scaleX(${Math.min(100, percent) / 100})`;
  },

  // Start screen
  showStart() {
    document.getElementById('start-skeleton')?.remove();
    document.body.classList.add('start-screen-visible');
    // Subscribe to language changes
    const unsubscribe = eventBus.subscribe('language:changed', () => {
      UI.hideStart();
      UI.showStart(); // Re-render with new language
    });
    this._langChangeCleanup = /** @type {() => void} */ (unsubscribe);

    render(StartScreen());
    const startModal = document.getElementById("start-modal");
    if (startModal) {
      requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (startModal), { onEscape: () => this.hideStart() }));
    }

    // State for lobby selections
    let selectedCategory = "capitals"; // Default
    let selectedMode = MODE_IDS.CLASSIC; // Default

    // Helper to get category info
    /** @param {string} category */
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
      return infoMap[/** @type {keyof typeof infoMap} */ (category)] || infoMap.capitals;
    };

    // Helper to update challenge card with fade animation
    /** @param {string} category */
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
            const descEl = /** @type {HTMLElement} */ (desc);
            descEl.style.color = theme === 'dark' ? 'var(--accent)' : '#000000';
            descEl.style.fontWeight = "bold";
          } else {
            const descEl = /** @type {HTMLElement} */ (desc);
            descEl.style.color = "";  // Reset to default
            descEl.style.fontWeight = "";
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
    const modeButtons = [MODE_IDS.CLASSIC, MODE_IDS.DAILY];
    const slider = document.getElementById("pill-slider");

    modeButtons.forEach(mode => {
      const btn = document.getElementById(`mode-${mode}`);
      if (btn) {
        const modeListener = () => {
          selectedMode = mode;

          // Update slider position
          if (slider) {
            if (mode === MODE_IDS.DAILY) {
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
      let gameMode;
      if (selectedCategory === "capitals") {
        gameMode = selectedMode; // classic or daily
      } else if (selectedCategory === "countries") {
        gameMode = MODE_IDS.COUNTRY;
      } else if (selectedCategory === "civilizations") {
        gameMode = MODE_IDS.CIVILIZATION;
      } else if (selectedCategory === "stadiums") {
        gameMode = MODE_IDS.STADIUM;
      } else {
        return;
      }

      const { mapSystem } = await import("../systems/MapSystem.js");
      const needsInit = !mapSystem.isInitialized();
      const needsGeoJSON = selectedCategory === "countries" || selectedCategory === "civilizations";

      // Show loader only if there is actual async work pending
      if (needsInit || needsGeoJSON) {
        UI.showLoader();
        UI.updateLoader(needsInit && needsGeoJSON ? 20 : needsInit ? 40 : 50);
      }

      try {
        // Initialize map on first use
        if (needsInit) {
          await mapSystem.init("map");
          UI.updateLoader(needsGeoJSON ? 50 : 100);
        }

        // Load GeoJSON for country / civilization modes
        if (selectedCategory === "countries") {
          const loaded = await mapSystem.loadCountriesGeoJSON();
          UI.updateLoader(100);
          if (!loaded) {
            UI.hideLoader();
            UI.showToast(t('error.countriesLoadFailed') || "Failed to load countries data. Please try again.", "error", 4000);
            return;
          }
        } else if (selectedCategory === "civilizations") {
          const loaded = await mapSystem.loadCivilizationsGeoJSON();
          UI.updateLoader(100);
          if (!loaded) {
            UI.hideLoader();
            UI.showToast(t('error.civilizationsLoadFailed') || "Failed to load civilizations data. Please try again.", "error", 4000);
            return;
          }
        }

        if (needsInit || needsGeoJSON) {
          UI.hideLoader();
        }
      } catch (error) {
        logger.error('Error initializing game:', error);
        UI.hideLoader();
        const errorMsg = selectedCategory === "countries"
          ? (t('error.countriesLoadFailed') || "Failed to load countries data.")
          : selectedCategory === "civilizations"
            ? (t('error.civilizationsLoadFailed') || "Failed to load civilizations data.")
            : (t('error.mapLoadFailed') || "Failed to initialize map.");
        UI.showToast(errorMsg + " " + (error instanceof Error ? error.message : ""), "error", 4000);
        return;
      }

      inputSystem.handleStartGame(gameMode);
    });

    bindClick("btn-theme", toggleTheme);
    bindClick("btn-lang", handleToggleLang);
    bindClick("btn-leaderboard", () => {
      // Show skeleton immediately, load data in background
      UI.showLeaderboardModal([], MODE_IDS.CLASSIC, true);
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
    deactivateFocusTrap();
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
   * @param {Array<any>} initialScores - Initial scores (empty for lazy load)
   * @param {string} type - Leaderboard type
   * @param {boolean} lazyLoad - If true, show skeleton and load data
   */
  async showLeaderboardModal(initialScores = [], type = MODE_IDS.CLASSIC, lazyLoad = false) {
    remove("leaderboard-modal");

    // Show skeleton immediately if lazy loading
    if (lazyLoad) {
      render(LeaderboardModal([], /** @type {"classic" | "daily"} */ (type), true));
      const closeLeaderboard = () => {
        deactivateFocusTrap();
        remove("leaderboard-modal");
      };
      bindClick("btn-close-leaderboard", closeLeaderboard);
      const leaderboardModalSkeleton = document.getElementById("leaderboard-modal");
      if (leaderboardModalSkeleton) {
        requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (leaderboardModalSkeleton), { onEscape: closeLeaderboard }));
      }

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
        const btn = /** @type {HTMLButtonElement | null} */ (_domCache.get(id));
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = "";
          btn.style.cursor = "";
        }
      });

      // Setup tab switching
      setupLeaderboardTabs();
      const leaderboardModal = document.getElementById("leaderboard-modal");
      if (leaderboardModal) {
        requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (leaderboardModal), { onEscape: closeLeaderboard }));
      }
    } else {
      // Immediate render with data
      const closeLeaderboard = () => {
        deactivateFocusTrap();
        remove("leaderboard-modal");
      };
      render(LeaderboardModal(initialScores, /** @type {"classic" | "daily"} */ (type), false));
      bindClick("btn-close-leaderboard", closeLeaderboard);
      setupLeaderboardTabs();
      const leaderboardModal = document.getElementById("leaderboard-modal");
      if (leaderboardModal) {
        requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (leaderboardModal), { onEscape: closeLeaderboard }));
      }
    }
  },

  showStatsModal() {
    remove("stats-modal");

    const stats = getStats();
    render(MyStatsModal(stats));
    const closeStats = () => {
      deactivateFocusTrap();
      remove("stats-modal");
    };
    bindClick("btn-close-stats", closeStats);
    const statsModal = document.getElementById("stats-modal");
    if (statsModal) {
      requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (statsModal), { onEscape: closeStats }));
    }
  },

  // Game UI
  /**
   * @param {number} roundNum
   * @param {number} totalRounds
   * @param {number} totalScore
   */
  showGameUI(roundNum, totalRounds, totalScore) {
    render(TimerBar());
    render(GameHeader(roundNum, totalRounds, totalScore));
  },
  /**
   * @param {number} roundNum
   * @param {number} totalRounds
   * @param {number} totalScore
   */
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
    deactivateFocusTrap();
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
   * @param {() => void} onClose - Callback when modal closes
   * @param {{ requireButton?: boolean }} [options] - Options
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

    const modalEl = _domCache.get("question-modal");
    if (modalEl) {
      requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (modalEl), { onEscape: close }));
    }

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
  /**
   * @param {number | null} distance - Distance in km, or null on timeout with no click
   * @param {number} score
   * @param {boolean} isTimeout
   * @param {boolean} isLast
   * @param {number} baseScore
   * @param {number} timeBonus
   */
  showRoundResult(distance, score, isTimeout, isLast, baseScore, timeBonus) {
    const content = /** @type {(distance: number | null, score: number, isTimeout: boolean, isLast: boolean, baseScore?: number, timeBonus?: number) => string} */ (RoundResult)(distance, score, isTimeout, isLast, baseScore, timeBonus);
    render(Modal("round-result", content, true));
    bindClick("btn-next", () => inputSystem.handleNextRound());
  },
  hideRoundResult() {
    remove("round-result");
    _domCache.invalidate("round-result");
  },

  // Game over / submit
  /** @param {number} totalScore */
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

    const input = /** @type {HTMLInputElement | null} */ (_domCache.get("pseudo-input"));
    if (input) {
      _pseudoInputHandler = (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        target.value = target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      };
      _pseudoKeypressHandler = (e) => {
        if (/** @type {KeyboardEvent} */ (e).key === "Enter") {
          const btn = _domCache.get("btn-submit");
          if (btn) btn.click();
        }
      };
      _pseudoFocusHandler = (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        target.style.outline = "none";
        target.style.boxShadow = "none";
      };
      input.addEventListener("input", _pseudoInputHandler);
      input.addEventListener("keypress", _pseudoKeypressHandler);
      input.addEventListener("focus", _pseudoFocusHandler);
      input.focus();
    }

    bindClick("btn-submit", /** @type {(e: Event) => void} */ (debounce(() => {
      const submitBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById("btn-submit"));

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

      const pseudo = (input?.value.trim() ?? "");
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
    }, UI_TIMING.DEBOUNCE_SUBMIT))); // Debounce delay

    bindClick("btn-replay", () => inputSystem.handleReplay());
    const gameOverModal = document.getElementById("result-modal");
    if (gameOverModal) {
      requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (gameOverModal), { onEscape: () => this.hideGameOver() }));
    }
  },

  /**
   * @param {number} totalScore
   * @param {string} pseudo
   * @param {{ rank: number, isTopFifty: boolean }} result
   * @param {boolean} [isNewSessionBest]
   */
  showFinalResults(totalScore, pseudo, result, isNewSessionBest = false) {
    let modal = document.getElementById("result-modal");
    if (!modal) {
      modal = /** @type {HTMLElement | null} */ (render(`
        <div id="result-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true"></div>
      `));
    }
    if (modal) {
      modal.innerHTML = `
        <div class="flex items-center justify-center p-4 h-full">
          ${FinalResults(totalScore, pseudo, result.rank, result.isTopFifty, isNewSessionBest)}
        </div>
      `;
    }
    bindClick("btn-replay", () => inputSystem.handleReplay());
    const resultModal = document.getElementById("result-modal");
    if (resultModal) {
      requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (resultModal), { onEscape: () => this.hideGameOver() }));
    }
  },

  hideGameOver() {
    deactivateFocusTrap();
    remove("result-modal");
    _domCache.invalidate("result-modal");
  },

  /** @param {string} message */
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

  /**
   * @param {string} pseudo
   * @param {() => void} onConfirm
   */
  showPseudoLockedDialog(pseudo, onConfirm) {
    render(PseudoLockedDialog(pseudo));
    const closePseudoLocked = () => {
      deactivateFocusTrap();
      remove("pseudo-locked-modal");
      _domCache.invalidate("pseudo-locked-modal");
      // Call the confirm callback to resubmit with locked pseudo
      if (onConfirm) onConfirm();
    };
    const closePseudoLockedWithoutConfirm = () => {
      deactivateFocusTrap();
      remove("pseudo-locked-modal");
      _domCache.invalidate("pseudo-locked-modal");
    };
    bindClick("btn-pseudo-locked-ok", closePseudoLocked);
    const pseudoLockedModal = document.getElementById("pseudo-locked-modal");
    if (pseudoLockedModal) {
      requestAnimationFrame(() => activateFocusTrap(/** @type {HTMLElement} */ (pseudoLockedModal), { onEscape: closePseudoLockedWithoutConfirm }));
    }
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
