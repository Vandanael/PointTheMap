/// <reference types="../vite-env" />
import "./styles.css";
import "leaflet/dist/leaflet.css";
import { TIMING } from "./config.js";
import { setLastPseudo } from "./services/storage.js";
import { isIOS } from "./utils.js";
import { logger } from "./utils/logger.js";
import { debounce } from "./utils/performance.js";
import { eventBus, StateManager } from "./core/index.js";
import { UI_TIMING } from "./config/visual-constants.js";
import { mapSystem } from "./systems/MapSystem.js";
import {
  createGameState,
  startGame,
  playRound,
  handleTimeout as gameHandleTimeout,
  nextRound,
  getCurrentCapital,
  isLastRound,
  getProgress,
  GameStatus,
  checkIfNewSessionBest,
  updateSessionBestScore,
  resetGame,
} from "./game/Game.js";
import { getRemainingTime } from "./game/Round.js";
import { UI } from "./ui/UI.js";
import { processRetryQueue, submitWithRetry } from "./services/api.js";
import { timerSystem } from "./systems/TimerSystem.js";
import { uiSystem } from "./systems/UISystem.js";
import { inputSystem } from "./systems/InputSystem.js";
import { scoringSystem } from "./systems/ScoringSystem.js";
import { errorHandler, APIError, safeAsync } from "./core/ErrorHandler.js";

// State Management
const stateManager = new StateManager(createGameState());

// Track event subscriptions for cleanup
/** @type {Array<() => void>} */
const eventUnsubscribers = [];

// Store iOS viewport listeners for cleanup
/** @type {(() => void) | null} */
let iosResizeHandler = null;
/** @type {(() => void) | null} */
let iosOrientationHandler = null;
/** @type {(() => void) | null} */
let iosScrollHandler = null;

// Initialize DevTools in dev mode (dynamic import to exclude from production bundle)
if (import.meta.env.DEV) {
  import("./core/StateDevTools.js").then(({ StateDevTools }) => {
    new StateDevTools(stateManager);
  });
}

// iOS: Fix viewport height dynamique pour gérer la barre d'adresse Safari
const setIOSViewportHeight = () => {
  if (!isIOS()) return;

  const setHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  // Définir la hauteur initiale
  setHeight();

  // Mettre à jour lors du redimensionnement - debounced pour éviter trop d'appels
  const debouncedSetHeight = debounce(setHeight, 150);
  // Type assertion: debounce returns Function, but we know it's compatible with EventListener
  iosResizeHandler = /** @type {() => void} */ (debouncedSetHeight);
  // @ts-expect-error - debounce returns Function, compatible at runtime with EventListener
  window.addEventListener('resize', debouncedSetHeight);

  iosOrientationHandler = setHeight;
  window.addEventListener('orientationchange', iosOrientationHandler);

  // iOS: Mettre à jour également lors du scroll (barre d'adresse Safari)
  // Utilise RAF throttling qui est déjà optimal
  let ticking = false;
  iosScrollHandler = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        setHeight();
        ticking = false;
      });
      ticking = true;
    }
  };
  window.addEventListener('scroll', iosScrollHandler, { passive: true });
};

/**
 * Cleanup all event subscriptions
 */
const cleanup = () => {
  eventUnsubscribers.forEach((unsubscribe) => unsubscribe());
  eventUnsubscribers.length = 0;

  // Clean up iOS viewport listeners
  if (iosResizeHandler) {
    window.removeEventListener('resize', iosResizeHandler);
  }
  if (iosOrientationHandler) {
    window.removeEventListener('orientationchange', iosOrientationHandler);
  }
  if (iosScrollHandler) {
    window.removeEventListener('scroll', iosScrollHandler);
  }
};

