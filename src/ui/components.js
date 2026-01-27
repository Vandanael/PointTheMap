import { GAME } from "../config.js";
import { formatScore, escapeHtml } from "../utils.js";
import { t, getLang } from "../i18n.js";

export const Modal = (id, content, fullScreen = true) => `
  <div id="${id}" class="fixed ${fullScreen ? "inset-0 modal-bg" : "bottom-8 left-1/2 -translate-x-1/2"} ${fullScreen ? "flex items-center justify-center" : ""}" style="z-index: var(--z-modal);">
    ${content}
  </div>
`;

export const Button = (id, text, variant = "primary", fullWidth = true, pulse = false) => {
  const variants = {
    primary: "bg-yellow-400 hover:bg-yellow-300 text-black",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white",
  };

  return `
    <button id="${id}" class="${fullWidth ? "w-full" : "px-6"} py-5 ${variants[variant]} font-black rounded-xl text-lg btn-scale ${pulse ? "pulse-button" : ""}" style="text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      ${text}
    </button>
  `;
};

export const LoadingSpinner = () => `
  <div id="loading-spinner" class="fixed inset-0 flex items-center justify-center" style="background: var(--bg-primary); z-index: var(--z-overlay);" role="status" aria-live="polite" aria-busy="true">
    <div class="w-full max-w-md px-8">
      <!-- Barre de progression jaune -->
      <div class="w-full h-1 rounded-full overflow-hidden" style="background: var(--bg-tertiary);">
        <div id="loading-progress" class="h-full rounded-full transition-all duration-300 ease-out" style="background: var(--accent); width: 0%;"></div>
      </div>
    </div>
  </div>
`;

export const TimerBar = () => `
  <div id="timer-bar" class="fixed top-0 left-0 right-0" style="width: 100%; height: 8px; background-color: transparent; pointer-events: none; z-index: calc(var(--z-base) + 1);">
    <div id="timer-progress" class="h-full bg-yellow-400" style="width: 100%; transition: width linear;"></div>
  </div>
`;

export const GameHeader = (roundNum, totalRounds, capitalName, country, totalScore) => {
  const escapedCapital = escapeHtml(capitalName);
  const escapedCountry = escapeHtml(country);
  return `
  <div id="game-header" class="game-header fixed top-0 left-0 right-0" style="z-index: var(--z-base);">
    <div class="px-6 py-2 flex justify-between items-center" style="background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-secondary);">${t("round")}</div>
        <div class="text-lg font-black" style="color: var(--text-primary);">${roundNum}/${totalRounds}</div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-secondary);">${t("score")}</div>
        <div class="text-lg font-black text-yellow-400">${formatScore(totalScore)}</div>
      </div>
    </div>
  </div>
`;
};

export const QuestionModal = (capitalName, country) => {
  const escapedCapital = escapeHtml(capitalName);
  const escapedCountry = escapeHtml(country);
  return `
  <div id="question-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="background: var(--bg-primary); z-index: var(--z-modal);" role="dialog" aria-modal="true" aria-labelledby="capitalName">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
      <div class="text-center">
        <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3" id="findLabel">${t("find")}</div>
        <h2 class="text-5xl font-black text-primary mb-2" id="capitalName">${escapedCapital}</h2>
        <div class="text-secondary text-base mb-6" id="countryName">${escapedCountry}</div>
        <div class="modal-section rounded-xl p-4 text-secondary text-sm" id="clickMapLabel">
          ${t("clickOnMap")}
        </div>
      </div>
    </div>
  </div>
`;
};

export const QuestionModalWithButton = (capitalName, country) => {
  const escapedCapital = escapeHtml(capitalName);
  const escapedCountry = escapeHtml(country);
  return `
  <div id="question-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="background: var(--bg-primary); z-index: var(--z-modal);" role="dialog" aria-modal="true" aria-labelledby="capitalName">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
      <div class="text-center">
        <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3" id="findLabel">${t("find")}</div>
        <h2 class="text-5xl font-black text-primary mb-2" id="capitalName">${escapedCapital}</h2>
        <div class="text-secondary text-base mb-6" id="countryName">${escapedCountry}</div>
        <div class="modal-section rounded-xl p-4 text-secondary text-sm mb-6" id="clickMapLabel">
          ${t("clickOnMap")}
        </div>
        ${Button("btn-ready", t("start"), "primary")}
      </div>
    </div>
  </div>
`;
};

