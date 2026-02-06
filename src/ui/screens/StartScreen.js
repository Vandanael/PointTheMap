// Start screen UI module

import { MODE_IDS } from '../../config/game-modes.js';
import { api } from '../../services/api.js';
import { getTheme, setTheme } from '../../services/storage.js';
import { toggleLang, t } from '../../i18n.js';
import { logger } from '../../utils/logger.js';
import { domCache as _domCache, render, remove, bindClick } from '../dom.js';
import { eventBus } from '../../core/EventBus.js';
import { UI_TIMING } from '../../config/visual-constants.js';
import { handleError, safeAsync } from '../../core/ErrorHandler.js';
import { shareGameResults } from '../../features/Share.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../utils/focusTrap.js';
import {
  StartScreen,
  Leaderboard,
  LeaderboardModal,
  MyStatsModal,
  leaderboardTypeFromSelection,
  selectionFromLeaderboardType,
} from '../components.js';
import { getStats } from '../../features/StatsManager.js';

const LEADERBOARD_TIMEOUT_MS = 5000; // 5 seconds timeout

/** @param {string} type */
const loadLeaderboard = async (type) => {
  const scores = await safeAsync(
    () =>
      Promise.race([
        api.getLeaderboard(type),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), LEADERBOARD_TIMEOUT_MS)
        ),
      ]),
    'leaderboard:load',
    []
  );
  return scores;
};

/**
 * @param {{
 *   getInputSystem: () => { handleStartGame: (gameMode: string) => void } | null;
 *   getMapSystem: () => { isInitialized: () => boolean; init: (mapId: string) => Promise<void>; loadCountriesGeoJSON: () => Promise<boolean>; loadCivilizationsGeoJSON: () => Promise<boolean> } | null;
 *   showLoader: () => void;
 *   hideLoader: () => void;
 *   updateLoader: (percent: number) => void;
 *   showToast: (message: string, type?: "info" | "warning" | "error" | "success", duration?: number, options?: { compact?: boolean, center?: boolean }) => string;
 *   onRetryLeaderboard?: (type: string) => void;
 * }} deps
 */
