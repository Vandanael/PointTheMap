/**
 * Game Flow Controller
 *
 * Orchestrates game flow sequences: start, map click, round end, next round,
 * submit, and replay. Handles branching logic per game mode (capital, country,
 * stadium, civilization) and coordinates systems/UI/state updates.
 */

import { safeAsync, handleError, APIError } from '../core/ErrorHandler.js';
import { createMapQueryAdapter, createRoundRulesAdapter } from '../game/ports.js';
import { MAP_ANIMATIONS } from '../config/visual-constants.js';

/**
 * @typedef {Object} GameFlowDeps
 * @property {import('../core/StateManager.js').StateManager} stateManager
 * @property {typeof import('../core/EventBus.js').eventBus} eventBus
 * @property {typeof import('../systems/MapSystem.js').mapSystem} mapSystem
 * @property {typeof import('../systems/TimerSystem.js').timerSystem} timerSystem
 * @property {typeof import('../systems/InputSystem.js').inputSystem} inputSystem
 * @property {typeof import('../systems/ScoringSystem.js').scoringSystem} scoringSystem
 * @property {typeof import('../systems/ValidationSystem.js').validationSystem} validationSystem
 * @property {typeof import('../ui/UI.js').UI} ui
 * @property {{ startGame: any, playRound: any, handleTimeout: any, nextRound: any, getCurrentTarget: any, isLastRound: any, getProgress: any, checkIfNewSessionBest: any, updateSessionBestScore: any, resetGame: any, GameStatus: any }} game
 * @property {{ getRemainingTime: any }} round
 * @property {{ submitWithRetry: any }} api
 * @property {{ setLastPseudo: any }} storage
 * @property {{ updateStats: any, getStats: any }} stats
 * @property {{ checkAchievements: any }} achievements
 * @property {{ formatShareText: any, shareGameResults: any, getDailyNumber: any }} share
 * @property {{ track: any }} analytics
 * @property {typeof import('../utils/logger.js').logger} logger
 * @property {{ t: any, getLang: any }} i18n
 * @property {{ TIMING: any, MAP: any, MODE_IDS: any, isDailyVariant: any, isCapitalCategory: any, isStadiumCategory: any, isCountryCategory: any, isCivilizationCategory: any }} config
 */

/**
 * Create a game flow controller
 * @param {GameFlowDeps} deps - Dependencies
 * @returns {{
 *   handleStart: (gameType?: string) => Promise<void>,
 *   handleMapClick: (coords: [number, number]) => void,
 *   onRoundEnd: () => Promise<void>,
 *   handleNext: () => void,
 *   handleSubmit: (pseudo: string) => Promise<void>,
 *   handleReplay: () => void,
 *   cleanup: () => void
 * }}
 */
