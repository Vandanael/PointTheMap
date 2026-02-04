/// <reference types="../vite-env" />
import { TIMING, MAP } from "./config.js";
import { setLastPseudo } from "./services/storage.js";
import { isIOS } from "./utils.js";
import { logger } from "./utils/logger.js";
import { debounce } from "./utils/performance.js";
import { eventBus } from "./core/EventBus.js";
import { StateManager } from "./core/StateManager.js";
import { mapSystem } from "./systems/MapSystem.js";
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
} from "./game/Game.js";
import { getRemainingTime } from "./game/Round.js";
import { UI } from "./ui/UI.js";
import { processRetryQueue, submitWithRetry } from "./services/api.js";
import { timerSystem } from "./systems/TimerSystem.js";
import { uiSystem } from "./systems/UISystem.js";
import { inputSystem } from "./systems/InputSystem.js";
import { scoringSystem } from "./systems/ScoringSystem.js";
import { analytics } from "./services/Analytics.js";
import { errorMonitoring } from "./services/ErrorMonitoring.js";
import { errorHandler, APIError, safeAsync } from "./core/ErrorHandler.js";
import { updateStats } from "./features/StatsManager.js";
import { checkAchievements } from "./features/AchievementManager.js";
import { formatShareText, shareGameResults, getDailyNumber } from "./features/Share.js";
import { getLang, t } from "./i18n.js";
import { AchievementUnlockModal } from "./ui/components.js";

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

// Store share button handler for cleanup
/** @type {(() => void) | null} */
let shareButtonHandler = null;

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

    // Initialize monitoring services (production only)
    errorMonitoring.init();
    analytics.init();

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

    // Achievement unlock display (non-blocking queue)
    /** @type {Array<{id: string, achievement: {id: string, icon: string, labelKey: string, descKey: string}}>} */
    let achievementQueue = [];
    let isShowingAchievement = false;

    // Store handlers for cleanup
    /** @type {(() => void) | null} */
    let currentAchievementCloseHandler = null;
    /** @type {(() => void) | null} */
    let currentAchievementShareHandler = null;
    /** @type {string | null} */
    let currentAchievementId = null;

    const showNextAchievement = () => {
      if (isShowingAchievement || achievementQueue.length === 0) return;

      isShowingAchievement = true;
      const nextAchievement = achievementQueue.shift();
      if (!nextAchievement) {
        isShowingAchievement = false;
        return;
      }
      const { id, achievement } = nextAchievement;

      // Clean up previous modal handlers if any (before creating new modal)
      if (currentAchievementCloseHandler) {
        const prevCloseBtn = document.getElementById("btn-close-achievement");
        if (prevCloseBtn) {
          prevCloseBtn.removeEventListener("click", currentAchievementCloseHandler);
        }
      }
      if (currentAchievementShareHandler && currentAchievementId) {
        const prevShareBtn = document.getElementById(`btn-share-achievement-${currentAchievementId}`);
        if (prevShareBtn) {
          prevShareBtn.removeEventListener("click", currentAchievementShareHandler);
        }
      }

      const achievementModal = document.createElement("div");
      achievementModal.innerHTML = AchievementUnlockModal(id, achievement);
      const modalElement = achievementModal.firstElementChild;
      if (modalElement) {
        document.body.appendChild(modalElement);
      }

      const closeAchievement = () => {
        const modal = document.getElementById("achievement-modal");
        if (modal) modal.remove();
        isShowingAchievement = false;
        currentAchievementCloseHandler = null;
        currentAchievementShareHandler = null;
        currentAchievementId = null;
        showNextAchievement();
      };

      const closeBtn = document.getElementById("btn-close-achievement");
      if (closeBtn) {
        currentAchievementCloseHandler = closeAchievement;
        closeBtn.addEventListener("click", currentAchievementCloseHandler);
      }

      const shareBtn = document.getElementById(`btn-share-achievement-${id}`);
      if (shareBtn) {
        currentAchievementShareHandler = async () => {
          const shareText = `${t('achievement.unlocked')}\n${t(achievement.labelKey)}: ${t(achievement.descKey)}\n\nhttps://pointthemap.app`;
          const success = await shareGameResults(shareText);
          if (success) {
            UI.showToast(
              t('shareCopied'),
              'success',
              3000,
              { compact: true }
            );
          }
        };
        shareBtn.addEventListener("click", currentAchievementShareHandler);
        currentAchievementId = id; // Store ID for proper cleanup
      }
    };

    eventUnsubscribers.push(
      /** @type {() => void} */ (eventBus.subscribe('achievement:unlocked', (/** @type {{id: string, achievement: any}} */ { id, achievement }) => {
        achievementQueue.push({ id, achievement });
        setTimeout(() => showNextAchievement(), 1000);
      }))
    );

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

    // Wait for the progress bar's CSS transition to complete before hiding.
    // transitionend is the real event — no artificial delay.  Fallback guards
    // against edge cases where the event never fires (e.g. element already removed).
    await new Promise((resolve) => {
      const progressEl = document.getElementById("loading-progress");
      if (!progressEl) { resolve(); return; }
      const fallback = setTimeout(resolve, 350);
      progressEl.addEventListener("transitionend", () => {
        clearTimeout(fallback);
        resolve();
      }, { once: true });
    });

    UI.hideLoader();
    mapSystem.flyTo(MAP.AURAY_CENTER, MAP.AURAY_ZOOM, { animate: false });
    UI.showStart();
  } catch (error) {
    errorHandler.handle(error instanceof Error ? error : new Error(String(error)), 'init', { showToUser: true, fatal: true });
  }
};