export const createStartScreen = (deps) => {
  const {
    getInputSystem,
    getMapSystem,
    showLoader,
    hideLoader,
    updateLoader,
    showToast,
    onRetryLeaderboard,
  } = deps;

  // Leaderboard two-level tab state
  /** @type {"classic"|"daily"} */
  let _leaderboardVariant = 'classic';
  /** @type {"capitals"|"countries"|"stadiums"|"civilizations"} */
  let _leaderboardCategory = 'capitals';

  // Track start screen listeners for cleanup
  /** @type {Array<{ element: HTMLElement; listener: () => void }>} */
  let _startScreenListeners = [];
  /** @type {null | (() => void)} */
  let _langChangeCleanup = null;

  /** @param {string} theme */
  const applyTheme = (theme) => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    }
    const icon = _domCache.get('theme-icon');
    if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
  };

  const toggleTheme = () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    eventBus.emit('theme:changed', { theme: next });
  };

  const handleToggleLang = () => {
    const newLang = toggleLang();
    const icon = _domCache.get('lang-icon');
    if (icon) icon.textContent = newLang.toUpperCase();
    eventBus.emit('language:changed', { language: newLang });
  };

  const setupLeaderboardTabs = () => {
    /**
     * @param {"classic"|"daily"} variant
     * @param {"capitals"|"countries"|"stadiums"|"civilizations"} category
     */
    const switchTo = async (variant, category) => {
      _leaderboardVariant = variant;
      _leaderboardCategory = category;
      const type = leaderboardTypeFromSelection(variant, category);
      try {
        await showLeaderboardModal([], type, true);
      } catch (/** @type {unknown} */ error) {
        handleError(error, 'leaderboard:load', { showToUser: false });
        logger.error(`Failed to load ${type} leaderboard:`, error);
        const content = _domCache.get('leaderboard-content');
        if (content) {
          content.innerHTML = `
            <div class="text-center py-8">
              <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
              <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
                ${t('error.retry')}
              </button>
            </div>
          `;
          bindClick('btn-retry-leaderboard', () => {
            if (onRetryLeaderboard) {
              onRetryLeaderboard(type);
            } else {
              switchTo(variant, category);
            }
          });
        }
      }
    };

    // Variant buttons
    bindClick('btn-leaderboard-classic', () => switchTo('classic', _leaderboardCategory));
    bindClick('btn-leaderboard-daily', () => switchTo('daily', _leaderboardCategory));

    // Category buttons
    bindClick('btn-leaderboard-cat-capitals', () => switchTo(_leaderboardVariant, 'capitals'));
    bindClick('btn-leaderboard-cat-countries', () => switchTo(_leaderboardVariant, 'countries'));
    bindClick('btn-leaderboard-cat-stadiums', () => switchTo(_leaderboardVariant, 'stadiums'));
    bindClick('btn-leaderboard-cat-civilizations', () =>
      switchTo(_leaderboardVariant, 'civilizations')
    );
  };

  /**
   * Show leaderboard modal with lazy loading
   * @param {Array<any>} initialScores
   * @param {string} type
   * @param {boolean} lazyLoad
   */
  const showLeaderboardModal = async (
    initialScores = [],
    type = MODE_IDS.CLASSIC,
    lazyLoad = false
  ) => {
    const selection = selectionFromLeaderboardType(type);
    _leaderboardVariant = selection.variant;
    _leaderboardCategory = selection.category;

    remove('leaderboard-modal');

    if (lazyLoad) {
      render(LeaderboardModal([], /** @type {"classic" | "daily"} */ (type), true));
      const closeLeaderboard = () => {
        deactivateFocusTrap();
        remove('leaderboard-modal');
      };
      bindClick('btn-close-leaderboard', closeLeaderboard);
      setupLeaderboardTabs();
      const leaderboardModalSkeleton = document.getElementById('leaderboard-modal');
      if (leaderboardModalSkeleton) {
        requestAnimationFrame(() =>
          activateFocusTrap(/** @type {HTMLElement} */ (leaderboardModalSkeleton), {
            onEscape: closeLeaderboard,
          })
        );
      }

      const scores = await loadLeaderboard(type);

      if (!document.getElementById('leaderboard-modal')) return;

      const contentEl = _domCache.get('leaderboard-content');
      if (contentEl) {
        if (scores.length === 0) {
          contentEl.innerHTML = `
            <div class="text-center py-8">
              <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
              <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
                ${t('error.retry')}
              </button>
            </div>
          `;
          bindClick('btn-retry-leaderboard', () => {
            if (onRetryLeaderboard) {
              onRetryLeaderboard(type);
            } else {
              showLeaderboardModal([], type, true);
            }
          });
        } else {
          contentEl.outerHTML = Leaderboard(scores, null, false);
        }
        _domCache.invalidate('leaderboard-content');
      }

      const btns = [
        'btn-leaderboard-classic',
        'btn-leaderboard-daily',
        'btn-leaderboard-cat-capitals',
        'btn-leaderboard-cat-countries',
        'btn-leaderboard-cat-stadiums',
        'btn-leaderboard-cat-civilizations',
      ];
      btns.forEach((id) => {
        const btn = /** @type {HTMLButtonElement | null} */ (_domCache.get(id));
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '';
          btn.style.cursor = '';
        }
      });
    } else {
      const closeLeaderboard = () => {
        deactivateFocusTrap();
        remove('leaderboard-modal');
      };
      render(LeaderboardModal(initialScores, /** @type {"classic" | "daily"} */ (type), false));
      bindClick('btn-close-leaderboard', closeLeaderboard);
      setupLeaderboardTabs();
      const leaderboardModal = document.getElementById('leaderboard-modal');
      if (leaderboardModal) {
        requestAnimationFrame(() =>
          activateFocusTrap(/** @type {HTMLElement} */ (leaderboardModal), {
            onEscape: closeLeaderboard,
          })
        );
      }
    }
  };

  const showStatsModal = () => {
    remove('stats-modal');

    const stats = getStats();
    render(MyStatsModal(stats));
    const closeStats = () => {
      deactivateFocusTrap();
      remove('stats-modal');
    };
    bindClick('btn-close-stats', closeStats);
    const statsModal = document.getElementById('stats-modal');
    if (statsModal) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (statsModal), { onEscape: closeStats })
      );
    }
  };

  const showStart = () => {
    document.body.classList.add('start-screen-visible');
    document.body.dataset.appReady = 'true';
    const unsubscribe = eventBus.subscribe('language:changed', () => {
      hideStart();
      showStart();
    });
    _langChangeCleanup = /** @type {() => void} */ (unsubscribe);

    render(StartScreen());
    const startModal = document.getElementById('start-modal');
    if (startModal) {
      requestAnimationFrame(() => {
        document.getElementById('start-skeleton')?.remove();
        activateFocusTrap(/** @type {HTMLElement} */ (startModal), { onEscape: () => hideStart() });
      });
    }

    /** @type {"capitals"|"countries"|"stadiums"|"civilizations"} */
    let selectedCategory = 'capitals';
    /** @type {"classic"|"daily"} */
    let selectedMode = 'classic';

    /** @param {"capitals"|"countries"|"stadiums"|"civilizations"} category */
    const getCategoryInfo = (category) => {
      const infoMap = {
        capitals: {
          title: t('challenge'),
          info: t('capitalsInfo'),
          desc: t('clickToWin'),
        },
        countries: {
          title: t('challenge'),
          info: t('countriesInfo'),
          desc: t('clickToWin'),
        },
        civilizations: {
          title: t('challenge'),
          info: t('civilizationsInfo'),
          desc: t('clickToWin'),
        },
        stadiums: {
          title: t('challenge'),
          info: t('stadiumsInfo'),
          desc: t('clickToWin'),
        },
      };
      return infoMap[/** @type {keyof typeof infoMap} */ (category)] || infoMap.capitals;
    };

    /** @param {"capitals"|"countries"|"stadiums"|"civilizations"} category */
    const updateChallengeCard = (category) => {
      const card = document.getElementById('challenge-card');
      if (!card) return;

      const info = getCategoryInfo(category);

      card.classList.add('fade-out');
      card.classList.remove('fade-in');

      setTimeout(() => {
        const title = card.querySelector('.challenge-title');
        const infoText = card.querySelector('.challenge-info');
        const desc = card.querySelector('.challenge-desc');

        if (title) title.textContent = info.title;
        if (infoText) infoText.textContent = info.info;
        if (desc) {
          desc.textContent = info.desc;
        }

        card.classList.remove('fade-out');
        card.classList.add('fade-in');
      }, UI_TIMING.CHALLENGE_CARD_FADE);
    };

    /** @type {Array<"capitals"|"countries"|"civilizations"|"stadiums">} */
    const categoryButtons = ['capitals', 'countries', 'civilizations', 'stadiums'];
    categoryButtons.forEach((category) => {
      const btn = document.getElementById(`category-${category}`);
      if (btn) {
        const categoryListener = () => {
          selectedCategory = category;
          updateChallengeCard(category);

          categoryButtons.forEach((cat) => {
            const catBtn = document.getElementById(`category-${cat}`);
            if (catBtn) {
              if (cat === category) {
                catBtn.classList.add('category-active');
                catBtn.style.borderColor = 'var(--accent)';
                const textEl = catBtn.querySelector('.text-secondary, .text-primary');
                if (textEl) {
                  textEl.classList.remove('text-secondary');
                  textEl.classList.add('text-primary');
                }
              } else {
                catBtn.classList.remove('category-active');
                catBtn.style.borderColor = 'var(--border-color)';
                const textEl = catBtn.querySelector('.text-primary, .text-secondary');
                if (textEl) {
                  textEl.classList.remove('text-primary');
                  textEl.classList.add('text-secondary');
                }
              }
            }
          });
        };
        btn.addEventListener('click', categoryListener);
        _startScreenListeners.push({ element: btn, listener: categoryListener });
      }
    });

    /** @type {Array<"classic"|"daily">} */
    const modeButtons = ['classic', 'daily'];
    const slider = document.getElementById('pill-slider');

    modeButtons.forEach((mode) => {
      const btn = document.getElementById(`mode-${mode}`);
      if (btn) {
        const modeListener = () => {
          selectedMode = mode;

          if (slider) {
            if (mode === MODE_IDS.DAILY) {
              slider.classList.add('slide-right');
            } else {
              slider.classList.remove('slide-right');
            }
          }

          modeButtons.forEach((m) => {
            const modeBtn = document.getElementById(`mode-${m}`);
            if (modeBtn) {
              if (m === mode) {
                modeBtn.classList.add('pill-option-active');
                modeBtn.setAttribute('aria-checked', 'true');
              } else {
                modeBtn.classList.remove('pill-option-active');
                modeBtn.setAttribute('aria-checked', 'false');
              }
            }
          });
        };
        btn.addEventListener('click', modeListener);
        _startScreenListeners.push({ element: btn, listener: modeListener });
      }
    });

    let _startingGame = false;
    bindClick('btn-start-game', async () => {
      if (_startingGame) return;
      _startingGame = true;
      const isDaily = selectedMode === MODE_IDS.DAILY;
      /** @type {Record<"capitals"|"countries"|"civilizations"|"stadiums", string>} */
      const gameModeMap = {
        capitals: isDaily ? MODE_IDS.DAILY : MODE_IDS.CLASSIC,
        countries: isDaily ? MODE_IDS.COUNTRY_DAILY : MODE_IDS.COUNTRY,
        civilizations: isDaily ? MODE_IDS.CIVILIZATION_DAILY : MODE_IDS.CIVILIZATION,
        stadiums: isDaily ? MODE_IDS.STADIUM_DAILY : MODE_IDS.STADIUM,
      };
      const gameMode = gameModeMap[selectedCategory];
      if (!gameMode) return;

      const mapSystem = getMapSystem();
      if (!mapSystem) {
        logger.error('UI: mapSystem not configured');
        return;
      }
      const needsInit = !mapSystem.isInitialized();
      const needsGeoJSON = selectedCategory === 'countries' || selectedCategory === 'civilizations';
      const needsAsyncWork = needsInit || needsGeoJSON;

      hideStart();
      if (needsAsyncWork) {
        showLoader();
        updateLoader(needsInit && needsGeoJSON ? 20 : needsInit ? 40 : 50);
      }

      try {
        if (needsInit) {
          await mapSystem.init('map');
          updateLoader(needsGeoJSON ? 50 : 100);
        }

        if (selectedCategory === 'countries') {
          const loaded = await mapSystem.loadCountriesGeoJSON();
          updateLoader(100);
          if (!loaded) {
            hideLoader();
            showToast(t('error.countriesLoadFailed'), 'error', 4000);
            showStart();
            return;
          }
        } else if (selectedCategory === 'civilizations') {
          const loaded = await mapSystem.loadCivilizationsGeoJSON();
          updateLoader(100);
          if (!loaded) {
            hideLoader();
            showToast(t('error.civilizationsLoadFailed'), 'error', 4000);
            showStart();
            return;
          }
        }

        if (needsAsyncWork) {
          hideLoader();
        }
      } catch (error) {
        handleError(error, 'map:init', { showToUser: false });
        logger.error('Error initializing game:', error);
        if (needsAsyncWork) hideLoader();
        const errorMsg =
          selectedCategory === 'countries'
            ? t('error.countriesLoadFailed')
            : selectedCategory === 'civilizations'
              ? t('error.civilizationsLoadFailed')
              : t('error.mapLoadFailed');
        showToast(errorMsg, 'error', 4000);
        showStart();
        return;
      }

      const inputSystem = getInputSystem();
      if (!inputSystem) {
        logger.error('UI: inputSystem not configured');
        return;
      }
      inputSystem.handleStartGame(gameMode);
    });

    bindClick('btn-theme', toggleTheme);
    bindClick('btn-lang', handleToggleLang);
    bindClick('btn-leaderboard', () => {
      showLeaderboardModal([], MODE_IDS.CLASSIC, true);
    });
    bindClick('btn-share-game', async () => {
      const shareText = t('shareGameMessage');
      const success = await shareGameResults(shareText);
      showToast(
        success ? t('shareCopied') : t('shareFailed'),
        success ? 'success' : 'error',
        3000,
        { compact: true }
      );
    });
    bindClick('btn-stats', showStatsModal);

    applyTheme(getTheme());
  };

  const hideStart = () => {
    deactivateFocusTrap();
    document.body.classList.remove('start-screen-visible');
    delete document.body.dataset.appReady;

    _startScreenListeners.forEach(({ element, listener }) => {
      element?.removeEventListener('click', listener);
    });
    _startScreenListeners = [];

    remove('start-modal');
    _domCache.invalidate();
    _langChangeCleanup?.();
  };

  const destroy = () => {
    _startScreenListeners.forEach(({ element, listener }) => {
      element?.removeEventListener('click', listener);
    });
    _startScreenListeners = [];
    _langChangeCleanup?.();
  };

  return {
    showStart,
    hideStart,
    showLeaderboardModal,
    showStatsModal,
    loadLeaderboard,
    destroy,
  };
};

export { loadLeaderboard };
