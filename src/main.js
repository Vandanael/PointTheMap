/// <reference types="../vite-env" />
import "./styles.css";
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
import { errorHandler, APIError, GameError, safeAsync } from "./core/ErrorHandler.js";

// State Management
const stateManager = new StateManager(createGameState());

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
  // @ts-ignore - debounce returns a function compatible with EventListener
  window.addEventListener('resize', debouncedSetHeight);
  window.addEventListener('orientationchange', setHeight); // Immediate for orientation change

  // iOS: Mettre à jour également lors du scroll (barre d'adresse Safari)
  // Utilise RAF throttling qui est déjà optimal
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        setHeight();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
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
    eventBus.subscribe('timer:timeout', () => {
      const state = stateManager.getState();
      if (state.status === GameStatus.PLAYING && state.currentRound) {
        stateManager.setState(
          gameHandleTimeout(state),
          'timer:timeout'
        );
        onRoundEnd();
      }
    });

    eventBus.subscribe('timer:tick', () => {
      const state = stateManager.getState();
      if (state.status !== GameStatus.PLAYING || !state.currentRound) {
        timerSystem.stop();
        return;
      }
      const remaining = getRemainingTime(state.currentRound);
      if (remaining <= 0) {
        stateManager.setState(
          gameHandleTimeout(state),
          'timer:tick:timeout'
        );
        onRoundEnd();
      }
    });

    // Initialize UI system (handles all UI-related EventBus subscriptions)
    uiSystem.init();
    // Initialize Input system
    inputSystem.init();

    // Subscribe to InputSystem events
    eventBus.subscribe('input:start-game', (/** @type {{ gameType?: "classic" | "daily" }} */ { gameType }) => {
      handleStart(gameType || 'classic');
    });

    eventBus.subscribe('input:next-round', () => {
      handleNext();
    });

    eventBus.subscribe('input:submit', (/** @type {{ pseudo: string }} */ { pseudo }) => {
      handleSubmit(pseudo);
    });

    eventBus.subscribe('input:replay', () => {
      handleReplay();
    });

    UI.showLoader();
    UI.updateLoader(20);

    try {
      mapSystem.init("map");
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
  mapSystem.clearMap();
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
  if (!capital) {
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
  mapSystem.disableClicks();
  inputSystem.disableMapInput();
  stopTimer();

  const state = stateManager.getState();
  const round = state.currentRound;
  if (!round) return;

  // Emit round completed event
  eventBus.emit('game:round:completed', { round });

  if (round.click) {
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
  mapSystem.clearMap();

  let state = stateManager.getState();
  if (isLastRound(state)) {
    UI.showGameOver(state.totalScore);
    return;
  }

  stateManager.setState(nextRound(state), 'round:next');
  state = stateManager.getState();
  mapSystem.resetView();

  const capital = getCurrentCapital(state);
  if (!capital) {
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
  UI.hideGameOver();
  UI.showStart();
};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => {
    errorHandler.handle(e, 'dom-ready', { showToUser: true, fatal: true });
  });
});
