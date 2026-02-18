/**
 * Game Flow Controller — Coordinator
 *
 * Owns dependency injection and event wiring. Delegates round lifecycle management
 * to roundLifecycle.js and submit/replay flow to submitFlow.js.
 * Retains session start (handleStart) and resume (resumeFromState) which need
 * the full dependency surface.
 */

import { safeAsync } from '../core/ErrorHandler.js';
import { EVENTS } from '../core/eventTypes.js';
import { getModeStrategy } from './modeStrategies.js';
import { createRoundLifecycle } from './roundLifecycle.js';
import { createSubmitFlow } from './submitFlow.js';

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
 * @property {{ t: any, getLang: any, getCivilizationName: (id: string, fallback?: string) => string, getCountryDisplayName: (countryId: string, fallback?: string) => string, getStadiumName: (stadiumId: string, fallback?: string) => string }} i18n
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
 *   resumeFromState: (state: any) => Promise<boolean>,
 *   cleanup: () => void
 * }}
 */
export function createGameFlowController(deps) {
  /** @typedef {import('../game/Game.js').GameState} GameState */
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

  // --- Round lifecycle (map click, round end, next round) ---
  const roundLifecycle = createRoundLifecycle({
    stateManager,
    eventBus,
    mapSystem,
    timerSystem,
    inputSystem,
    scoringSystem,
    validationSystem: deps.validationSystem,
    ui,
    game,
    analytics,
    logger,
    i18n,
    config: { TIMING, MAP, isStadiumCategory, isCountryCategory, isCivilizationCategory },
  });

  const { handleMapClick, onRoundEnd, handleNext, renderRoundUI, showTargetNotFoundError } =
    roundLifecycle;

  // --- Submit flow (score submission, replay) ---
  const submitFlow = createSubmitFlow({
    stateManager,
    api,
    storage,
    game,
    stats,
    achievements,
    share,
    analytics,
    ui,
    logger,
    i18n,
    config: {
      isCapitalCategory: config.isCapitalCategory,
      isCountryCategory,
      isStadiumCategory,
      isCivilizationCategory,
      isDailyVariant,
      MODE_IDS,
    },
    validationSystem: deps.validationSystem,
    timerSystem,
    inputSystem,
    mapSystem,
    MAP,
  });

  const { handleSubmit, handleReplay, cleanup } = submitFlow;

  // --- Session start (coordinator-level: full dep surface) ---

  /**
   * Handle game start
   * @param {string} [gameType="classic"]
   */
  const handleStart = async (gameType = MODE_IDS.CLASSIC) => {
    ui.hideStart();
    // Show loader while fetching game data
    ui.showLoader();

    mapSystem.clearMap();
    const { center: startCenter, zoom: startZoom } = getModeStrategy(gameType).getMapView(MAP);
    mapSystem.flyTo(startCenter, startZoom, { animate: false });

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
    const targetCount = Array.isArray(state.targets) ? state.targets.length : 0;
    eventBus.emit(EVENTS.GAME_STARTED, {
      gameType,
      capitalCount: targetCount,
    });

    const target = game.getCurrentTarget(state);

    if (!target || !target.name) {
      showTargetNotFoundError(state.gameType);
      ui.hideQuestion();
      return;
    }

    if (state.currentRoundIndex === 0) {
      renderRoundUI(state, { requireButton: true });
    } else {
      renderRoundUI(state);
    }
  };

  /**
   * Resume an in-progress game state after reload.
   * @param {GameState} savedState
   * @returns {Promise<boolean>}
   */
  const resumeFromState = async (savedState) => {
    if (!savedState) return false;

    if (!mapSystem.isInitialized()) {
      await mapSystem.init('map');
    }
    const strategy = getModeStrategy(savedState.gameType);
    await strategy.loadGeoData(mapSystem);

    if (savedState.status === GameStatus.PLAYING) {
      // Reset round timing to avoid immediate timeout on resume
      const refreshedState = {
        ...savedState,
        currentRound: savedState.currentRound
          ? {
              ...savedState.currentRound,
              startTime: Date.now(),
              endTime: null,
              status: GameStatus.PLAYING,
            }
          : null,
      };

      ui.hideStart();
      mapSystem.clearMap();
      const { center: startCenter, zoom: startZoom } = strategy.getMapView(MAP);
      mapSystem.flyTo(startCenter, startZoom, { animate: false });

      stateManager.setState(/** @type {GameState} */ (refreshedState), 'game:resume');
      return renderRoundUI(/** @type {GameState} */ (refreshedState), { requireButton: true });
    }

    if (savedState.status === GameStatus.ROUND_RESULT) {
      if (!savedState.currentRound) return false;
      ui.hideStart();
      ui.hideQuestion();
      ui.hideRoundResult();
      mapSystem.clearMap();

      const { center: startCenter, zoom: startZoom } = strategy.getMapView(MAP);
      mapSystem.flyTo(startCenter, startZoom, { animate: false });

      stateManager.setState(/** @type {GameState} */ (savedState), 'game:resume');

      const progress = game.getProgress(savedState);
      ui.showGameUI(progress.current, progress.total, savedState.totalScore);

      const currentRound = savedState.currentRound;
      const displayDistance = strategy.getDisplayDistance(currentRound);

      ui.showRoundResult(
        currentRound.status === 'timeout' ? null : displayDistance,
        currentRound.score ?? 0,
        currentRound.status === 'timeout',
        game.isLastRound(savedState),
        currentRound.baseScore,
        currentRound.timeBonus
      );
      return true;
    }

    if (savedState.status === GameStatus.GAME_OVER) {
      ui.hideStart();
      ui.hideQuestion();
      ui.hideRoundResult();
      mapSystem.clearMap();
      stateManager.setState(/** @type {GameState} */ (savedState), 'game:resume');
      ui.showGameOver(savedState.totalScore);
      return true;
    }

    return false;
  };

  return {
    handleStart,
    handleMapClick,
    onRoundEnd,
    handleNext,
    handleSubmit,
    handleReplay,
    resumeFromState,
    cleanup,
  };
}
