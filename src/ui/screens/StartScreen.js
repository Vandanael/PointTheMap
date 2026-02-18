// Start screen UI module

import { MODE_IDS } from '@lib/config/game-modes.js';
import { api } from '../../services/api.js';
import { getTheme, setTheme } from '../../services/storage.js';
import { toggleLang, t } from '../../i18n.js';
import { domCache as _domCache, render, remove, bindClick } from '../dom.js';
import { eventBus } from '../../core/EventBus.js';
import { EVENTS } from '../../core/eventTypes.js';
import { safeAsync } from '../../core/ErrorHandler.js';
import { shareGameResults } from '../../features/Share.js';
import { analytics } from '../../services/Analytics.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../utils/focusTrap.js';
import { StartScreen, MyStatsModal, MapErrorModal } from '../components.js';
import { getStats } from '../../features/StatsManager.js';
import { createLeaderboardController } from './start/leaderboardController.js';
import { createSelectionController } from './start/selectionController.js';
import { createStartGameController } from './start/startGameController.js';

const LEADERBOARD_TIMEOUT_MS = 10000; // 10 seconds timeout

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

  // Track start screen listeners for cleanup
  /** @type {Array<{ element: HTMLElement; type: keyof HTMLElementEventMap; listener: EventListener }>} */
  let _startScreenListeners = [];
  /** @type {null | (() => void)} */
  let _langChangeCleanup = null;
  const _geoPreloadStarted = {
    countries: false,
    civilizations: false,
  };

  const leaderboardController = createLeaderboardController({
    loadLeaderboard,
    onRetryLeaderboard,
  });

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
    const unsubscribe = eventBus.subscribe(EVENTS.LANGUAGE_CHANGED, () => {
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

    const selectionController = createSelectionController({
      geoPreloadStarted: _geoPreloadStarted,
      registerListener: (entry) => _startScreenListeners.push(entry),
    });
    selectionController.bindControls();

    const startGameController = createStartGameController({
      getMapSystem,
      getInputSystem,
      showLoader,
      hideLoader,
      updateLoader,
      hideStart,
      showStart,
      showMapErrorModal,
    });
    bindClick('btn-start-game', () =>
      startGameController.handleStartGame(
        selectionController.getSelectedCategory(),
        selectionController.getSelectedMode()
      )
    );

    bindClick('btn-theme', toggleTheme);
    bindClick('btn-lang', handleToggleLang);
    bindClick('btn-leaderboard', () => {
      leaderboardController.showLeaderboardModal([], MODE_IDS.CLASSIC, true);
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

    _startScreenListeners.forEach(({ element, type, listener }) => {
      element?.removeEventListener(type, listener);
    });
    _startScreenListeners = [];

    remove('start-modal');
    _domCache.invalidate();
    _langChangeCleanup?.();
  };

  const destroy = () => {
    _startScreenListeners.forEach(({ element, type, listener }) => {
      element?.removeEventListener(type, listener);
    });
    _startScreenListeners = [];
    _langChangeCleanup?.();
  };

  return {
    showStart,
    hideStart,
    showLeaderboardModal: leaderboardController.showLeaderboardModal,
    showStatsModal,
    loadLeaderboard,
    destroy,
  };
};

export { loadLeaderboard };
