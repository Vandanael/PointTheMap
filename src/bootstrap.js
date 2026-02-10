/// <reference types="vite/client" />
import { TIMING, MAP } from '@lib/config/index.js';
import {
  MODE_IDS,
  isDailyVariant,
  isCapitalCategory,
  isStadiumCategory,
  isCountryCategory,
  isCivilizationCategory,
} from '@lib/config/game-modes.js';
import { setLastPseudo } from './services/storage.js';
import { logger } from './utils/logger.js';
import { eventBus } from './core/EventBus.js';
import { EVENTS } from './core/eventTypes.js';
import { StateManager } from './core/StateManager.js';
import { mapSystem } from './systems/MapSystem.js';
import {
  createGameState,
  startGame,
  playRound,
  handleTimeout as gameHandleTimeout,
  nextRound,
  getCurrentTarget,
  isLastRound,
  getProgress,
  GameStatus,
  checkIfNewSessionBest,
  updateSessionBestScore,
  resetGame,
} from './game/Game.js';
import { getRemainingTime } from './game/Round.js';
import { UI, configureUI } from './ui/UI.js';
import { processRetryQueue, submitWithRetry } from './services/api.js';
import {
  saveInProgressGame,
  loadInProgressGame,
  clearInProgressGame,
} from './services/gameStatePersistence.js';
import { timerSystem } from './systems/TimerSystem.js';
import { getUISystem } from './systems/UISystem.js';
import { inputSystem } from './systems/InputSystem.js';
import { scoringSystem } from './systems/ScoringSystem.js';
import { validationSystem } from './systems/ValidationSystem.js';
import { analytics } from './services/Analytics.js';
import { errorMonitoring } from './services/ErrorMonitoring.js';
import { errorHandler } from './core/ErrorHandler.js';
import { updateStats, getStats } from './features/StatsManager.js';
import { checkAchievements } from './features/AchievementManager.js';
import { formatShareText, shareGameResults, getDailyNumber } from './features/Share.js';
import { getLang, t, getCivilizationName } from './i18n.js';

// Import new modules
import { initLifecycle } from './app/lifecycle.js';
import { createGameFlowController } from './app/gameFlowController.js';
import { createAchievementPresenter } from './features/achievements/achievementPresenter.js';

// State Management
const stateManager = new StateManager(createGameState());

// Track event subscriptions for cleanup
/** @type {Array<() => void>} */
const eventUnsubscribers = [];

// Initialize DevTools in dev mode (dynamic import to exclude from production bundle)
if (import.meta.env?.DEV) {
  import('./core/StateDevTools.js').then(({ StateDevTools }) => {
    new StateDevTools(stateManager);
  });
}

/**
 * Initialize application
 */