const startTimer = () => {
  UI.resetTimer();
  const state = stateManager.getState();
  timerSystem.start(state.runtimeConfig ?? undefined);
};

const stopTimer = () => {
  timerSystem.stop();
};

// Map view transitions (same for classic/daily; use animate: false for instant transitions):
// - Init: Auray (MAP.AURAY_CENTER, MAP.AURAY_ZOOM) – start screen
// - handleStart: world view (MAP.CENTER, MAP.ZOOM) – new game, no animation
// - handleNext: world view – between questions, no animation
// - handleReplay: Auray – back to start screen, no animation

/**
 * @param {"classic" | "daily"} [gameType="classic"]
 */
const handleStart = async (gameType = "classic") => {
  UI.hideStart();
  // Show loader while fetching game data
  UI.showLoader();

  mapSystem.clearMap();
  const startCenter = gameType === 'stadium' ? MAP.EUROPE_CENTER : MAP.CENTER;
  const startZoom  = gameType === 'stadium' ? MAP.EUROPE_ZOOM  : MAP.ZOOM;
  mapSystem.flyTo(startCenter, startZoom, { animate: false });

  const newState = await safeAsync(
    () => startGame(stateManager.getState(), gameType),
    'game:start',
    null
  );

  // Hide loader
  UI.hideLoader();
  
  if (!newState) {
    // Error already handled by errorHandler
    return;
  }
  stateManager.setState(newState, `game:start:${gameType}`);

  const state = stateManager.getState();
  if (state.status !== GameStatus.PLAYING) {
    if (state.error) UI.showError(state.error);
    return;
  }

  // Track game start
  analytics.track('game_started', {
    gameType,
    roundCount: state.runtimeConfig?.roundCount || 5,
  });

  console.log('[Game Start]', {
    gameType: state.gameType,
    capitals: state.capitals.length,
    countries: state.countries.length,
    roundCount: state.runtimeConfig?.roundCount
  });

  // Emit game started event
  eventBus.emit('game:started', {
    gameType,
    capitalCount: state.capitals.length || state.countries.length
  });

  const target = getCurrentTarget(state);
  const isCountryMode = state.gameType === 'country';
  const isStadiumMode = state.gameType === 'stadium';

  if (!target || !target.name) {
    UI.showError(isCountryMode ? "Erreur: pays introuvable" : isStadiumMode ? "Erreur: stade introuvable" : "Erreur: capitale introuvable");
    UI.hideQuestion();
    return;
  }

  const progress = getProgress(state);

  UI.showGameUI(
    progress.current,
    progress.total,
    state.totalScore
  );

  const onReady = () => {
    startTimer();
    // MapSystem emits map:click, InputSystem listens to it
    mapSystem.enableClicks(() => {}); // Empty callback, InputSystem handles via EventBus
    inputSystem.enableMapInput(handleMapClick);
  };

  // Update modal with real data
  // For country mode: show country name only
  // For stadium mode: show stadium name only (no city, to keep it challenging)
  // For capital mode: show capital name + country
  const displayName = target.name;
  const displaySubtitle = isCountryMode ? "" : isStadiumMode ? "" : target.country;

  if (state.currentRoundIndex === 0) {
    UI.showQuestion(displayName, displaySubtitle, onReady, { requireButton: true });
  } else {
    UI.showQuestion(displayName, displaySubtitle, onReady);
  }
};

