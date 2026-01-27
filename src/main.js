import "./styles.css";
import { GAME, TIMING } from "./config.js";
import { setLastPseudo } from "./services/storage.js";
import { formatScore, isIOS } from "./utils.js";
import { logger } from "./utils/logger.js";
import { debounce, throttle } from "./utils/performance.js";
import { eventBus, StateManager } from "./core/index.js";
import { UI_TIMING } from "./config/visual-constants.js";
import {
  initMap,
  disableClicks,
  enableClicks,
  showRoundResult,
  clearMap,
  resetView,
} from "./game/Map.js";
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
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  // Définir la hauteur initiale
  setHeight();

  // Mettre à jour lors du redimensionnement - debounced pour éviter trop d'appels
  const debouncedSetHeight = debounce(setHeight, 150);
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
    stateManager.registerValidator('totalScore', (value) => {
      if (typeof value !== 'number') return 'totalScore must be a number';
      if (value < 0) return 'totalScore cannot be negative';
      if (!Number.isFinite(value)) return 'totalScore must be finite';
      return true;
    });

    stateManager.registerValidator('status', (value) => {
      const valid = Object.values(GameStatus);
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
    UI.showLoader();
    UI.updateLoader(20);

    try {
      initMap("map");
      UI.updateLoader(50);
    } catch (error) {
      logger.error("Erreur initialisation carte:", error);
      UI.showError("Erreur lors du chargement de la carte");
    }

    try {
      const retryResult = await processRetryQueue();
      UI.updateLoader(80);

      if (retryResult.successful > 0) {
        logger.log(`✅ ${retryResult.successful} score(s) synchronisé(s)`);
      }
      if (retryResult.failed > 0) {
        logger.warn(`⚠️ ${retryResult.failed} score(s) en attente`);
      }
    } catch (error) {
      logger.error("Erreur retry queue:", error);
    }

    UI.updateLoader(100);
    await new Promise((resolve) => setTimeout(resolve, UI_TIMING.LOADER_FINAL_DELAY));
    UI.hideLoader();
    UI.showStart(handleStart);
  } catch (error) {
    logger.error("Erreur fatale init:", error);
    UI.showError("Erreur lors de l'initialisation");
  }
};

const startTimer = () => {
  UI.resetTimer();
  timerSystem.start(); // No callbacks needed!
};

const stopTimer = () => {
  timerSystem.stop();
};

const handleStart = async (gameType = "classic") => {
  UI.hideStart();
  UI.showLoader();
  UI.updateLoader(20);
  clearMap();
  resetView();

  const newState = await startGame(stateManager.getState(), gameType);
  stateManager.setState(newState, `game:start:${gameType}`);
  UI.updateLoader(100);
  await new Promise((resolve) => setTimeout(resolve, UI_TIMING.LOADER_FINAL_DELAY));
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
    enableClicks(handleMapClick);
  };

  if (state.currentRoundIndex === 0) {
    UI.showQuestion(capital.name, capital.country, onReady, { requireButton: true });
  } else {
    UI.showQuestion(capital.name, capital.country, onReady);
  }
};

const handleMapClick = (coords) => {
  const state = stateManager.getState();
  if (state.status !== GameStatus.PLAYING) return;
  stateManager.setState(playRound(state, coords), 'round:click');
  onRoundEnd();
};

const onRoundEnd = () => {
  disableClicks();
  stopTimer();

  const state = stateManager.getState();
  const round = state.currentRound;
  if (!round) return;

  // Emit round completed event
  eventBus.emit('game:round:completed', { round });

  if (round.click) {
    const clickCoords = [round.click.lat, round.click.lng];
    const capitalCoords = [round.capital.lat, round.capital.lng];
    showRoundResult(clickCoords, capitalCoords, round.distance || 0);

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
      isLastRound(state),
      handleNext
    );
  }, TIMING.RESULT_DELAY_MS);
};

const handleNext = () => {
  UI.hideRoundResult();
  clearMap();

  let state = stateManager.getState();
  if (isLastRound(state)) {
    UI.showGameOver(state.totalScore, handleSubmit, handleReplay);
    return;
  }

  stateManager.setState(nextRound(state), 'round:next');
  state = stateManager.getState();
  resetView();

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
    enableClicks(handleMapClick);
  });
};

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

    UI.showFinalResults(result.score, pseudo, result, handleReplay, isNewBest);
  } catch (error) {
    logger.error("Submit error:", error);

    if (error.status === 409 && error.data?.error === "pseudo_already_set_for_this_ip") {
      UI.hideLoader();
      UI.showPseudoLockedDialog(error.data.pseudo);
      return;
    }

    UI.showError(error.message || "Erreur lors de la soumission");
  } finally {
    UI.hideLoader();
  }
};

const handleReplay = () => {
  stateManager.setState(resetGame(), 'game:reset');
  UI.hideGameOver();
  UI.showStart(handleStart);
};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => {
    logger.error("Erreur fatale dans init():", e);
  });
});