const init = async () => {
  try {
    // iOS: Configurer le viewport height dynamique en premier
    setIOSViewportHeight();

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

    // Subscribe to timer game logic events
    eventUnsubscribers.push(
      /** @type {() => void} */ (eventBus.subscribe('timer:timeout', () => {
        const state = stateManager.getState();
        if (state.status === GameStatus.PLAYING && state.currentRound) {
          // Stop timer to prevent tick handler from also firing
          timerSystem.stop();
          const newState = gameHandleTimeout(state);
          stateManager.setState(newState, 'timer:timeout');
          
          // Only call onRoundEnd if state was actually changed (guard against race condition)
          if (newState.status === GameStatus.ROUND_RESULT) {
            onRoundEnd();
          }
        }
      }))
    );

    eventUnsubscribers.push(
      /** @type {() => void} */ (eventBus.subscribe('timer:tick', () => {
        const state = stateManager.getState();
        if (state.status !== GameStatus.PLAYING || !state.currentRound) {
          timerSystem.stop();
          return;
        }
        const remaining = getRemainingTime(state.currentRound);
        if (remaining <= 0) {
          // Stop timer to prevent timer:timeout handler from also firing
          timerSystem.stop();
          const newState = gameHandleTimeout(state);
          stateManager.setState(newState, 'timer:tick:timeout');
          
          // Only call onRoundEnd if state was actually changed (guard against race condition)
          if (newState.status === GameStatus.ROUND_RESULT) {
            onRoundEnd();
          }
        }
      }))
    );

    // Initialize UI system (handles all UI-related EventBus subscriptions)
    uiSystem.init();
    // Initialize Input system
    inputSystem.init();
    // Initialize Scoring system
    scoringSystem.init();

    // Subscribe to InputSystem events
    const unsubscribeStartGame = eventBus.subscribe('input:start-game', (/** @type {{ gameType?: "classic" | "daily" }} */ { gameType }) => {
      handleStart(gameType || 'classic');
    });
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeStartGame));

    const unsubscribeNextRound = eventBus.subscribe('input:next-round', () => {
      handleNext();
    });
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeNextRound));

    const unsubscribeSubmit = eventBus.subscribe('input:submit', (/** @type {{ pseudo: string }} */ { pseudo }) => {
      handleSubmit(pseudo);
    });
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeSubmit));

    const unsubscribeReplay = eventBus.subscribe('input:replay', () => {
      handleReplay();
    });
    eventUnsubscribers.push(/** @type {() => void} */ (unsubscribeReplay));

    UI.showLoader();
    UI.updateLoader(20);

    try {
      await mapSystem.init("map");
      UI.updateLoader(50);
    } catch (error) {
      errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'map:init', { showToUser: true, fatal: false });
    }

    const retryResult = await safeAsync(
      () => processRetryQueue(),
      'retry-queue',
      { successful: 0, failed: 0 }
    );
    UI.updateLoader(80);

    if (retryResult.successful > 0) {
      logger.log(`✅ ${retryResult.successful} score(s) synchronisé(s)`);
    }
    if (retryResult.failed > 0) {
      logger.warn(`⚠️ ${retryResult.failed} score(s) en attente`);
    }

    UI.updateLoader(100);
    UI.hideLoader();
    UI.showStart();
  } catch (error) {
    errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'init', { showToUser: true, fatal: true });
  }
};

const startTimer = () => {
  UI.resetTimer();
  timerSystem.start(); // No callbacks needed!
};

const stopTimer = () => {
  timerSystem.stop();
};

/**
 * @param {"classic" | "daily"} [gameType="classic"]
 */
const handleStart = async (gameType = "classic") => {
  UI.hideStart();
  UI.showLoader();
  UI.updateLoader(20);
  mapSystem.clearMap(); // Nettoie tous les markers (y compris les capitales)
  mapSystem.resetView();

  const newState = await safeAsync(
    () => startGame(stateManager.getState(), gameType),
    'game:start',
    null
  );
  if (!newState) {
    // Error already handled by errorHandler
    return;
  }
  stateManager.setState(newState, `game:start:${gameType}`);
  UI.updateLoader(100);
  UI.hideLoader();

  const state = stateManager.getState();
  if (state.status !== GameStatus.PLAYING) {
    if (state.error) UI.showError(state.error);
    return;
  }

  // Emit game started event
  eventBus.emit('game:started', {
    gameType,
    capitalCount: state.capitals.length
  });

  const capital = getCurrentCapital(state);
  if (!capital || !capital.name || !capital.country) {
    UI.showError("Erreur: capitale introuvable");
    return;
  }

  const progress = getProgress(state);

  UI.showGameUI(
    progress.current,
    progress.total,
    capital.name,
    capital.country,
    state.totalScore
  );

  const onReady = () => {
    startTimer();
    // MapSystem emits map:click, InputSystem listens to it
    mapSystem.enableClicks(() => {}); // Empty callback, InputSystem handles via EventBus
    inputSystem.enableMapInput(handleMapClick);
  };

  if (state.currentRoundIndex === 0) {
    UI.showQuestion(capital.name, capital.country, onReady, { requireButton: true });
  } else {
    UI.showQuestion(capital.name, capital.country, onReady);
  }
};