export function createGameFlowController(deps) {
  /** @typedef {import('../game/Game.js').GameState} GameState */
  /** @typedef {import('../game/Game.js').Round} Round */
  const {
    stateManager,
    eventBus,
    mapSystem,
    timerSystem,
    inputSystem,
    scoringSystem,
    ui,
    game,
    api,
    storage,
    stats,
    achievements,
    share,
    analytics,
    logger,
    i18n,
    config,
  } = deps;

  const {
    TIMING,
    MAP,
    MODE_IDS,
    isDailyVariant,
    isStadiumCategory,
    isCountryCategory,
    isCivilizationCategory,
  } = config;
  const { GameStatus } = game;

  // Create port adapters for game core dependencies
  const mapQuery = createMapQueryAdapter(mapSystem);
  const roundRules = createRoundRulesAdapter(deps.validationSystem, scoringSystem);

  // Store share button handler for cleanup
  /** @type {(() => void) | null} */
  let shareButtonHandler = null;

  /**
   * Start timer for current round
   */
  const startTimer = () => {
    ui.resetTimer();
    /** @type {GameState} */
    const state = stateManager.getState();
    timerSystem.start(state.runtimeConfig ?? undefined);
  };

  /**
   * Stop timer
   */
  const stopTimer = () => {
    timerSystem.stop();
  };

  /**
   * Show localized "target not found" error for the given game type.
   * @param {string} gameType
   */
  function showTargetNotFoundError(gameType) {
    const errorKey = isCountryCategory(gameType)
      ? 'error.targetNotFoundCountry'
      : isStadiumCategory(gameType)
        ? 'error.targetNotFoundStadium'
        : isCivilizationCategory(gameType)
          ? 'error.targetNotFoundCivilization'
          : 'error.targetNotFoundCapital';
    ui.showError(i18n.t(errorKey));
  }

  /**
   * Handle game start
   * @param {string} [gameType="classic"]
   */
  const handleStart = async (gameType = MODE_IDS.CLASSIC) => {
    ui.hideStart();
    // Show loader while fetching game data
    ui.showLoader();

    mapSystem.clearMap();
    const startCenter = /** @type {[number, number]} */ (
      isStadiumCategory(gameType) ? MAP.EUROPE_CENTER : MAP.CENTER
    );
    const startZoom = isStadiumCategory(gameType) ? MAP.EUROPE_ZOOM : MAP.ZOOM;
    mapSystem.flyTo(startCenter, startZoom, { animate: false }); // civilization uses world view (same as country)

    const newState = await safeAsync(
      () => game.startGame(stateManager.getState(), gameType),
      'game:start',
      null
    );

    // Hide loader
    ui.hideLoader();

    if (!newState) {
      // Error already handled by errorHandler — recover by showing start screen
      ui.showStart();
      return;
    }
    stateManager.setState(newState, `game:start:${gameType}`);

    /** @type {GameState} */
    const state = stateManager.getState();
    if (state.status !== GameStatus.PLAYING) {
      if (state.error) ui.showToast(i18n.t(state.error), 'error', 4000);
      ui.showStart();
      return;
    }

    // Track game start
    analytics.track('game_started', {
      gameType,
      roundCount: state.runtimeConfig?.roundCount || 5,
    });

    logger.debug('[Game Start]', {
      gameType: state.gameType,
      roundCount: state.runtimeConfig?.roundCount,
    });

    // Emit game started event
    eventBus.emit('game:started', {
      gameType,
      capitalCount: state.targets?.length || state.capitals.length || state.countries.length,
    });

    const target = game.getCurrentTarget(state);
    const isCountryMode = isCountryCategory(state.gameType);
    const isStadiumMode = isStadiumCategory(state.gameType);
    const isCivilizationMode = isCivilizationCategory(state.gameType);

    if (!target || !target.name) {
      showTargetNotFoundError(state.gameType);
      ui.hideQuestion();
      return;
    }

    const progress = game.getProgress(state);

    ui.showGameUI(progress.current, progress.total, state.totalScore);

    const onReady = () => {
      startTimer();
      // MapSystem emits map:click, InputSystem listens to it
      mapSystem.enableClicks(() => {}); // Empty callback, InputSystem handles via EventBus
      inputSystem.enableMapInput(handleMapClick);
    };

    // Update modal with real data
    // For country/civilization mode: show name only
    // For stadium mode: show stadium name only (no city)
    // For capital mode: show capital name + country
    const displayName = target.name;
    const displaySubtitle =
      isCountryMode || isCivilizationMode
        ? ''
        : isStadiumMode
          ? ''
          : target && 'country' in target
            ? target.country
            : '';

    if (state.currentRoundIndex === 0) {
      ui.showQuestion(displayName, displaySubtitle, onReady, { requireButton: true });
    } else {
      ui.showQuestion(displayName, displaySubtitle, onReady);
    }
  };

  /**
   * Handle map click
   * @param {[number, number]} coords - [lat, lng] coordinates
   */
  const handleMapClick = (coords) => {
    /** @type {GameState} */
    const state = stateManager.getState();
    if (state.status !== GameStatus.PLAYING) return;
    // Stop timer to prevent timeout events from firing
    stopTimer();
    stateManager.setState(game.playRound(state, coords, mapQuery, roundRules), 'round:click');
    onRoundEnd();
  };

  /**
   * Handle round end - shows results and waits for user to continue
   */
  const onRoundEnd = async () => {
    const state = stateManager.getState();

    // Guard: Only process if we're in ROUND_RESULT status (prevents double execution)
    if (state.status !== GameStatus.ROUND_RESULT) {
      return;
    }

    mapSystem.disableClicks();
    inputSystem.disableMapInput();
    stopTimer();

    const currentRound = state.currentRound;
    const isCountryMode = isCountryCategory(state.gameType);
    const isStadiumMode = isStadiumCategory(state.gameType);
    const isCivilizationMode = isCivilizationCategory(state.gameType);

    if (!currentRound) return;
    if (isCountryMode && !currentRound.country) return;
    if (isStadiumMode && !currentRound.stadium) return;
    if (isCivilizationMode && !currentRound.civilization) return;
    if (!isCountryMode && !isStadiumMode && !isCivilizationMode && !currentRound.capital) return;

    // Emit round completed event
    eventBus.emit('game:round:completed', { round: currentRound });

    if (
      currentRound.click &&
      currentRound.click.lat !== null &&
      currentRound.click.lat !== undefined &&
      currentRound.click.lng !== null &&
      currentRound.click.lng !== undefined
    ) {
      const clickCoords = /** @type {[number, number]} */ ([
        currentRound.click.lat,
        currentRound.click.lng,
      ]);

      if (isCountryMode) {
        // Country mode: Highlight countries instead of showing markers
        mapSystem.addClickMarker(clickCoords);
        mapSystem.highlightCountries({
          correctCountryId: currentRound.correctCountryId,
          clickedCountryId: currentRound.clickedCountryId,
        });
        // Slow zoom to the click location (do not center on the answer).
        if (!mapSystem.isInView(clickCoords, 0.1)) {
          mapSystem.flyTo(clickCoords, undefined, MAP_ANIMATIONS.SHOW_RESULT);
        }
      } else if (isCivilizationMode) {
        // Civilization mode: highlight zones + show click marker
        mapSystem.addClickMarker(clickCoords);
        mapSystem.highlightCivilizations({
          correctCivilizationId: currentRound.correctCivilizationId,
          clickedCivilizationId: currentRound.clickedCivilizationId,
        });
        // Slow zoom to the click location (do not center on the answer).
        if (!mapSystem.isInView(clickCoords, 0.1)) {
          mapSystem.flyTo(clickCoords, undefined, MAP_ANIMATIONS.SHOW_RESULT);
        }
      } else if (isStadiumMode) {
        // Stadium mode: Show stadium markers and line (same as capital)
        const stadiumCoords = /** @type {[number, number]} */ ([
          currentRound.stadium.lat,
          currentRound.stadium.lng,
        ]);
        await mapSystem.showRoundResult(clickCoords, stadiumCoords, currentRound.distance || 0);
      } else {
        // Capital mode: Show capital markers and line
        const capitalCoords = /** @type {[number, number]} */ ([
          currentRound.capital.lat,
          currentRound.capital.lng,
        ]);
        await mapSystem.showRoundResult(clickCoords, capitalCoords, currentRound.distance || 0);
      }

      // Tap/click to continue to modal, or wait RESULT_READ_TIME_MS
      /** @type {Promise<void>} */
      const userContinued = new Promise((r) => mapSystem.setOnResultContinue(() => r()));
      /** @type {Promise<void>} */
      const timeoutPromise = new Promise((r) => setTimeout(r, TIMING.RESULT_READ_TIME_MS));
      await Promise.race([userContinued, timeoutPromise]);
      mapSystem.clearOnResultContinue();

      // Emit score updated event
      eventBus.emit('score:updated', {
        oldScore: state.totalScore - currentRound.score,
        newScore: state.totalScore,
        delta: currentRound.score,
      });

      // For country/civilization mode, distance is always computed (including when clicking water)
      const displayDistance =
        isCountryMode || isCivilizationMode
          ? (currentRound.distance ?? currentRound.distanceToTargetKm ?? 0)
          : currentRound.distance;
      ui.showRoundResult(
        displayDistance,
        currentRound.score,
        currentRound.status === 'timeout',
        game.isLastRound(state),
        currentRound.baseScore,
        currentRound.timeBonus
      );
    } else if (currentRound.status === 'timeout') {
      // Timeout with no click: reveal correct target so the player learns where it was
      if (isCountryMode && currentRound.country) {
        mapSystem.highlightCountries({
          correctCountryId: currentRound.country.countryId,
          clickedCountryId: null,
        });
      } else if (isCivilizationMode && currentRound.civilization) {
        mapSystem.highlightCivilizations({
          correctCivilizationId: currentRound.civilization.id,
          clickedCivilizationId: null,
        });
      } else if (isStadiumMode && currentRound.stadium) {
        mapSystem.addCapitalMarker(
          /** @type {[number, number]} */ ([currentRound.stadium.lat, currentRound.stadium.lng])
        );
      } else if (currentRound.capital) {
        mapSystem.addCapitalMarker(
          /** @type {[number, number]} */ ([currentRound.capital.lat, currentRound.capital.lng])
        );
      }

      /** @type {Promise<void>} */
      const userContinuedTimeout = new Promise((r) => mapSystem.setOnResultContinue(() => r()));
      /** @type {Promise<void>} */
      const timeoutPromiseResult = new Promise((r) => setTimeout(r, TIMING.RESULT_READ_TIME_MS));
      await Promise.race([userContinuedTimeout, timeoutPromiseResult]);
      mapSystem.clearOnResultContinue();

      ui.showRoundResult(
        null,
        currentRound.score,
        true,
        game.isLastRound(state),
        currentRound.baseScore,
        currentRound.timeBonus
      );
    }
  };

  /**
   * Handle next round
   */
  const handleNext = () => {
    ui.hideRoundResult();
    mapSystem.clearMap(); // Nettoie tous les markers (y compris les capitales)

    let state = stateManager.getState();

    if (game.isLastRound(state)) {
      ui.showGameOver(state.totalScore);
      return;
    }

    stateManager.setState(game.nextRound(state), 'round:next');
    state = stateManager.getState();

    const nextCenter = /** @type {[number, number]} */ (
      isStadiumCategory(state.gameType) ? MAP.EUROPE_CENTER : MAP.CENTER
    );
    const nextZoom = isStadiumCategory(state.gameType) ? MAP.EUROPE_ZOOM : MAP.ZOOM;
    mapSystem.flyTo(nextCenter, nextZoom, { animate: false });

    const target = game.getCurrentTarget(state);
    const isCountryMode = isCountryCategory(state.gameType);
    const isStadiumMode = isStadiumCategory(state.gameType);
    const isCivilizationMode = isCivilizationCategory(state.gameType);

    if (!target || !target.name) {
      showTargetNotFoundError(state.gameType);
      return;
    }

    const progress = game.getProgress(state);
    ui.updateGameUI(progress.current, progress.total, state.totalScore);

    // For country/civilization: show name only; stadium: name only; capital: name + country
    const displayName = target.name;
    const displaySubtitle =
      isCountryMode || isCivilizationMode
        ? ''
        : isStadiumMode
          ? ''
          : target && 'country' in target
            ? target.country
            : '';

    ui.resetTimer();
    ui.showQuestion(displayName, displaySubtitle, () => {
      startTimer();
      mapSystem.enableClicks(() => {}); // Empty callback, InputSystem handles via EventBus
      inputSystem.enableMapInput(handleMapClick);
    });
  };

  const PSEUDO_LOCK_ERROR = 'pseudo_already_set_for_this_ip';
  const MAX_SUBMIT_ATTEMPTS = 2; // initial attempt + one retry on 409

  /**
   * Handle submit score
   * @param {string} pseudo
   */
  const handleSubmit = async (pseudo) => {
    const submitBtn = /** @type {HTMLButtonElement | null} */ (
      document.getElementById('btn-submit')
    );
    const setButtonSaving = () => {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = i18n.t('saving');
      }
    };
    const restoreSubmitButton = () => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = i18n.t('save');
      }
    };

    /** @type {any} */
    let lastError = null;
    let currentPseudo = pseudo;

    for (let attempt = 0; attempt < MAX_SUBMIT_ATTEMPTS; attempt++) {
      setButtonSaving();
      try {
        /** @type {GameState} */
        const state = stateManager.getState();
        /** @type {import('../game/Game.js').SubmitResult} */
        const result = await api.submitWithRetry(
          state.token,
          state.rounds,
          currentPseudo,
          state.gameType
        );
        storage.setLastPseudo(currentPseudo);

        const isNewBest = game.checkIfNewSessionBest(state, result.score);
        stateManager.setState(game.updateSessionBestScore(state, result.score), 'score:submit');

        // Update stats and check achievements
        const updatedStats = stats.updateStats(state.rounds, state.gameType);
        achievements.checkAchievements(state.rounds, updatedStats, result.rank);

        ui.showFinalResults(result.score, currentPseudo, result, isNewBest);

        // Track game completion
        analytics.track('game_completed', {
          totalScore: result.score,
          gameType: state.gameType,
          rounds: state.rounds.length,
          rank: result.rank,
          isTopFifty: result.isTopFifty,
          isNewSessionBest: isNewBest,
        });

        // Bind share button (after UI.showFinalResults renders the button)
        const shareBtn = document.getElementById('btn-share');
        if (shareBtn) {
          if (shareButtonHandler) {
            shareBtn.removeEventListener('click', shareButtonHandler);
          }
          shareButtonHandler = async () => {
            const avgDistance =
              state.rounds.reduce(
                (/** @type {number} */ sum, /** @type {any} */ r) => sum + (r.distance || 0),
                0
              ) / state.rounds.length;
            const currentStats = stats.getStats();
            const dailyDateKey =
              state.gameType === MODE_IDS.COUNTRY_DAILY
                ? 'lastCountryDailyDate'
                : state.gameType === MODE_IDS.STADIUM_DAILY
                  ? 'lastStadiumDailyDate'
                  : state.gameType === MODE_IDS.CIVILIZATION_DAILY
                    ? 'lastCivilizationDailyDate'
                    : 'lastDailyDate';
            const dailyNumber = isDailyVariant(state.gameType)
              ? share.getDailyNumber(currentStats[dailyDateKey])
              : null;
            const shareText = share.formatShareText(
              dailyNumber,
              avgDistance,
              state.rounds,
              i18n.getLang()
            );
            const success = await share.shareGameResults(shareText);
            ui.showToast(
              success ? i18n.t('shareCopied') : i18n.t('shareFailed'),
              success ? 'success' : 'error',
              3000,
              { compact: true }
            );
          };
          shareBtn.addEventListener('click', shareButtonHandler);
        }
        return;
      } catch (error) {
        const err = /** @type {any} */ (error);
        const is409Lock = err.status === 409 && err.data?.error === PSEUDO_LOCK_ERROR;
        const canRetry409 = attempt < MAX_SUBMIT_ATTEMPTS - 1;

        if (is409Lock && canRetry409) {
          restoreSubmitButton();
          await new Promise((resolve) => {
            ui.showPseudoLockedDialog(err.data.pseudo, () => resolve(undefined));
          });
          currentPseudo = err.data.pseudo;
          continue;
        }
        lastError = err;
        break;
      }
    }

    restoreSubmitButton();
    if (lastError) {
      if (lastError.status === 409 && lastError.data?.error === PSEUDO_LOCK_ERROR) {
        ui.showPseudoLockedDialog(lastError.data.pseudo, () => {});
      } else {
        const apiError = new APIError(
          lastError.message || i18n.t('error.submitError'),
          lastError.status || 500,
          lastError.data
        );
        handleError(apiError, 'score:submit', { showToUser: true, fatal: false });
      }
    }
  };

  /**
   * Handle replay
   */
  const handleReplay = () => {
    stateManager.setState(game.resetGame(), 'game:reset');
    mapSystem.clearMap();
    mapSystem.flyTo(/** @type {[number, number]} */ (MAP.CENTER), MAP.ZOOM, { animate: false });
    ui.hideGameUI(); // Clear game header and timer from previous game
    ui.hideGameOver();
    // Clean up share button handler
    shareButtonHandler = null;
    ui.showStart();
  };

  /**
   * Cleanup handlers
   */
  const cleanup = () => {
    if (shareButtonHandler) {
      const shareBtn = document.getElementById('btn-share');
      if (shareBtn) {
        shareBtn.removeEventListener('click', shareButtonHandler);
      }
      shareButtonHandler = null;
    }
  };

  return {
    handleStart,
    handleMapClick,
    onRoundEnd,
    handleNext,
    handleSubmit,
    handleReplay,
    cleanup,
  };
}