/**
 * @param {[number, number]} coords - [lat, lng] coordinates
 */
const handleMapClick = (coords) => {
  const state = stateManager.getState();
  if (state.status !== GameStatus.PLAYING) return;
  // Stop timer to prevent timeout events from firing
  stopTimer();
  stateManager.setState(playRound(state, coords), 'round:click');
  onRoundEnd();
};

const onRoundEnd = async () => {
  const state = stateManager.getState();
  
  // Guard: Only process if we're in ROUND_RESULT status (prevents double execution)
  if (state.status !== GameStatus.ROUND_RESULT) {
    return;
  }
  
  mapSystem.disableClicks();
  inputSystem.disableMapInput();
  stopTimer();

  const round = state.currentRound;
  const isCountryMode = state.gameType === 'country';
  const isStadiumMode = state.gameType === 'stadium';

  if (!round) return;
  if (isCountryMode && !round.country) return;
  if (isStadiumMode && !round.stadium) return;
  if (!isCountryMode && !isStadiumMode && !round.capital) return;

  // Emit round completed event
  eventBus.emit('game:round:completed', { round });

  if (round.click && round.click.lat != null && round.click.lng != null) {
    const clickCoords = /** @type {[number, number]} */ ([round.click.lat, round.click.lng]);

    if (isCountryMode) {
      // Country mode: Highlight countries instead of showing markers
      mapSystem.highlightCountries({
        correctCountryId: round.correctCountryId,
        clickedCountryId: round.clickedCountryId
      });
    } else if (isStadiumMode) {
      // Stadium mode: Show stadium markers and line (same as capital)
      const stadiumCoords = /** @type {[number, number]} */ ([round.stadium.lat, round.stadium.lng]);
      await mapSystem.showRoundResult(clickCoords, stadiumCoords, round.distance || 0);
    } else {
      // Capital mode: Show capital markers and line
      const capitalCoords = /** @type {[number, number]} */ ([round.capital.lat, round.capital.lng]);
      await mapSystem.showRoundResult(clickCoords, capitalCoords, round.distance || 0);
    }

    // Tap/click to continue to modal, or wait RESULT_READ_TIME_MS
    const userContinued = new Promise((r) => mapSystem.setOnResultContinue(r));
    await Promise.race([
      userContinued,
      new Promise((r) => setTimeout(r, TIMING.RESULT_READ_TIME_MS)),
    ]);
    mapSystem.clearOnResultContinue();

    // Emit score updated event
    eventBus.emit('score:updated', {
      oldScore: state.totalScore - round.score,
      newScore: state.totalScore,
      delta: round.score,
    });

    // For country mode, distance is always computed (including when clicking water)
    const displayDistance = isCountryMode
      ? (round.distance ?? round.distanceToTargetKm ?? 0)
      : round.distance;
    UI.showRoundResult(
      displayDistance,
      round.score,
      round.status === "timeout",
      isLastRound(state),
      round.baseScore,
      round.timeBonus
    );
  }
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

  const nextCenter = state.gameType === 'stadium' ? MAP.EUROPE_CENTER : MAP.CENTER;
  const nextZoom  = state.gameType === 'stadium' ? MAP.EUROPE_ZOOM  : MAP.ZOOM;
  mapSystem.flyTo(nextCenter, nextZoom, { animate: false });

  const target = getCurrentTarget(state);
  const isCountryMode = state.gameType === 'country';
  const isStadiumMode = state.gameType === 'stadium';

  if (!target || !target.name) {
    UI.showError(isCountryMode ? "Erreur: pays introuvable" : isStadiumMode ? "Erreur: stade introuvable" : "Erreur: capitale introuvable");
    return;
  }

  const progress = getProgress(state);
  UI.updateGameUI(
    progress.current,
    progress.total,
    state.totalScore
  );

  // For country mode: show country name only
  // For stadium mode: show stadium name only (no city, to keep it challenging)
  // For capital mode: show capital name + country
  const displayName = target.name;
  const displaySubtitle = isCountryMode ? "" : isStadiumMode ? "" : target.country;

  UI.showQuestion(displayName, displaySubtitle, () => {
    startTimer();
    mapSystem.enableClicks(() => {}); // Empty callback, InputSystem handles via EventBus
    inputSystem.enableMapInput(handleMapClick);
  });
};

