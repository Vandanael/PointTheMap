import "./styles.css";
import { GAME, TIMING } from "./config.js";
import { setLastPseudo } from "./services/storage.js";
import { formatScore } from "./utils.js";
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
  handleTimeout,
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

// ============================================
// STATE
// ============================================
let state = createGameState();
let timerInterval = null;

const init = async () => {
  try {
    UI.init();
    UI.showLoader();
    UI.updateLoader(20);

    try {
      initMap("map");
      UI.updateLoader(50);
    } catch (error) {
      console.error("Erreur initialisation carte:", error);
      UI.showError("Erreur lors du chargement de la carte");
      // Continuer l'initialisation malgré l'erreur
    }

    try {
      const retryResult = await processRetryQueue();
      UI.updateLoader(80);

      if (retryResult.successful > 0) {
        console.log(`✅ ${retryResult.successful} score(s) synchronisé(s)`);
      }
      if (retryResult.failed > 0) {
        console.log(`⚠️ ${retryResult.failed} score(s) en attente`);
      }
    } catch (error) {
      console.error("Erreur retry queue:", error);
      // Continuer l'initialisation
    }

    UI.updateLoader(100);
    await new Promise((resolve) => setTimeout(resolve, 300));
    UI.hideLoader();
    UI.showStart(handleStart);
  } catch (error) {
    console.error("Erreur fatale init:", error);
    UI.showError("Erreur lors de l'initialisation");
  }
};

let timerTimeout = null;
let timerStartTime = null;

const startTimer = () => {
  stopTimer();
  UI.resetTimer();

  timerTimeout = setTimeout(() => {
    const timerProgress = document.getElementById("timer-progress");
    if (!timerProgress) return;

    timerStartTime = performance.now();

    // La transition CSS dure TIMER_MS (5000ms) comme dans la version monolithique
    timerProgress.style.transition = `width ${GAME.TIMER_MS}ms linear`;
    timerProgress.style.width = "0%";

    // Danger Zone à 1.5s restantes (TIMER_MS - DANGER_ZONE_MS)
    setTimeout(() => {
      if (state.status === GameStatus.PLAYING && state.currentRound) {
        const progress = document.getElementById("timer-progress");
        if (progress) progress.classList.add("timer-danger");
      }
    }, GAME.TIMER_MS - GAME.DANGER_ZONE_MS);

    // Timeout à la fin (TIMER_MS après le début de l'animation)
    timerTimeout = setTimeout(() => {
      if (state.status === GameStatus.PLAYING && state.currentRound) {
        state = handleTimeout(state);
        onRoundEnd();
      }
    }, GAME.TIMER_MS);

    // Vérification périodique du timeout (la transition CSS gère l'animation visuelle)
    timerInterval = setInterval(() => {
      if (state.status !== GameStatus.PLAYING || !state.currentRound) {
        stopTimer();
        return;
      }

      const remaining = getRemainingTime(state.currentRound);
      if (remaining <= 0) {
        state = handleTimeout(state);
        onRoundEnd();
      }
    }, 50);
  }, GAME.GRACE_PERIOD_MS);
};

const stopTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (timerTimeout) {
    clearTimeout(timerTimeout);
    timerTimeout = null;
  }
  timerStartTime = null;
};

const handleStart = async (gameType = "classic") => {
  UI.hideStart();
  UI.showLoader();

  state = await startGame(state, gameType);
  UI.hideLoader();

  if (state.status !== GameStatus.PLAYING) {
    if (state.error) UI.showError(state.error);
    return;
  }

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
    UI.showQuestionWithButton(capital.name, capital.country, onReady);
  } else {
    UI.showQuestion(capital.name, capital.country, onReady);
  }
};

const handleMapClick = (coords) => {
  if (state.status !== GameStatus.PLAYING) return;
  state = playRound(state, coords);
  onRoundEnd();
};

let scoreAnimationFrame = null;

const animateScoreCountUp = (oldScore, targetScore, points) => {
  if (scoreAnimationFrame) {
    cancelAnimationFrame(scoreAnimationFrame);
    scoreAnimationFrame = null;
  }

  const startTime = performance.now();

  const animateScore = (currentTime) => {
    const scoreEl = document.querySelector("#game-header .text-yellow-400");
    if (!scoreEl) {
      scoreAnimationFrame = null;
      return; // Arrêter l'animation si l'élément n'existe plus
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / TIMING.SCORE_ANIMATION_MS, 1);
    const currentScore = Math.floor(oldScore + points * progress);

    scoreEl.textContent = formatScore(currentScore);

    if (progress < 1) {
      scoreAnimationFrame = requestAnimationFrame(animateScore);
    } else {
      scoreEl.textContent = formatScore(targetScore);
      scoreAnimationFrame = null;
    }
  };

  scoreAnimationFrame = requestAnimationFrame(animateScore);
};

const onRoundEnd = () => {
  disableClicks();
  stopTimer();

  const round = state.currentRound;
  if (!round) return;

  if (round.click) {
    const clickCoords = [round.click.lat, round.click.lng];
    const capitalCoords = [round.capital.lat, round.capital.lng];
    showRoundResult(clickCoords, capitalCoords, round.distance || 0);
    animateScoreCountUp(
      state.totalScore - round.score,
      state.totalScore,
      round.score
    );
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

  if (isLastRound(state)) {
    UI.showGameOver(state.totalScore, handleSubmit, handleReplay);
    return;
  }

  state = nextRound(state);
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
    const result = await submitWithRetry(state.token, state.rounds, pseudo, state.gameType);
    setLastPseudo(pseudo);

    const isNewBest = checkIfNewSessionBest(state, result.score);
    state = updateSessionBestScore(state, result.score);

    UI.showFinalResults(result.score, pseudo, result, handleReplay, isNewBest);
  } catch (error) {
    console.error("Submit error:", error);
    UI.showError(error.message || "Erreur lors de la soumission");
  } finally {
    UI.hideLoader();
  }
};

const handleReplay = () => {
  state = resetGame();
  UI.hideGameOver();
  UI.showStart(handleStart);
};

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => {
    console.error("Erreur fatale dans init():", e);
  });
});