/**
 * @param {[number, number]} coords - [lat, lng] coordinates
 */
const handleMapClick = (coords) => {
  const state = stateManager.getState();
  if (state.status !== GameStatus.PLAYING) return;
  stateManager.setState(playRound(state, coords), 'round:click');
  onRoundEnd();
};

const onRoundEnd = () => {
  const state = stateManager.getState();
  
  // Guard: Only process if we're in ROUND_RESULT status (prevents double execution)
  if (state.status !== GameStatus.ROUND_RESULT) {
    return;
  }
  
  mapSystem.disableClicks();
  inputSystem.disableMapInput();
  stopTimer();

  const round = state.currentRound;
  if (!round || !round.capital) return;

  // Emit round completed event
  eventBus.emit('game:round:completed', { round });

  if (round.click && round.click.lat != null && round.click.lng != null) {
    const clickCoords = /** @type {[number, number]} */ ([round.click.lat, round.click.lng]);
    const capitalCoords = /** @type {[number, number]} */ ([round.capital.lat, round.capital.lng]);
    mapSystem.showRoundResult(clickCoords, capitalCoords, round.distance || 0);

    // Emit score updated event
    eventBus.emit('score:updated', {
      oldScore: state.totalScore - round.score,
      newScore: state.totalScore,
      delta: round.score,
    });
  }

  setTimeout(() => {
    UI.showRoundResult(
      round.distance,
      round.score,
      round.status === "timeout",
      isLastRound(state)
    );
  }, TIMING.RESULT_DELAY_MS);
};

const handleNext = () => {
  UI.hideRoundResult();
  mapSystem.clearMap(); // Nettoie tous les markers (y compris les capitales)

  let state = stateManager.getState();
  if (isLastRound(state)) {
    UI.showGameOver(state.totalScore);
    return;
  }

  stateManager.setState(nextRound(state), 'round:next');
  state = stateManager.getState();
  mapSystem.resetView();

  const capital = getCurrentCapital(state);
  if (!capital || !capital.name || !capital.country) {
    UI.showError("Erreur: capitale introuvable");
    return;
  }

  const progress = getProgress(state);
  UI.updateGameUI(
    progress.current,
    progress.total,
    capital.name,
    capital.country,
    state.totalScore
  );

  UI.showQuestion(capital.name, capital.country, () => {
    startTimer();
    mapSystem.enableClicks(() => {}); // Empty callback, InputSystem handles via EventBus
    inputSystem.enableMapInput(handleMapClick);
  });
};

/**
 * @param {string} pseudo
 */
const handleSubmit = async (pseudo) => {
  UI.showLoader();
  try {
    const state = stateManager.getState();
    const result = await submitWithRetry(state.token, state.rounds, pseudo, state.gameType);
    setLastPseudo(pseudo);

    const isNewBest = checkIfNewSessionBest(state, result.score);
    stateManager.setState(
      updateSessionBestScore(state, result.score),
      'score:submit'
    );

    UI.showFinalResults(result.score, pseudo, result, isNewBest);
  } catch (error) {
    /** @type {any} */
    const err = error;
    if (err.status === 409 && err.data?.error === "pseudo_already_set_for_this_ip") {
      UI.hideLoader();
      UI.showPseudoLockedDialog(err.data.pseudo);
      return;
    }

    const apiError = new APIError(
      err.message || "Erreur lors de la soumission",
      err.status || 500,
      err.data
    );
    errorHandler.handle(apiError, 'score:submit', { showToUser: true, fatal: false });
  } finally {
    UI.hideLoader();
  }
};

const handleReplay = () => {
  stateManager.setState(resetGame(), 'game:reset');
  mapSystem.clearMap(); // Nettoyer tous les markers (y compris les capitales) lors du reset
  mapSystem.resetView();
  UI.hideGameOver();
  UI.showStart();
};

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  cleanup();
  uiSystem.destroy();
  mapSystem.destroy();
  inputSystem.destroy();
  scoringSystem.destroy();
});

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => {
    errorHandler.handle(e, 'dom-ready', { showToUser: true, fatal: true });
  });
});
