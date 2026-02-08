// Start screen UI module

import { MODE_IDS } from '../../config/game-modes.js';
import { api } from '../../services/api.js';
import { getTheme, setTheme } from '../../services/storage.js';
import { toggleLang, t } from '../../i18n.js';
import { logger } from '../../utils/logger.js';
import { domCache as _domCache, render, remove, bindClick } from '../dom.js';
import { eventBus } from '../../core/EventBus.js';
import { EVENTS } from '../../core/eventTypes.js';
import { UI_TIMING } from '../../config/visual-constants.js';
import { handleError, safeAsync } from '../../core/ErrorHandler.js';
import { shareGameResults } from '../../features/Share.js';
import { analytics } from '../../services/Analytics.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../utils/focusTrap.js';
import { isLowEndDevice } from '../../utils/device.js';
import { preloadCountriesGeoJSON, preloadCivilizationsGeoJSON } from '../../data/geoDataLoader.js';
import {
  StartScreen,
  Leaderboard,
  LeaderboardModal,
  MyStatsModal,
  leaderboardTypeFromSelection,
  selectionFromLeaderboardType,
  MapErrorModal,
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
 *   getMapSystem: () => { isInitialized: () => boolean; init: (mapId: string) => Promise<boolean>; loadCountriesGeoJSON: () => Promise<boolean>; loadCivilizationsGeoJSON: () => Promise<boolean> } | null;
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
  const _geoPreloadStarted = {
    countries: false,
    civilizations: false,
  };

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
    eventBus.emit(EVENTS.THEME_CHANGED, { theme: next });
  };

  const handleToggleLang = () => {
    const newLang = toggleLang();
    const icon = _domCache.get('lang-icon');
    if (icon) icon.textContent = newLang.toUpperCase();
    eventBus.emit(EVENTS.LANGUAGE_CHANGED, { language: newLang });
  };

  /**
   * Update tab button active states in-place (no DOM recreation).
   * @param {"classic"|"daily"} variant
   * @param {"capitals"|"countries"|"stadiums"|"civilizations"} category
   */
  const updateLeaderboardTabs = (variant, category) => {
    // Variant buttons
    const variantBtns = /** @type {const} */ (['classic', 'daily']);
    variantBtns.forEach((v) => {
      const btn = /** @type {HTMLButtonElement | null} */ (
        document.getElementById(`btn-leaderboard-${v}`)
      );
      if (!btn) return;
      if (v === variant) {
        btn.className = btn.className.replace('btn-secondary', '').replace(/\s+/g, ' ').trim();
        if (!btn.classList.contains('bg-yellow-400')) {
          btn.classList.add('bg-yellow-400', 'text-black');
        }
      } else {
        btn.classList.remove('bg-yellow-400', 'text-black');
        if (!btn.classList.contains('btn-secondary')) {
          btn.classList.add('btn-secondary');
        }
      }
    });

    // Category buttons
    const categoryBtns = /** @type {const} */ ([
      'capitals',
      'countries',
      'stadiums',
      'civilizations',
    ]);
    categoryBtns.forEach((c) => {
      const btn = /** @type {HTMLButtonElement | null} */ (
        document.getElementById(`btn-leaderboard-cat-${c}`)
      );
      if (!btn) return;
      if (c === category) {
        btn.className = btn.className.replace('btn-secondary', '').replace(/\s+/g, ' ').trim();
        if (!btn.classList.contains('bg-yellow-400')) {
          btn.classList.add('bg-yellow-400', 'text-black');
        }
      } else {
        btn.classList.remove('bg-yellow-400', 'text-black');
        if (!btn.classList.contains('btn-secondary')) {
          btn.classList.add('btn-secondary');
        }
      }
    });
  };

  /** Monotonic counter to discard stale leaderboard fetches (race condition guard). */
  let _leaderboardRequestId = 0;

  /**
   * Update leaderboard content panel with fade transition.
   * @param {string} type
   */
  const updateLeaderboardContent = async (type) => {
    const contentEl = _domCache.get('leaderboard-content');
    if (!contentEl) return;

    const requestId = ++_leaderboardRequestId;

    // Fade out
    contentEl.style.opacity = '0';

    try {
      const scores = await loadLeaderboard(type);
      if (requestId !== _leaderboardRequestId) return; // stale response
      if (!document.getElementById('leaderboard-modal')) return;

      if (scores.length === 0) {
        contentEl.innerHTML = `
          <div class="leaderboard-center-state text-center py-8">
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
            updateLeaderboardContent(type);
          }
        });
      } else {
        const nextMarkup = Leaderboard(scores, null, false);
        const template = document.createElement('template');
        template.innerHTML = nextMarkup.trim();
        const nextNode = template.content.firstElementChild;
        if (nextNode instanceof HTMLElement) {
          contentEl.className = nextNode.className;
          const nextRole = nextNode.getAttribute('role');
          const nextAriaLabel = nextNode.getAttribute('aria-label');
          if (nextRole) contentEl.setAttribute('role', nextRole);
          if (nextAriaLabel) contentEl.setAttribute('aria-label', nextAriaLabel);
          contentEl.innerHTML = nextNode.innerHTML;
        }
      }
    } catch (/** @type {unknown} */ error) {
      if (requestId !== _leaderboardRequestId) return; // stale response
      handleError(error, 'leaderboard:load', { showToUser: false });
      logger.error(`Failed to load ${type} leaderboard:`, error);
      contentEl.innerHTML = `
        <div class="leaderboard-center-state text-center py-8">
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
          updateLeaderboardContent(type);
        }
      });
    }

    // Fade in
    contentEl.style.opacity = '1';

    // Re-enable all tab buttons
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
        btn.classList.remove('leaderboard-tab-loading');
      }
    });
  };

  const setupLeaderboardTabs = () => {
    /**
     * Switch tab in-place (no modal recreation).
     * @param {"classic"|"daily"} variant
     * @param {"capitals"|"countries"|"stadiums"|"civilizations"} category
     */
    const switchTo = (variant, category) => {
      _leaderboardVariant = variant;
      _leaderboardCategory = category;
      const type = leaderboardTypeFromSelection(variant, category);

      // Update button states in-place
      updateLeaderboardTabs(variant, category);

      // Update content with fade transition
      updateLeaderboardContent(type);
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
   * Show leaderboard modal with lazy loading.
   * The modal is created once; tab switches reuse it in-place.
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

    const closeLeaderboard = () => {
      deactivateFocusTrap();
      remove('leaderboard-modal');
    };

    render(
      LeaderboardModal(
        lazyLoad ? [] : initialScores,
        /** @type {"classic" | "daily"} */ (type),
        lazyLoad
      )
    );
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

    if (lazyLoad) {
      await updateLeaderboardContent(type);
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

  /**
   * @param {string} message
   */
  const showMapErrorModal = (message) => {
    remove('map-error-modal');
    render(MapErrorModal(message));
    const close = () => {
      deactivateFocusTrap();
      remove('map-error-modal');
    };
    bindClick('btn-map-error-ok', close);
    const modal = document.getElementById('map-error-modal');
    if (modal) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (modal), { onEscape: close })
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
          if (!isLowEndDevice()) {
            if (category === 'countries' && !_geoPreloadStarted.countries) {
              _geoPreloadStarted.countries = true;
              preloadCountriesGeoJSON();
            }
            if (category === 'civilizations' && !_geoPreloadStarted.civilizations) {
              _geoPreloadStarted.civilizations = true;
              preloadCivilizationsGeoJSON();
            }
          }

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
    let _loaderInterval = null;
    let _loaderProgress = 0;
    const setLoaderProgress = (percent) => {
      _loaderProgress = Math.max(_loaderProgress, percent);
      updateLoader(_loaderProgress);
    };
    const startLoaderProgress = () => {
      if (_loaderInterval) return;
      _loaderProgress = Math.max(_loaderProgress, 10);
      updateLoader(_loaderProgress);
      _loaderInterval = setInterval(() => {
        if (_loaderProgress >= 90) return;
        const bump = 1 + Math.floor(Math.random() * 3);
        _loaderProgress = Math.min(90, _loaderProgress + bump);
        updateLoader(_loaderProgress);
      }, 300);
    };
    const stopLoaderProgress = () => {
      if (_loaderInterval) {
        clearInterval(_loaderInterval);
        _loaderInterval = null;
      }
      _loaderProgress = 0;
    };
    const waitForQuestionModal = (timeoutMs = 4000) =>
      new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
          if (document.getElementById('question-modal')) {
            resolve(true);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            resolve(false);
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });
    bindClick('btn-start-game', async () => {
      if (_startingGame) return;
      _startingGame = true;
      const startBtn = /** @type {HTMLButtonElement | null} */ (
        document.getElementById('btn-start-game')
      );
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.setAttribute('aria-disabled', 'true');
        startBtn.classList.add('btn-loading');
      }
      const isDaily = selectedMode === MODE_IDS.DAILY;
      /** @type {Record<"capitals"|"countries"|"civilizations"|"stadiums", string>} */
      const gameModeMap = {
        capitals: isDaily ? MODE_IDS.DAILY : MODE_IDS.CLASSIC,
        countries: isDaily ? MODE_IDS.COUNTRY_DAILY : MODE_IDS.COUNTRY,
        civilizations: isDaily ? MODE_IDS.CIVILIZATION_DAILY : MODE_IDS.CIVILIZATION,
        stadiums: isDaily ? MODE_IDS.STADIUM_DAILY : MODE_IDS.STADIUM,
      };
      const gameMode = gameModeMap[selectedCategory];
      if (!gameMode) {
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.removeAttribute('aria-disabled');
          startBtn.classList.remove('btn-loading');
        }
        _startingGame = false;
        return;
      }

      const mapSystem = getMapSystem();
      if (!mapSystem) {
        logger.error('UI: mapSystem not configured');
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.removeAttribute('aria-disabled');
          startBtn.classList.remove('btn-loading');
        }
        _startingGame = false;
        return;
      }
      const needsInit = !mapSystem.isInitialized();
      const needsGeoJSON = selectedCategory === 'countries' || selectedCategory === 'civilizations';
      const needsAsyncWork = needsInit || needsGeoJSON;

      hideStart();
      if (needsAsyncWork) {
        showLoader();
        startLoaderProgress();
        setLoaderProgress(needsInit && needsGeoJSON ? 20 : needsInit ? 40 : 50);
      }

      try {
        if (needsInit) {
          await mapSystem.init('map');
          setLoaderProgress(needsGeoJSON ? 60 : 80);
        }

        if (selectedCategory === 'countries') {
          const loaded = await mapSystem.loadCountriesGeoJSON();
          setLoaderProgress(90);
          if (!loaded) {
            stopLoaderProgress();
            hideLoader();
            showStart();
            showMapErrorModal(t('error.countriesLoadFailed'));
            _startingGame = false;
            if (startBtn) {
              startBtn.disabled = false;
              startBtn.removeAttribute('aria-disabled');
              startBtn.classList.remove('btn-loading');
            }
            return;
          }
        } else if (selectedCategory === 'civilizations') {
          const loaded = await mapSystem.loadCivilizationsGeoJSON();
          setLoaderProgress(90);
          if (!loaded) {
            stopLoaderProgress();
            hideLoader();
            showStart();
            showMapErrorModal(t('error.civilizationsLoadFailed'));
            _startingGame = false;
            if (startBtn) {
              startBtn.disabled = false;
              startBtn.removeAttribute('aria-disabled');
              startBtn.classList.remove('btn-loading');
            }
            return;
          }
        }
      } catch (error) {
        handleError(error, 'map:init', { showToUser: false });
        logger.error('Error initializing game:', error);
        if (needsAsyncWork) {
          stopLoaderProgress();
          hideLoader();
        }
        const errorMsg =
          selectedCategory === 'countries'
            ? t('error.countriesLoadFailed')
            : selectedCategory === 'civilizations'
              ? t('error.civilizationsLoadFailed')
              : t('error.mapLoadFailed');
        showStart();
        showMapErrorModal(errorMsg);
        _startingGame = false;
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.removeAttribute('aria-disabled');
          startBtn.classList.remove('btn-loading');
        }
        return;
      }

      const inputSystem = getInputSystem();
      if (!inputSystem) {
        logger.error('UI: inputSystem not configured');
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.removeAttribute('aria-disabled');
          startBtn.classList.remove('btn-loading');
        }
        _startingGame = false;
        return;
      }
      inputSystem.handleStartGame(gameMode);
      if (needsAsyncWork) {
        const ready = await waitForQuestionModal();
        if (!ready) {
          logger.warn('UI: question modal did not appear in time');
          stopLoaderProgress();
          hideLoader();
          showStart();
          if (startBtn) {
            startBtn.disabled = false;
            startBtn.removeAttribute('aria-disabled');
            startBtn.classList.remove('btn-loading');
          }
          _startingGame = false;
          return;
        }
        setLoaderProgress(100);
        stopLoaderProgress();
        // Let the 100% state render for one frame before hiding.
        await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
        hideLoader();
      }
    });

    bindClick('btn-theme', toggleTheme);
    bindClick('btn-lang', handleToggleLang);
    bindClick('btn-leaderboard', () => {
      showLeaderboardModal([], MODE_IDS.CLASSIC, true);
    });
    bindClick('btn-share-game', async () => {
      const shareText = t('shareGameMessage');
      const success = await shareGameResults(shareText);
      analytics.track('share_clicked', { source: 'start', success });
      showToast(
        success ? t('shareCopied') : t('shareFailed'),
        success ? 'success' : 'error',
        3000,
        { compact: true }
      );
    });
    if (document.getElementById('btn-stats')) {
      bindClick('btn-stats', showStatsModal);
    }

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
