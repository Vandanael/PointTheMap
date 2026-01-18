// Point The Map - UI Controller
// Clean, minimal UI controller using components

import { api } from "../services/api.js";
import { getLastPseudo, getTheme, setTheme } from "../services/storage.js";
import { toggleLang, t } from "../i18n.js";
import { logger } from "../utils/logger.js";
import {
  Modal,
  TimerBar,
  GameHeader,
  QuestionModal,
  QuestionModalWithButton,
  RoundResult,
  StartScreen,
  GameOverScreen,
  FinalResults,
  LeaderboardModal,
  deduplicateLeaderboard,
  LoadingSpinner,
} from "./components.js";

const app = () => {
  const el = document.getElementById("app");
  if (!el) {
    logger.error("Element #app introuvable");
    return document.body; // Fallback
  }
  return el;
};

const render = (html, container = app()) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const el = div.firstElementChild;
  container.appendChild(el);
  return el;
};

const remove = (id) => document.getElementById(id)?.remove();
const bindClick = (id, handler) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
};

const applyTheme = (theme) => {
  if (theme === "light") document.body.classList.add("light-theme");
  else document.body.classList.remove("light-theme");
  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = theme === "light" ? "☀️" : "🌙";
};

const toggleTheme = () => {
  const next = getTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  applyTheme(next);
  if (typeof window !== "undefined" && window.refreshMapTiles) {
    window.refreshMapTiles();
  }
};

const handleToggleLang = () => {
  const newLang = toggleLang();
  const icon = document.getElementById("lang-icon");
  if (icon) icon.textContent = newLang.toUpperCase();
  UI.hideStart();
  UI.showStart(window._onStartHandler);
};

const loadLeaderboard = async (type) => {
  try {
    const scores = await api.getLeaderboard(type);
    return deduplicateLeaderboard(scores);
  } catch (e) {
    logger.error("Erreur leaderboard:", e);
    return [];
  }
};

export const UI = {
  init() {
    applyTheme(getTheme());
  },

  // Loader
  showLoader() {
    const existing = document.getElementById("loading-spinner");
    if (existing) return;
    render(LoadingSpinner());
  },
  hideLoader() {
    remove("loading-spinner");
  },
  updateLoader(percent) {
    const p = document.getElementById("loading-progress");
    if (p) p.style.width = `${Math.min(100, percent)}%`;
  },

  // Start screen
  showStart(onStart) {
    window._onStartHandler = onStart;
    render(StartScreen());
    bindClick("btn-start-classic", () => onStart("classic"));
    bindClick("btn-start-daily", () => onStart("daily"));
    bindClick("btn-theme", toggleTheme);
    bindClick("btn-lang", handleToggleLang);
    bindClick("btn-leaderboard", async () => {
      const scores = await loadLeaderboard("classic");
      UI.showLeaderboardModal(scores, "classic");
    });
  },
  hideStart() {
    remove("start-modal");
  },

  async showLeaderboardModal(scores, type = "classic") {
    remove("leaderboard-modal");
    render(LeaderboardModal(scores, type));
    bindClick("btn-close-leaderboard", () => remove("leaderboard-modal"));
    
    bindClick("btn-leaderboard-classic", async () => {
      const newScores = await loadLeaderboard("classic");
      UI.showLeaderboardModal(newScores, "classic");
    });
    
    bindClick("btn-leaderboard-daily", async () => {
      const newScores = await loadLeaderboard("daily");
      UI.showLeaderboardModal(newScores, "daily");
    });
  },

  // Game UI
  showGameUI(roundNum, totalRounds, capitalName, country, totalScore) {
    render(TimerBar());
    render(GameHeader(roundNum, totalRounds, capitalName, country, totalScore));
  },
  updateGameUI(roundNum, totalRounds, capitalName, country, totalScore) {
    remove("game-header");
    render(GameHeader(roundNum, totalRounds, capitalName, country, totalScore));
  },
  hideGameUI() {
    remove("game-header");
    remove("timer-bar");
  },

  showQuestion(capitalName, country, onClose) {
    render(QuestionModal(capitalName, country));
    const close = () => {
      remove("question-modal");
      onClose?.();
    };
    document.getElementById("question-modal")?.addEventListener("click", close);
    setTimeout(close, 1000);
  },

  showQuestionWithButton(capitalName, country, onReady) {
    render(QuestionModalWithButton(capitalName, country));
    bindClick("btn-ready", () => {
      remove("question-modal");
      onReady?.();
    });
  },

  updateTimer(percentage) {
    const progress = document.getElementById("timer-progress");
    if (progress) {
      progress.style.width = `${percentage}%`;
    }
  },
  resetTimer() {
    const p = document.getElementById("timer-progress");
    if (!p) return;
    p.style.transition = "none";
    p.style.width = "100%";
    p.classList.remove("timer-danger");
    p.offsetHeight; // Force reflow
  },

  // Round result
  showRoundResult(distance, score, isTimeout, isLast, onNext) {
    const content = RoundResult(distance, score, isTimeout, isLast);
    render(Modal("round-result", content, true));
    bindClick("btn-next", onNext);
  },
  hideRoundResult() {
    remove("round-result");
  },

  // Game over / submit
  showGameOver(totalScore, onSubmit, onReplay) {
    const lastPseudo = getLastPseudo() || "";
    render(GameOverScreen(totalScore, lastPseudo));

    const input = document.getElementById("pseudo-input");
    if (input) {
      input.addEventListener("input", (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
      });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const btn = document.getElementById("btn-submit");
          if (btn) btn.click();
        }
      });
      input.addEventListener("focus", (e) => {
        e.target.style.outline = "none";
        e.target.style.boxShadow = "none";
      });
      input.focus();
    }

    bindClick("btn-submit", () => {
      const pseudo = input?.value.trim();
      const error = document.getElementById("pseudo-error");
      if (!/^[A-Z]{3,5}$/.test(pseudo)) {
        error?.classList.remove("hidden");
        input?.style.setProperty("border-color", "#ef4444");
        return;
      }
      error?.classList.add("hidden");
      input?.style.setProperty("border-color", "var(--accent)");
      onSubmit(pseudo);
    });

    bindClick("btn-replay", onReplay);
  },

  showFinalResults(totalScore, pseudo, result, onReplay, isNewSessionBest = false) {
    let modal = document.getElementById("result-modal");
    if (!modal) {
      modal = render(`
        <div id="result-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true"></div>
      `);
    }
    modal.innerHTML = `
      <div class="flex items-center justify-center p-4 h-full">
        ${FinalResults(totalScore, pseudo, result.rank, result.isTopFifty, isNewSessionBest)}
      </div>
    `;
    bindClick("btn-replay", onReplay);
  },

  hideGameOver() {
    remove("result-modal");
  },

  showError(message) {
    const container = app();
    if (!container) return; // Protection supplémentaire
    const errorEl = document.createElement("div");
    errorEl.className = "fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-600 text-white p-4 rounded-lg shadow-lg";
    errorEl.style.zIndex = "var(--z-overlay)";
    errorEl.textContent = message;
    container.appendChild(errorEl);
    setTimeout(() => errorEl.remove(), 4000);
  },
};