export const initApp = async () => {
  try {
    if (document.body) document.body.dataset.appInit = 'true';
    const uiSystem = getUISystem();
    // Initialize lifecycle management (iOS viewport, retry queue, network indicators)
    const lifecycle = initLifecycle({
      ui: UI,
      mapSystem,
      uiSystem,
      inputSystem,
      scoringSystem,
      api: { processRetryQueue },
      errorMonitoring,
      analytics,
      logger,
      i18n: { t },
      errorHandler,
    });

    // Register state validators
    stateManager.registerValidator('totalScore', (/** @type {unknown} */ value) => {
      if (typeof value !== 'number') return 'totalScore must be a number';
      if (value < 0) return 'totalScore cannot be negative';
      if (!Number.isFinite(value)) return 'totalScore must be finite';
      return true;
    });

    stateManager.registerValidator('status', (/** @type {unknown} */ value) => {
      const valid = Object.values(GameStatus);
      // @ts-ignore - value is checked against valid array
      if (!valid.includes(value)) {
        return `status must be one of: ${valid.join(', ')}`;
      }
      return true;
    });

    // Create game flow controller
    const controller = createGameFlowController({
      stateManager,
      eventBus,
      mapSystem,
      timerSystem,
      inputSystem,
      scoringSystem,
      validationSystem,
      ui: UI,
      game: {
        startGame,
        playRound,
        handleTimeout: gameHandleTimeout,
        nextRound,
        getCurrentTarget,
        isLastRound,
        getProgress,
        checkIfNewSessionBest,
        updateSessionBestScore,
        resetGame,
        GameStatus,
      },
      round: { getRemainingTime },
      api: { submitWithRetry },
      storage: { setLastPseudo },
      stats: { updateStats, getStats },
      achievements: { checkAchievements },
      share: { formatShareText, shareGameResults, getDailyNumber },
      analytics,
      logger,
      i18n: { t, getLang, getCivilizationName },
      config: {
        TIMING,
        MAP,
        MODE_IDS,
        isDailyVariant,
        isCapitalCategory,
        isStadiumCategory,
        isCountryCategory,
        isCivilizationCategory,
      },
    });

    // Create achievement presenter
    const achievementPresenter = createAchievementPresenter({
      ui: UI,
      i18n: { t },
      share: { shareGameResults },
      analytics,
    });

    // Subscribe to timer game logic events
    eventUnsubscribers.push(
      /** @type {() => void} */ (
        eventBus.subscribe(
          EVENTS.TIMER_TIMEOUT,
          (/** @type {{ roundId?: number | null }} */ payload) => {
            const state = stateManager.getState();
            if (
              payload?.roundId !== undefined &&
              payload?.roundId !== null &&
              state.currentRound?.roundId !== payload.roundId
            ) {
              return;
            }
            if (state.status === GameStatus.PLAYING && state.currentRound) {
              // Stop timer to prevent tick handler from also firing
              timerSystem.stop();
              const newState = gameHandleTimeout(state);
              stateManager.setState(newState, 'timer:timeout');

              // Only call onRoundEnd if state was actually changed (guard against race condition)
              if (newState.status === GameStatus.ROUND_RESULT) {
                controller.onRoundEnd();
              }
            }
          }
        )
      )
    );

    eventUnsubscribers.push(
      /** @type {() => void} */ (
        eventBus.subscribe(
          EVENTS.TIMER_TICK,
          (/** @type {{ roundId?: number | null }} */ payload) => {
            const state = stateManager.getState();
            if (
              payload?.roundId !== undefined &&
              payload?.roundId !== null &&
              state.currentRound?.roundId !== payload.roundId
            ) {
              return;
            }
            if (state.status !== GameStatus.PLAYING || !state.currentRound) {
              timerSystem.stop();
              return;
            }
            const totalTimeAllowed = state.runtimeConfig
              ? state.runtimeConfig.timerMs + state.runtimeConfig.graceMs
              : undefined;
            const remaining = getRemainingTime(state.currentRound, totalTimeAllowed);
            if (remaining <= 0) {
              // Stop timer to prevent timer:timeout handler from also firing
              timerSystem.stop();
              const newState = gameHandleTimeout(state);
              stateManager.setState(newState, 'timer:tick:timeout');

              // Only call onRoundEnd if state was actually changed (guard against race condition)
              if (newState.status === GameStatus.ROUND_RESULT) {
                controller.onRoundEnd();
              }
            }
          }
        )
      )
    );

    // Initialize UI system (handles all UI-related EventBus subscriptions)
    configureUI({ inputSystem, validationSystem, mapSystem });
    UI.init();
    uiSystem.init();
    // Initialize Input system
    inputSystem.init();
    // Initialize Scoring system
    scoringSystem.init();

    // Subscribe to InputSystem events
    const unsubscribeStartGame = eventBus.subscribe(
      EVENTS.INPUT_START_GAME,
      (/** @type {{ gameType?: "classic" | "daily" }} */ { gameType }) => {
        controller.handleStart(gameType || MODE_IDS.CLASSIC);
      }
    );
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeStartGame));

    const unsubscribeNextRound = eventBus.subscribe(EVENTS.INPUT_NEXT_ROUND, () => {
      controller.handleNext();
    });
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeNextRound));

    const unsubscribeSubmit = eventBus.subscribe(
      EVENTS.INPUT_SUBMIT,
      (/** @type {{ pseudo: string }} */ { pseudo }) => {
        controller.handleSubmit(pseudo);
      }
    );
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeSubmit));

    const unsubscribeReplay = eventBus.subscribe(EVENTS.INPUT_REPLAY, () => {
      controller.handleReplay();
    });
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeReplay));

    // Game abandoned: track when user leaves (tab hidden / page unload) while a game is in progress
    let gameAbandonTracked = false;
    const unsubStateForAbandon = eventBus.subscribe(
      EVENTS.STATE_CHANGED,
      (/** @type {{ state: { status: string } }} */ { state }) => {
        if (state?.status !== GameStatus.PLAYING) gameAbandonTracked = false;
        // Persist in-progress game state (best-effort)
        if (
          state?.status === GameStatus.PLAYING ||
          state?.status === GameStatus.ROUND_RESULT ||
          state?.status === GameStatus.GAME_OVER
        ) {
          saveInProgressGame(state);
        } else {
          clearInProgressGame();
        }
      }
    );
    eventUnsubscribers.push(/** @type {() => void} */ (unsubStateForAbandon));

    const trackGameAbandonedIfNeeded = () => {
      if (document.visibilityState !== 'hidden') return;
      const state = stateManager.getState();
      if (state.status !== GameStatus.PLAYING || gameAbandonTracked) return;
      gameAbandonTracked = true;
      const roundIndex =
        Number.isFinite(state.currentRoundIndex) && state.currentRoundIndex >= 0
          ? state.currentRoundIndex + 1
          : 0;
      analytics.track('game_abandoned', {
        gameType: state.gameType,
        round: roundIndex,
        totalRounds: state.runtimeConfig?.roundCount ?? 5,
      });
    };

    window.addEventListener('visibilitychange', trackGameAbandonedIfNeeded);
    eventUnsubscribers.push(() =>
      window.removeEventListener('visibilitychange', trackGameAbandonedIfNeeded)
    );

    window.addEventListener('pagehide', trackGameAbandonedIfNeeded);
    eventUnsubscribers.push(() =>
      window.removeEventListener('pagehide', trackGameAbandonedIfNeeded)
    );

    // Subscribe to achievement unlock event
    eventUnsubscribers.push(
      /** @type {() => void} */ (
        eventBus.subscribe(
          EVENTS.ACHIEVEMENT_UNLOCKED,
          (/** @type {{id: string, achievement: any}} */ { id, achievement }) => {
            achievementPresenter.enqueue({ id, achievement });
          }
        )
      )
    );

    // Initialize app (loader, retry queue, show start screen)
    await lifecycle.initializeApp();

    // Resume in-progress game if available
    const saved = loadInProgressGame();
    if (saved?.state) {
      const shouldResume = await UI.showResumePrompt();
      if (shouldResume) {
        try {
          const resumed = await controller.resumeFromState(saved.state);
          if (!resumed) {
            clearInProgressGame();
          }
        } catch (error) {
          logger.warn('[Resume] Failed to restore in-progress game', error);
          clearInProgressGame();
        }
      } else {
        clearInProgressGame();
      }
    }

    // Store cleanup functions for global cleanup
    /** @type {any} */ (window).__appCleanup = () => {
      eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
      eventUnsubscribers.length = 0;
      lifecycle.cleanup();
      controller.cleanup();
      achievementPresenter.cleanup();
    };
  } catch (error) {
    if (document.body) document.body.dataset.appInitError = 'true';
    // @ts-ignore - debug signal for e2e
    window.__appInitError = error instanceof Error ? error.message : String(error);
    errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'init', {
      showToUser: true,
      fatal: true,
    });
  }
};