export const RoundResult = (distance, score, isTimeout, isLast) => {
  const formatDistance = (distanceKm) => {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${Math.round(distanceKm)} km`;
  };

  const getIcon = () => {
    if (isTimeout) return "⏱️";
    if (distance < 50) return "🏆";
    if (distance < 200) return "🎯";
    if (distance < 500) return "👍";
    if (distance < 1000) return "👌";
    return "🤔";
  };

  if (isTimeout) {
    return `
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
        <div class="text-center mb-6">
          <div id="resultIcon" class="text-6xl mb-4">${getIcon()}</div>
          <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="distanceLabel">${t("timeUp")}</div>
          <div class="text-3xl font-black text-primary mb-6" id="distanceDisplay">${t("tooSlow")}</div>
          <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="pointsEarnedLabel">${t("pointsEarned")}</div>
          <div class="text-6xl font-black text-yellow-400 mb-2" id="pointsDisplay">0</div>
        </div>
        ${Button("btn-next", isLast ? t("seeResults") : t("continue"), "primary")}
      </div>
    `;
  }

  return `
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
      <div class="text-center mb-6">
        <div id="resultIcon" class="text-6xl mb-4">${getIcon()}</div>
        <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="distanceLabel">${t("distance")}</div>
        <div class="text-3xl font-black text-primary mb-6" id="distanceDisplay">${formatDistance(distance)}</div>
        <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="pointsEarnedLabel">${t("pointsEarned")}</div>
        <div class="text-6xl font-black text-yellow-400 mb-2" id="pointsDisplay">${formatScore(score)}</div>
      </div>
      ${Button("btn-next", isLast ? t("seeResults") : t("continue"), "primary")}
    </div>
  `;
};

export const StartScreen = () => `
  <div id="start-modal" class="fixed inset-0 modal-bg flex flex-col" style="z-index: var(--z-modal);" role="dialog" aria-modal="true" aria-labelledby="challengeText">
    <!-- Toggle buttons -->
    <div class="absolute top-4 right-4 md:top-6 md:right-6 z-10 flex gap-2">
      <button id="btn-leaderboard" class="toggle-btn" title="Leaderboard" aria-label="Show leaderboard">
        <span>🏆</span>
      </button>
      <button id="btn-lang" class="toggle-btn" title="Change language" aria-label="Toggle language">
        <span id="lang-icon">${getLang().toUpperCase()}</span>
      </button>
      <button id="btn-theme" class="toggle-btn" title="Change theme" aria-label="Toggle theme">
        <span id="theme-icon">🌙</span>
      </button>
    </div>

    <!-- Contenu centré verticalement -->
    <div class="flex-1 flex items-center justify-center px-4 md:px-8" style="padding-top: 3rem; padding-bottom: 1rem;">
      <div class="text-left modal-content max-w-3xl w-full">
        <!-- Titre Hero - Signature visuelle sur deux lignes, plus grand et ferré à gauche -->
        <h1 class="text-primary mb-2 md:mb-3 uppercase leading-none -mt-1" style="font-weight: 900;">
          <div class="text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] tracking-wide break-words">POINT</div>
          <div class="text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] tracking-wide break-words">THE MAP</div>
        </h1>

        <!-- Info Card sobre -->
        <div class="modal-card rounded-2xl p-6 md:p-8 mb-4 md:mb-6">
          <p class="text-primary text-3xl mb-3 font-black uppercase tracking-tight" id="challengeText">
            ${t("challenge")}
          </p>
          <p class="text-secondary text-base mb-1">
            ${t("capitalsInfo")}
          </p>
          <p class="text-tertiary text-sm">
            ${t("clickToWin")}
          </p>
        </div>
        
        <!-- Boutons classic / daily -->
        <div class="flex flex-col md:flex-row gap-3">
          <button id="btn-start-classic" class="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-5 px-6 rounded-xl text-lg" style="text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
            ${t("classic")}
          </button>
          <button id="btn-start-daily" class="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-black py-5 px-6 rounded-xl text-lg" style="text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
            ${t("daily")}
          </button>
        </div>
      </div>
    </div>

    <!-- Footer collé en bas -->
    <div class="w-full py-4 mt-auto" style="background: var(--bg-secondary); border-top: 1px solid var(--border-color);">
      <div class="max-w-3xl mx-auto px-4 md:px-8 text-center text-tertiary text-sm">
        ${t("madeBy")}
        <a href="https://github.com/Vandanael" target="_blank" rel="noopener noreferrer" class="font-semibold transition-colors no-underline hover:underline" style="color: var(--text-primary);">
          Vandanael
        </a>
      </div>
    </div>
  </div>
`;

export const GameOverScreen = (totalScore, lastPseudo = "") => {
  const escapedPseudo = escapeHtml(lastPseudo);
  return `
  <div id="result-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true" aria-labelledby="gameOverLabel">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
      <h2 class="text-5xl font-black text-primary mb-8 text-center tracking-tight uppercase" id="gameOverLabel">
        ${t("gameOver")}
      </h2>
      <div class="text-center mb-8">
        <div class="text-tertiary text-xs uppercase tracking-widest mb-3" id="finalScoreLabel">${t("finalScore")}</div>
        <div class="text-8xl font-black text-primary mb-4" id="finalScoreDisplay">${formatScore(totalScore)}</div>
      </div>

      <!-- Pseudo input -->
      <div class="mb-6" style="overflow: hidden;">
        <label class="text-secondary text-sm uppercase tracking-widest mb-2 block" id="pseudoLabel">
          ${t("yourPseudo")}
        </label>
        <div style="width: 100%; overflow: hidden; box-sizing: border-box;">
          <input
            id="pseudo-input"
            type="text"
            maxlength="5"
            minlength="3"
            value="${escapedPseudo}"
            placeholder="ABC"
            autocomplete="off"
            class="bg-transparent border-2 border-yellow-400 text-primary text-xl font-black uppercase tracking-widest py-4 px-4 rounded-xl text-center"
            style="width: 100%; letter-spacing: 0.1em; box-sizing: border-box; overflow: hidden; text-overflow: clip; max-width: 100%; outline: none !important; border: 2px solid var(--accent);"
          />
        </div>
        <p class="text-tertiary text-xs mt-2 text-center" id="pseudoHint">${t("pseudoHint")}</p>
        <p id="pseudo-error" class="text-red-400 text-sm mt-2 hidden">${t("pseudoError")}</p>
      </div>

      <div class="space-y-3">
        ${Button("btn-submit", t("save"), "primary")}
        ${Button("btn-replay", t("replayNoSave"), "secondary")}
      </div>
    </div>
  </div>
`;
};

export const FinalResults = (totalScore, pseudo, rank, isTopFifty, isNewSessionBest = false) => {
  const escapedPseudo = escapeHtml(pseudo);
  return `
  <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
    ${isNewSessionBest ? `<div class="text-center mb-4 text-4xl animate-bounce">🏆</div>` : ""}
    <h2 class="text-4xl font-black text-primary mb-6 text-center tracking-tight uppercase" id="newRecordLabel">
      ${isNewSessionBest ? "NOUVEAU RECORD" : isTopFifty ? t("top50") : t("scoreSaved")}
    </h2>
    <div class="text-center mb-6">
      <div class="text-8xl font-black text-yellow-400 mb-2">${formatScore(totalScore)}</div>
      <div class="text-secondary text-xl">
        <span class="font-mono font-bold text-primary">${escapedPseudo}</span> · ${t("rank")} #${rank}
      </div>
    </div>
    ${Button("btn-replay", t("replay"), "primary", true, true)}
  </div>
`;
};

export const LeaderboardRow = (rank, pseudo, score, time, isHighlighted = false) => {
  const medals = ["🥇", "🥈", "🥉"];
  const rankDisplay = rank <= 3 ? medals[rank - 1] : `#${rank}`;
  const escapedPseudo = escapeHtml(pseudo);

  return `
    <div class="flex items-center justify-between py-3 px-4 ${isHighlighted ? "rounded-xl" : ""}" style="${isHighlighted ? "background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.3);" : "border-bottom: 1px solid var(--border-color);"}">
      <div class="flex items-center gap-3">
        <span class="w-8 text-center font-bold ${rank <= 3 ? "text-yellow-400" : ""}" style="${rank > 3 ? "color: var(--text-tertiary);" : ""}">${rankDisplay}</span>
        <span class="font-mono font-bold ${isHighlighted ? "text-yellow-400" : ""}" style="${!isHighlighted ? "color: var(--text-primary);" : ""}">${escapedPseudo}</span>
      </div>
      <div class="text-right">
        <span class="font-bold ${isHighlighted ? "text-yellow-400" : ""}" style="${!isHighlighted ? "color: var(--text-primary);" : ""}">${formatScore(score)}</span>
        <span class="text-sm ml-2" style="color: var(--text-tertiary);">${(time / 1000).toFixed(1)}s</span>
      </div>
    </div>
  `;
};

// Skeleton row for loading state
export const LeaderboardSkeletonRow = () => `
  <div class="flex items-center justify-between py-3 px-4" style="border-bottom: 1px solid var(--border-color);">
    <div class="flex items-center gap-3">
      <div class="w-8 h-6 rounded" style="background: var(--bg-primary); opacity: 0.3; animation: pulse 1.5s ease-in-out infinite;"></div>
      <div class="w-16 h-6 rounded" style="background: var(--bg-primary); opacity: 0.3; animation: pulse 1.5s ease-in-out infinite;"></div>
    </div>
    <div class="flex gap-2">
      <div class="w-20 h-6 rounded" style="background: var(--bg-primary); opacity: 0.3; animation: pulse 1.5s ease-in-out infinite;"></div>
      <div class="w-12 h-6 rounded" style="background: var(--bg-primary); opacity: 0.3; animation: pulse 1.5s ease-in-out infinite;"></div>
    </div>
  </div>
`;

export const Leaderboard = (scores, highlightPseudo = null, loading = false) => `
  <div id="leaderboard-content" class="rounded-xl max-h-[400px]" style="background: var(--bg-tertiary); overflow: hidden;">
    ${loading ?
      // Show skeleton while loading
      Array(10).fill(0).map(() => LeaderboardSkeletonRow()).join('')
      : scores.length === 0 ? `
        <p class="text-center py-8 text-tertiary">${t("noScores")}</p>
      ` : scores.map((s) => LeaderboardRow(s.rank, s.pseudo, s.score, s.time, s.pseudo === highlightPseudo)).join("")
    }
  </div>
`;

export const LeaderboardModal = (scores, currentType = "classic", loading = false) => {
  const isClassic = currentType === "classic";
  const isDaily = currentType === "daily";

  return `
    <div id="leaderboard-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: calc(var(--z-modal) + 1);" role="dialog" aria-modal="true">
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
        <h2 class="text-3xl font-black text-primary mb-6 text-center tracking-tight uppercase" id="leaderboardTitle">
          ${t("leaderboard")}
        </h2>

        <!-- Boutons de switch -->
        <div class="flex gap-2 mb-6">
          <button
            id="btn-leaderboard-classic"
            class="flex-1 py-3 px-4 rounded-xl font-black text-lg transition-all ${
              isClassic
                ? "bg-yellow-400 text-black"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            }"
            ${loading ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
          >
            ${t("classic")}
          </button>
          <button
            id="btn-leaderboard-daily"
            class="flex-1 py-3 px-4 rounded-xl font-black text-lg transition-all ${
              isDaily
                ? "bg-yellow-400 text-black"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            }"
            ${loading ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
          >
            ${t("daily")}
          </button>
        </div>

        ${Leaderboard(scores, null, loading)}
        <div class="mt-6">
          ${Button("btn-close-leaderboard", t("close"), "secondary")}
        </div>
      </div>
    </div>
  `;
};

const getPseudoLockedTexts = () => {
  const lang = getLang();
  if (lang === "fr") {
    return {
      title: "Déjà enregistré !",
      message: "Cette machine joue sous le nom {{pseudo}}.",
      rule: "Règle du leaderboard : un pseudo par joueur.",
      button: "OK",
    };
  }
  return {
    title: "Already registered!",
    message: "This machine plays under the name {{pseudo}}.",
    rule: "Leaderboard rule: one nickname per player.",
    button: "OK",
  };
};

export const PseudoLockedDialog = (pseudo) => {
  const texts = getPseudoLockedTexts();
  const escapedPseudo = escapeHtml(pseudo);
  const message = texts.message.replace("{{pseudo}}", escapedPseudo);

  return `
    <div id="pseudo-locked-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true">
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
        <div class="text-center mb-6">
          <div class="text-5xl font-black text-primary mb-4">${texts.title}</div>
          <div class="text-secondary text-lg mb-2">${message}</div>
          <div class="text-tertiary text-sm">${texts.rule}</div>
        </div>
        ${Button("btn-pseudo-locked-ok", texts.button, "primary")}
      </div>
    </div>
  `;
};

/**
 * Toast notification component
 * @param {string} id - Toast ID
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'info', 'warning', 'error', 'success'
 * @returns {string} HTML string
 */
export const Toast = (id, message, type = "info") => {
  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    error: "❌",
    success: "✅",
  };

  const colors = {
    info: "bg-blue-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    success: "bg-green-500",
  };

  const icon = icons[type] || icons.info;
  const color = colors[type] || colors.info;

  return `
    <div id="${id}" class="fixed bottom-8 left-1/2 -translate-x-1/2 max-w-md w-full px-4 toast-slide-up" style="z-index: var(--z-toast);" role="alert" aria-live="assertive">
      <div class="${color} text-white rounded-xl shadow-lg p-4 flex items-start gap-3">
        <span class="text-2xl flex-shrink-0">${icon}</span>
        <div class="flex-1 text-sm font-medium" style="line-height: 1.5;">${escapeHtml(message)}</div>
        <button id="${id}-close" class="flex-shrink-0 text-white hover:text-gray-200 text-xl leading-none" aria-label="Close notification">×</button>
      </div>
    </div>
  `;
};