/**
 * @param {string} pseudo
 */
const handleSubmit = async (pseudo) => {
  // Disable submit button while the request is in flight — same pattern as rate-limiting above
  const submitBtn = document.getElementById("btn-submit");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = t('saving');
  }

  try {
    const state = stateManager.getState();
    const result = await submitWithRetry(state.token, state.rounds, pseudo, state.gameType);
    setLastPseudo(pseudo);

    const isNewBest = checkIfNewSessionBest(state, result.score);
    stateManager.setState(
      updateSessionBestScore(state, result.score),
      'score:submit'
    );

    // Update stats and check achievements
    const updatedStats = updateStats(state.rounds, state.gameType);
    checkAchievements(state.rounds, updatedStats, result.rank);

    UI.showFinalResults(result.score, pseudo, result, isNewBest);

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
    // Remove any existing listener first to prevent duplicates
    const shareBtn = document.getElementById("btn-share");
    if (shareBtn) {
      // Remove previous handler if it exists
      if (shareButtonHandler) {
        shareBtn.removeEventListener("click", shareButtonHandler);
      }
      
      shareButtonHandler = async () => {
        const avgDistance = state.rounds.reduce((/** @type {number} */ sum, /** @type {any} */ r) => sum + (r.distance || 0), 0) / state.rounds.length;
        const dailyNumber = state.gameType === 'daily' ? getDailyNumber(state.lastDailyDate) : null;
        const shareText = formatShareText(dailyNumber, avgDistance, state.rounds, getLang());
        const success = await shareGameResults(shareText);

        UI.showToast(
          success ? t('shareCopied') : t('shareFailed'),
          success ? 'success' : 'error',
          3000,
          { compact: true }
        );
      };
      
      shareBtn.addEventListener("click", shareButtonHandler);
    }
  } catch (error) {
    // Restore submit button so the user can retry
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = t('save');
    }

    /** @type {any} */
    const err = error;
    if (err.status === 409 && err.data?.error === "pseudo_already_set_for_this_ip") {
      UI.showPseudoLockedDialog(err.data.pseudo, () => {
        // Retry submission with the locked pseudo
        handleSubmit(err.data.pseudo);
      });
      return;
    }

    const apiError = new APIError(
      err.message || "Erreur lors de la soumission",
      err.status || 500,
      err.data
    );
    errorHandler.handle(apiError, 'score:submit', { showToUser: true, fatal: false });
  }
};

const handleReplay = () => {
  stateManager.setState(resetGame(), 'game:reset');
  mapSystem.clearMap();
  mapSystem.flyTo(MAP.AURAY_CENTER, MAP.AURAY_ZOOM, { animate: false });
  UI.hideGameUI(); // Clear game header and timer from previous game
  UI.hideGameOver();
  // Clean up share button handler
  shareButtonHandler = null;
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

// Offline/Online status indicators
window.addEventListener('offline', () => {
  UI.showToast(t('offline.message') || 'You are offline. Some features may not work.', 'warning', 5000);
});

window.addEventListener('online', () => {
  UI.showToast(t('online.message') || 'You are back online!', 'success', 2000);
});
