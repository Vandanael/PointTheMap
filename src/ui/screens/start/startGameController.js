import { MODE_IDS } from '@lib/config/game-modes.js';
import { handleError } from '../../../core/ErrorHandler.js';
import { logger } from '../../../utils/logger.js';
import { t } from '../../../i18n.js';

/**
 * @param {{
 *   getMapSystem: () => { isInitialized: () => boolean; init: (mapId: string) => Promise<boolean>; loadCountriesGeoJSON: () => Promise<boolean>; loadCivilizationsGeoJSON: () => Promise<boolean> } | null,
 *   getInputSystem: () => { handleStartGame: (gameMode: string) => void } | null,
 *   showLoader: () => void,
 *   hideLoader: () => void,
 *   updateLoader: (percent: number) => void,
 *   hideStart: () => void,
 *   showStart: () => void,
 *   showMapErrorModal: (message: string) => void,
 * }} deps
 */
export const createStartGameController = (deps) => {
  const {
    getMapSystem,
    getInputSystem,
    showLoader,
    hideLoader,
    updateLoader,
    hideStart,
    showStart,
    showMapErrorModal,
  } = deps;

  let startingGame = false;
  /** @type {ReturnType<typeof setInterval> | null} */
  let loaderInterval = null;
  let loaderProgress = 0;

  /** @param {number} percent */
  const setLoaderProgress = (percent) => {
    loaderProgress = Math.max(loaderProgress, percent);
    updateLoader(loaderProgress);
  };

  const startLoaderProgress = () => {
    if (loaderInterval) return;
    loaderProgress = Math.max(loaderProgress, 10);
    updateLoader(loaderProgress);
    loaderInterval = setInterval(() => {
      if (loaderProgress >= 90) return;
      const bump = 1 + Math.floor(Math.random() * 3);
      loaderProgress = Math.min(90, loaderProgress + bump);
      updateLoader(loaderProgress);
    }, 300);
  };

  const stopLoaderProgress = () => {
    if (loaderInterval) {
      clearInterval(loaderInterval);
      loaderInterval = null;
    }
    loaderProgress = 0;
  };

  /**
   * @param {number} [timeoutMs=4000]
   * @returns {Promise<boolean>}
   */
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

  /**
   * @param {"capitals"|"countries"|"civilizations"|"stadiums"} selectedCategory
   * @param {"classic"|"daily"} selectedMode
   */
  const handleStartGame = async (selectedCategory, selectedMode) => {
    if (startingGame) return;
    startingGame = true;

    const startBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById('btn-start-game')
    );
    const resetStartBtn = () => {
      if (!startBtn) return;
      startBtn.disabled = false;
      startBtn.removeAttribute('aria-disabled');
      startBtn.classList.remove('btn-loading');
    };

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
      resetStartBtn();
      startingGame = false;
      return;
    }

    const mapSystem = getMapSystem();
    if (!mapSystem) {
      logger.error('UI: mapSystem not configured');
      resetStartBtn();
      startingGame = false;
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
          startingGame = false;
          resetStartBtn();
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
          startingGame = false;
          resetStartBtn();
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
      startingGame = false;
      resetStartBtn();
      return;
    }

    const inputSystem = getInputSystem();
    if (!inputSystem) {
      logger.error('UI: inputSystem not configured');
      resetStartBtn();
      startingGame = false;
      return;
    }

    inputSystem.handleStartGame(gameMode);
    if (needsAsyncWork) {
      const ready = await waitForQuestionModal();
      if (!ready) {
        // Game start is slower than the wait window (e.g. slow network). Do NOT
        // re-show the start screen: handleStart owns the start->game lifecycle and
        // will render the round on success or restore the start screen on failure.
        // Re-showing it here races a late-arriving game start and overlaps both.
        logger.warn('UI: question modal did not appear in time; deferring to game lifecycle');
        stopLoaderProgress();
        resetStartBtn();
        startingGame = false;
        return;
      }
      setLoaderProgress(100);
      stopLoaderProgress();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
      hideLoader();
    }
  };

  return {
    handleStartGame,
  };
};
