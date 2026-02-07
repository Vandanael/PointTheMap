import { SCORING_THRESHOLDS } from '../config/index.js';
import { MODE_IDS } from '../config/game-modes.js';
import { escapeHtml } from '../utils/dom.js';
import { formatScore } from '../utils/format.js';
import { t, getLang } from '../i18n.js';
import { scoringSystem } from '../systems/ScoringSystem.js';

/**
 * @param {string} id
 * @param {string} content
 * @param {boolean} [fullScreen=true]
 */
export const Modal = (id, content, fullScreen = true) => `
  <div id="${id}" class="fixed ${fullScreen ? 'inset-0 modal-bg' : 'bottom-8 left-1/2 -translate-x-1/2'} ${fullScreen ? 'flex items-center justify-center' : ''}" style="z-index: var(--z-modal);">
    ${content}
  </div>
`;

/**
 * @param {string} id
 * @param {string} text
 * @param {"primary" | "secondary"} [variant="primary"]
 * @param {boolean} [fullWidth=true]
 * @param {boolean} [pulse=false]
 */
const Button = (id, text, variant = 'primary', fullWidth = true, pulse = false) => {
  /** @type {Record<"primary" | "secondary", string>} */
  const variants = {
    primary: 'bg-yellow-400 hover:bg-yellow-300 text-black',
    secondary: 'btn-secondary',
  };

  return `
    <button id="${id}" class="${fullWidth ? 'w-full' : 'px-6'} py-5 ${variants[variant]} font-black rounded-xl text-lg btn-scale ${pulse ? 'pulse-button' : ''}" style="text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      ${text}
    </button>
  `;
};

export const LoadingSpinner = () => `
  <div id="loading-spinner" class="fixed inset-0 flex items-center justify-center" style="background: var(--bg-primary); z-index: var(--z-overlay);" role="status" aria-live="polite" aria-busy="true">
    <div class="w-full max-w-md px-8 text-center">
      <!-- Barre de progression jaune -->
      <div class="w-full h-1 rounded-full overflow-hidden" style="background: var(--bg-tertiary);">
        <div id="loading-progress" class="h-full rounded-full" style="background: var(--accent); width: 100%; transform: scaleX(0); transform-origin: left; transition: transform 300ms ease-out;"></div>
      </div>
      <p class="text-tertiary text-xs uppercase tracking-widest mt-4">${t('loadingMap')}</p>
    </div>
  </div>
`;

export const TimerBar = () => `
  <div id="timer-bar" class="fixed top-0 left-0 right-0" style="width: 100%; height: 8px; background-color: transparent; pointer-events: none; z-index: calc(var(--z-base) + 1);">
    <div id="timer-progress" class="h-full bg-yellow-400" style="width: 100%; transition: width linear;"></div>
  </div>
`;

/**
 * @param {number} roundNum
 * @param {number} totalRounds
 * @param {number} totalScore
 */
export const GameHeader = (roundNum, totalRounds, totalScore) => {
  return `
  <div id="game-header" class="game-header fixed top-0 left-0 right-0" style="z-index: var(--z-base);">
    <div class="px-6 py-2 flex justify-between items-center" style="background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);">
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-secondary);">${t('round')}</div>
        <div id="game-round" class="text-lg font-black" style="color: var(--text-primary);">${roundNum}/${totalRounds}</div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium uppercase tracking-wider" style="color: var(--text-secondary);">${t('score')}</div>
        <div id="game-score" class="text-lg font-black text-yellow-400">${formatScore(totalScore)} pts</div>
      </div>
    </div>
  </div>
`;
};

/**
 * @param {string} capitalName
 * @param {string} country
 */
export const QuestionModal = (capitalName, country) => {
  const escapedCapital = escapeHtml(capitalName);
  const escapedCountry = escapeHtml(country);
  return `
  <div id="question-modal" class="fixed inset-0 flex items-center justify-center p-4" style="background: transparent; z-index: var(--z-modal); pointer-events: none;" role="dialog" aria-modal="true" aria-labelledby="capitalName">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content" style="box-shadow: 0 8px 32px rgba(0,0,0,0.4); pointer-events: auto;">
      <div class="text-center">
        <div class="text-yellow-400 text-3xl font-black mb-4 animate-pulse">${t('getReady')}</div>
        <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3" id="findLabel">${t('find')}</div>
        <h2 class="text-5xl font-black text-primary mb-2" id="capitalName">${escapedCapital}</h2>
        <div class="text-secondary text-base mb-6" id="countryName">${escapedCountry}</div>
        <div class="modal-section rounded-xl p-4 text-primary text-sm" id="clickMapLabel">
          ${t('clickOnMap')}
        </div>
      </div>
    </div>
  </div>
`;
};

/**
 * @param {string} capitalName
 * @param {string} country
 */
export const QuestionModalWithButton = (capitalName, country) => {
  const escapedCapital = escapeHtml(capitalName);
  const escapedCountry = escapeHtml(country);
  return `
  <div id="question-modal" class="fixed inset-0 flex items-center justify-center p-4" style="background: transparent; z-index: var(--z-modal); pointer-events: none;" role="dialog" aria-modal="true" aria-labelledby="capitalName">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content" style="box-shadow: 0 8px 32px rgba(0,0,0,0.4); pointer-events: auto;">
      <div class="text-center">
        <div class="text-yellow-400 text-3xl font-black mb-4 animate-pulse">${t('getReady')}</div>
        <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3" id="findLabel">${t('find')}</div>
        <h2 class="text-5xl font-black text-primary mb-2" id="capitalName">${escapedCapital}</h2>
        <div class="text-secondary text-base mb-6" id="countryName">${escapedCountry}</div>
        <div class="modal-section rounded-xl p-4 text-primary text-sm mb-6" id="clickMapLabel">
          ${t('clickOnMap')}
        </div>
        ${Button('btn-ready', t('start'), 'primary')}
      </div>
    </div>
  </div>
`;
};

/**
 * @param {number | null} distance - Distance in km, or null on timeout with no click
 * @param {number} score
 * @param {boolean} isTimeout
 * @param {boolean} isLast
 * @param {number} [baseScore] - Base score before time bonus
 * @param {number} [timeBonus] - Time bonus points
 */
export const RoundResult = (distance, score, isTimeout, isLast, baseScore, timeBonus) => {
  /**
   * @param {number | null} distanceKm
   */
  const formatDistance = (distanceKm) => {
    if (distanceKm === null || !Number.isFinite(distanceKm)) {
      return t('distanceUnknown');
    }
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${Math.round(distanceKm)} km`;
  };

  // Get category using shared thresholds
  const getCategory = () => {
    if (isTimeout || distance === null) return null;
    return scoringSystem.getScoreCategory(distance);
  };

  const category = getCategory();
  const getCategoryLabel = () => {
    if (!category) return null;
    return scoringSystem.getCategoryLabel(category);
  };

  // Icon based on category (using shared thresholds)
  const getIcon = () => {
    if (isTimeout) return '⏱️';
    if (!category || distance === null) return '🤔';
    const d = distance;
    const { PERFECT_MAX, EXCELLENT_MAX, GOOD_MAX, FAIR_MAX } = SCORING_THRESHOLDS;
    if (d < PERFECT_MAX) return '🏆';
    if (d < EXCELLENT_MAX) return '⭐';
    if (d < GOOD_MAX) return '🎯';
    if (d < FAIR_MAX) return '👍';
    return '👌';
  };

  if (isTimeout) {
    return `
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
        <div class="text-center mb-6">
          <div id="resultIcon" class="text-6xl mb-4">${getIcon()}</div>
          <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="distanceLabel">${t('timeUp')}</div>
          <div class="text-3xl font-black text-primary mb-6" id="distanceDisplay">${t('tooSlow')}</div>
          <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="pointsEarnedLabel">${t('pointsEarned')}</div>
          <div class="text-6xl font-black text-yellow-400 mb-2" id="pointsDisplay">0 pts</div>
        </div>
        ${Button('btn-next', isLast ? t('seeResults') : t('continue'), 'primary')}
      </div>
    `;
  }

  const categoryLabel = getCategoryLabel();
  const hasTimeBonus = timeBonus && timeBonus > 0;
  const isJuicy = category === 'perfect' || category === 'excellent';
  const stampText =
    category === 'perfect' ? 'PERFECT' : category === 'excellent' ? 'EXCELLENT' : '';

  return `
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
      ${
        isJuicy
          ? `
        <div class="result-stamp ${category === 'perfect' ? 'result-stamp-perfect' : 'result-stamp-excellent'}">
          ${stampText}
          <span class="result-confetti"></span>
          <span class="result-confetti"></span>
          <span class="result-confetti"></span>
        </div>
      `
          : ''
      }
      <div class="text-center mb-6">
        <div id="resultIcon" class="text-6xl mb-4">${getIcon()}</div>
        ${categoryLabel ? `<div class="text-xl font-bold text-primary mb-2" id="categoryLabel">${categoryLabel}</div>` : ''}
        <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="distanceLabel">${t('distance')}</div>
        <div class="text-5xl font-black text-primary mb-6" id="distanceDisplay">${formatDistance(distance)}</div>

        <div class="text-tertiary text-xs uppercase tracking-widest mb-2" id="pointsEarnedLabel">${t('pointsEarned')}</div>
        ${
          hasTimeBonus
            ? `
          <div class="mb-4">
            <div class="text-2xl font-bold text-primary mb-1">${t('base')}: ${formatScore(baseScore || 0)} pts</div>
            <div class="text-3xl font-black text-green-400 mb-2 animate-bounce">⚡ ${t('speedBonus')}: +${formatScore(timeBonus)} pts</div>
            <div class="text-5xl font-black text-yellow-400 animate-pulse" id="pointsDisplay">${formatScore(score)} pts</div>
          </div>
        `
            : `
          <div class="text-6xl font-black text-yellow-400 mb-2" id="pointsDisplay">${formatScore(score)} pts</div>
        `
        }
      </div>
      ${Button('btn-next', isLast ? t('seeResults') : t('continue'), 'primary')}
    </div>
  `;
};

export const StartScreen = () => `
  <div id="start-modal" class="start-modal-overlay fixed inset-0 flex flex-col" style="z-index: var(--z-modal);" role="dialog" aria-modal="true" aria-labelledby="challengeText">
    <!-- Toggle buttons: top-right (no position override so they stay aligned right) -->
    <div class="lobby-header-icons absolute top-4 right-4 md:top-6 md:right-6 flex gap-2" style="z-index: 10;">
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
    <div class="flex-1 flex items-center justify-center px-4 md:px-6 lobby-container" style="position: relative; z-index: 1;">
      <div class="w-full lobby-content">
        <!-- Titre Hero - MUST stay on 2 lines -->
        <h1 class="lobby-title">
          <div class="lobby-title-line">POINT</div>
          <div class="lobby-title-line">THE MAP</div>
        </h1>

        <!-- Desktop: Side-by-side | Mobile: Vertical stack -->
        <div class="lobby-main">
          <!-- Left side: 5S Challenge Card -->
          <div class="lobby-challenge-wrapper">
            <div id="challenge-card" class="challenge-card">
              <p class="challenge-title" id="challengeText">
                ${t('challenge')}
              </p>
              <p class="challenge-info">
                ${t('capitalsInfo')}
              </p>
              <p class="challenge-desc">
                ${t('clickToWin')}
              </p>
            </div>
          </div>

          <!-- Right side: Category Grid (2x2) - Compact -->
          <div class="lobby-categories-wrapper">
            <div class="category-grid">
              <button
                id="category-capitals"
                class="category-btn category-active"
                data-category="capitals"
                aria-label="${t('capitals')}"
                aria-pressed="true"
              >
                <span aria-hidden="true">${t('capitals')}</span>
              </button>
              <button
                id="category-countries"
                class="category-btn"
                data-category="countries"
                aria-label="${t('countries')}"
                aria-pressed="false"
              >
                <span aria-hidden="true">${t('countries')}</span>
              </button>
              <button
                id="category-civilizations"
                class="category-btn"
                data-category="civilizations"
                aria-label="${t('civilizations')}"
                aria-pressed="false"
              >
                <span aria-hidden="true">${t('civilizations')}</span>
              </button>
              <button
                id="category-stadiums"
                class="category-btn"
                data-category="stadiums"
                aria-label="${t('stadiums')}"
                aria-pressed="false"
              >
                <span aria-hidden="true">${t('stadiums')}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Mode Selector + Play Button -->
        <div class="lobby-actions">
          <!-- Pill Toggle for Mode Selection -->
          <div class="pill-toggle-wrapper">
            <label class="mode-label">${t('selectMode')}</label>
            <div class="pill-toggle" role="radiogroup" aria-label="${t('selectMode')}">
              <div id="pill-slider" class="pill-slider"></div>
              <button
                id="mode-${MODE_IDS.CLASSIC}"
                class="pill-option pill-option-active"
                data-mode="${MODE_IDS.CLASSIC}"
                role="radio"
                aria-checked="true"
              >
                ${t('classic')}
              </button>
              <button
                id="mode-${MODE_IDS.DAILY}"
                class="pill-option"
                data-mode="${MODE_IDS.DAILY}"
                role="radio"
                aria-checked="false"
              >
                ${t('daily')}
              </button>
            </div>
          </div>

          <!-- Main Action Button -->
          <button id="btn-start-game" class="play-btn" aria-label="${t('play')}">
            ${t('play')}
          </button>
        </div>
      </div>
    </div>

    <!-- Footer collé en bas -->
    <div class="lobby-footer" style="position: relative; z-index: 1;">
      <div class="lobby-footer-content">
        <div class="text-center md:text-left text-tertiary text-sm">
          ${t('madeBy')}
          <a href="https://github.com/Vandanael" target="_blank" rel="noopener noreferrer" class="font-semibold transition-colors no-underline hover:underline text-secondary">
            Vandanael
          </a>
        </div>
        <button id="btn-share-game" class="text-secondary hover:underline text-sm font-medium transition-colors" aria-label="Share game">
          ${t('share')}
        </button>
      </div>
    </div>
  </div>
`;

/**
 * @param {number} totalScore
 * @param {string} [lastPseudo=""]
 */
export const GameOverScreen = (totalScore, lastPseudo = '') => {
  const escapedPseudo = escapeHtml(lastPseudo);
  return `
  <div id="result-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true" aria-labelledby="gameOverLabel">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
      <h2 class="text-5xl font-black text-primary mb-8 text-center tracking-tight uppercase" id="gameOverLabel">
        ${t('gameOver')}
      </h2>
      <div class="text-center mb-8">
        <div class="text-tertiary text-xs uppercase tracking-widest mb-3" id="finalScoreLabel">${t('finalScore')}</div>
        <div class="text-6xl md:text-7xl font-black text-primary mb-4" id="finalScoreDisplay">${formatScore(totalScore)} pts</div>
      </div>

      <!-- Pseudo input -->
      <div class="mb-6" style="overflow: hidden;">
        <label for="pseudo-input" class="text-secondary text-sm uppercase tracking-widest mb-2 block" id="pseudoLabel">
          ${t('yourPseudo')}
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
            aria-labelledby="pseudoLabel"
            aria-describedby="pseudoHint pseudo-error"
            aria-invalid="false"
            class="bg-transparent border-2 border-yellow-400 text-primary text-xl font-black uppercase tracking-widest py-4 px-4 rounded-xl text-center"
            style="width: 100%; letter-spacing: 0.1em; box-sizing: border-box; overflow: hidden; text-overflow: clip; max-width: 100%; border: 2px solid var(--accent);"
          />
        </div>
        <p class="text-tertiary text-xs mt-2 text-center" id="pseudoHint">${t('pseudoHint')}</p>
        <p id="pseudo-error" class="text-red-400 text-sm mt-2 hidden" role="alert">${t('pseudoError')}</p>
      </div>

      <div class="space-y-3">
        ${Button('btn-submit', t('save'), 'primary')}
        ${Button('btn-replay', t('replayNoSave'), 'secondary')}
      </div>
    </div>
  </div>
`;
};

/**
 * @param {number} totalScore
 * @param {string} pseudo
 * @param {number} rank
 * @param {boolean} isTopFifty
 * @param {boolean} [isNewSessionBest=false]
 */
export const FinalResults = (totalScore, pseudo, rank, isTopFifty, isNewSessionBest = false) => {
  const escapedPseudo = escapeHtml(pseudo);
  return `
  <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
    ${isNewSessionBest ? `<div class="text-center mb-4 text-4xl animate-bounce">🏆</div>` : ''}
    <h2 class="text-4xl font-black text-primary mb-6 text-center tracking-tight uppercase" id="newRecordLabel">
      ${isNewSessionBest ? t('newPersonalBest') : isTopFifty ? t('top50') : t('scoreSaved')}
    </h2>
    <div class="text-center mb-6">
      <div class="text-6xl md:text-7xl font-black text-yellow-400 mb-2">${formatScore(totalScore)} pts</div>
      <div class="text-secondary text-xl">
        <span class="font-mono font-bold text-primary">${escapedPseudo}</span> · ${t('rank')} #${rank}
      </div>
    </div>

    <div class="mb-3">
      ${Button('btn-share', t('share'), 'secondary', true, false)}
    </div>

    ${Button('btn-replay', t('replay'), 'primary', true, true)}
  </div>
`;
};

/**
 * @param {number} rank
 * @param {string} pseudo
 * @param {number} score
 * @param {number} time
 * @param {boolean} [isHighlighted=false]
 */
const LeaderboardRow = (rank, pseudo, score, time, isHighlighted = false) => {
  const medals = ['🥇', '🥈', '🥉'];
  const rankDisplay = rank <= 3 ? medals[rank - 1] : `#${rank}`;
  const escapedPseudo = escapeHtml(pseudo);

  return `
    <div role="listitem" class="flex items-center justify-between py-3 px-4 ${isHighlighted ? 'rounded-xl' : ''}" style="${isHighlighted ? 'background: rgba(250, 204, 21, 0.1); border: 1px solid rgba(250, 204, 21, 0.3);' : 'border-bottom: 1px solid var(--border-color);'}">
      <div class="flex items-center gap-3">
        <span class="w-8 text-center font-bold ${rank <= 3 ? 'text-yellow-400' : ''}" style="${rank > 3 ? 'color: var(--text-tertiary);' : ''}">${rankDisplay}</span>
        <span class="font-mono font-bold ${isHighlighted ? 'text-yellow-400' : ''}" style="${!isHighlighted ? 'color: var(--text-primary);' : ''}">${escapedPseudo}</span>
      </div>
      <div class="text-right">
        <span class="font-bold ${isHighlighted ? 'text-yellow-400' : ''}" style="${!isHighlighted ? 'color: var(--text-primary);' : ''}">${formatScore(score)} pts</span>
        <span class="text-sm ml-2" style="color: var(--text-tertiary);">${(time / 1000).toFixed(1)}s</span>
      </div>
    </div>
  `;
};

// Skeleton row for loading state
const LeaderboardSkeletonRow = () => `
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

/**
 * @param {Array<{rank: number, pseudo: string, score: number, time: number}>} scores
 * @param {string | null} [highlightPseudo=null]
 * @param {boolean} [loading=false]
 */
export const Leaderboard = (scores, highlightPseudo = null, loading = false, error = null) => `
  <div id="leaderboard-content" class="leaderboard-panel rounded-xl max-h-[400px]" role="list" aria-label="${t('leaderboardTitle')}" style="background: var(--bg-tertiary);">
    ${
      loading
        ? // Skeleton loading
          Array(10)
            .fill(0)
            .map(() => LeaderboardSkeletonRow())
            .join('')
        : error
          ? `
      <!-- Network/server error -->
      <div class="leaderboard-center-state text-center py-8">
        <div class="text-4xl mb-4">⚠️</div>
        <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
        <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
          ${t('error.retry')}
        </button>
      </div>
    `
          : scores.length === 0
            ? `
      <!-- No scores yet (empty state) -->
      <div class="leaderboard-center-state text-center py-8">
        <div class="text-4xl mb-4">🏆</div>
        <p class="text-primary font-bold mb-2">${t('leaderboard.empty.title')}</p>
        <p class="text-tertiary text-sm">${t('leaderboard.empty.description')}</p>
      </div>
    `
            : // Normal leaderboard display
              scores
                .map(
                  (/** @type {{rank: number, pseudo: string, score: number, time: number}} */ s) =>
                    LeaderboardRow(s.rank, s.pseudo, s.score, s.time, s.pseudo === highlightPseudo)
                )
                .join('')
    }
  </div>
`;

/**
 * Map variant + category to API game type
 * @param {"classic"|"daily"} variant
 * @param {"capitals"|"countries"|"stadiums"|"civilizations"} category
 * @returns {string}
 */
export const leaderboardTypeFromSelection = (variant, category) => {
  const map = {
    capitals: { classic: MODE_IDS.CLASSIC, daily: MODE_IDS.DAILY },
    countries: { classic: MODE_IDS.COUNTRY, daily: MODE_IDS.COUNTRY_DAILY },
    stadiums: { classic: MODE_IDS.STADIUM, daily: MODE_IDS.STADIUM_DAILY },
    civilizations: { classic: MODE_IDS.CIVILIZATION, daily: MODE_IDS.CIVILIZATION_DAILY },
  };
  return map[category]?.[variant] ?? MODE_IDS.CLASSIC;
};

/**
 * Derive variant + category from an API type string
 * @param {string} type
 * @returns {{ variant: "classic"|"daily", category: "capitals"|"countries"|"stadiums"|"civilizations" }}
 */
export const selectionFromLeaderboardType = (type) => {
  /** @type {Record<string, { variant: "classic"|"daily", category: "capitals"|"countries"|"stadiums"|"civilizations" }>} */
  const map = {
    [MODE_IDS.CLASSIC]: { variant: 'classic', category: 'capitals' },
    [MODE_IDS.DAILY]: { variant: 'daily', category: 'capitals' },
    [MODE_IDS.COUNTRY]: { variant: 'classic', category: 'countries' },
    [MODE_IDS.COUNTRY_DAILY]: { variant: 'daily', category: 'countries' },
    [MODE_IDS.STADIUM]: { variant: 'classic', category: 'stadiums' },
    [MODE_IDS.STADIUM_DAILY]: { variant: 'daily', category: 'stadiums' },
    [MODE_IDS.CIVILIZATION]: { variant: 'classic', category: 'civilizations' },
    [MODE_IDS.CIVILIZATION_DAILY]: { variant: 'daily', category: 'civilizations' },
  };
  return map[type] ?? { variant: 'classic', category: 'capitals' };
};

/**
 * @param {Array<{rank: number, pseudo: string, score: number, time: number}>} scores
 * @param {string} [currentType="classic"]
 * @param {boolean} [loading=false]
 */
export const LeaderboardModal = (scores, currentType = MODE_IDS.CLASSIC, loading = false) => {
  const { variant, category } = selectionFromLeaderboardType(currentType);

  /**
   * @param {string} id
   * @param {string} label
   * @param {"classic"|"daily"} value
   */
  const variantBtn = (id, label, value) => `
    <button
      id="${id}"
      class="flex-1 py-2 px-3 rounded-xl font-black text-base transition-all ${
        value === variant ? 'bg-yellow-400 text-black' : 'btn-secondary'
      }"
      ${loading ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
    >
      ${label}
    </button>
  `;

  /**
   * @param {string} id
   * @param {string} label
   * @param {"capitals"|"countries"|"stadiums"|"civilizations"} value
   */
  const categoryBtn = (id, label, value) => `
    <button
      id="${id}"
      class="flex-1 py-2 px-2 rounded-xl font-bold text-sm transition-all ${
        value === category ? 'bg-yellow-400 text-black' : 'btn-secondary'
      }"
      ${loading ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
    >
      ${label}
    </button>
  `;

  return `
    <div id="leaderboard-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-overlay);" role="dialog" aria-modal="true">
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
        <h2 class="text-3xl font-black text-primary mb-6 text-center tracking-tight uppercase leaderboard-title" id="leaderboardTitle">
          ${t('leaderboardTitle')}
        </h2>

        <!-- Row 1: Variant (Classic / Daily) -->
        <div class="flex gap-2 mb-3 leaderboard-variant-row">
          ${variantBtn('btn-leaderboard-classic', t('classic'), 'classic')}
          ${variantBtn('btn-leaderboard-daily', t('daily'), 'daily')}
        </div>

        <!-- Row 2: Category -->
        <div class="flex gap-2 mb-6 leaderboard-category-row">
          ${categoryBtn('btn-leaderboard-cat-capitals', t('capitals'), 'capitals')}
          ${categoryBtn('btn-leaderboard-cat-countries', t('countries'), 'countries')}
          ${categoryBtn('btn-leaderboard-cat-stadiums', t('stadiums'), 'stadiums')}
          ${categoryBtn('btn-leaderboard-cat-civilizations', t('civilizations'), 'civilizations')}
        </div>

        ${Leaderboard(scores, null, loading)}
        <div class="mt-6">
          ${Button('btn-close-leaderboard', t('close'), 'secondary')}
        </div>
      </div>
    </div>
  `;
};

/**
 * @param {string} pseudo
 */
export const PseudoLockedDialog = (pseudo) => {
  const escapedPseudo = escapeHtml(pseudo);

  return `
    <div id="pseudo-locked-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true">
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
        <div class="text-center mb-6">
          <div class="text-5xl font-black text-primary mb-4">${t('pseudoLocked.title')}</div>
          <div class="text-secondary text-lg mb-2">${t('pseudoLocked.message', { pseudo: escapedPseudo })}</div>
          <div class="text-tertiary text-sm">${t('pseudoLocked.rule')}</div>
        </div>
        ${Button('btn-pseudo-locked-ok', t('ok'), 'primary')}
      </div>
    </div>
  `;
};

/**
 * Resume in-progress game dialog
 */
export const ResumePrompt = () => `
  <div id="resume-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
      <div class="text-center mb-6">
        <div class="text-3xl font-black text-primary mb-3">${t('resumePromptTitle')}</div>
        <div class="text-secondary text-base">${t('resumePromptMessage')}</div>
      </div>
      <div class="flex gap-3">
        ${Button('btn-resume-continue', t('resumePromptResume'), 'primary')}
        ${Button('btn-resume-discard', t('resumePromptDiscard'), 'secondary')}
      </div>
    </div>
  </div>
`;

/**
 * Map init error modal
 * @param {string} message
 */
export const MapErrorModal = (message) => `
  <div id="map-error-modal" class="fixed inset-0 modal-bg flex items-start justify-center p-4 modal-top-center" style="z-index: var(--z-modal);" role="dialog" aria-modal="true">
    <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content text-center">
      <div class="text-3xl font-black text-primary mb-4">${t('error.title')}</div>
      <div class="text-secondary text-base mb-8">${escapeHtml(message)}</div>
      ${Button('btn-map-error-ok', t('ok'), 'primary')}
    </div>
  </div>
`;

/**
 * Toast notification component
 * @param {string} id - Toast ID
 * @param {string} message - Message to display
 * @param {"info" | "warning" | "error" | "success"} type - Type of toast
 * @param {{ compact?: boolean, center?: boolean }} [options] - compact: smaller modal, no emoji, text only; center: center text horizontally
 * @returns {string} HTML string
 */
export const Toast = (id, message, type = 'info', options = {}) => {
  const { compact = false, center = false } = options;

  /** @type {Record<"info" | "warning" | "error" | "success", string>} */
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '',
  };

  const icon = compact ? '' : icons[type] || icons.info;
  const colorClass = `toast-${type}`;
  const wrapperClass = compact
    ? 'fixed top-6 left-1/2 -translate-x-1/2 max-w-xs w-full px-3 toast-slide-up'
    : 'fixed top-6 left-1/2 -translate-x-1/2 max-w-md w-full px-4 toast-slide-up';
  const innerClass = compact
    ? `${colorClass} text-white rounded-lg shadow-lg py-2.5 px-3 flex items-center gap-2 ${center ? 'justify-center' : ''}`
    : `${colorClass} text-white rounded-xl shadow-lg p-4 flex items-start gap-3`;
  const textClass = compact
    ? `flex-1 text-sm font-medium ${center ? 'text-center' : ''}`
    : 'flex-1 text-sm font-medium';

  return `
    <div id="${id}" class="${wrapperClass}" style="z-index: var(--z-toast);" role="alert" aria-live="assertive">
      <div class="${innerClass}">
        ${icon ? `<span class="text-2xl shrink-0">${icon}</span>` : ''}
        <div class="${textClass}" style="line-height: 1.5;">${escapeHtml(message)}</div>
      </div>
    </div>
  `;
};

/**
 * Map tiles error banner with retry action.
 * @param {string} message
 * @param {string} buttonLabel
 */
export const MapTilesErrorBanner = (message, buttonLabel) => `
  <div id="tiles-error-banner" class="tiles-error-banner" role="alert" aria-live="assertive">
    <div class="tiles-error-content">
      <div class="tiles-error-text">${escapeHtml(message)}</div>
      <button id="btn-tiles-retry" class="tiles-error-retry">${escapeHtml(buttonLabel)}</button>
    </div>
  </div>
`;

/**
 * Stats modal component
 * @param {{bestClassic: number, bestDaily: number, averageDistance: number, perfectCount: number, playCount: number, streakDaily: number}} stats
 */
export const MyStatsModal = (stats) => {
  /**
   * @param {number} km
   */
  const formatDistance = (km) => {
    if (km === Infinity || km === null || km === undefined || isNaN(km)) {
      return '—';
    }
    return `${km.toFixed(1)} km`;
  };

  return `
    <div id="stats-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4"
         style="z-index: var(--z-overlay);">
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content">
        <h2 class="text-3xl font-black text-primary mb-6 text-center tracking-tight uppercase">
          ${t('myStats')}
        </h2>

        <div class="space-y-4 mb-6">
          <div class="flex justify-between items-center py-3" style="border-bottom: 1px solid var(--border-color);">
            <span class="text-secondary">${t('stats.gamesPlayed')}</span>
            <span class="text-2xl font-black text-primary">${stats.playCount}</span>
          </div>

          <div class="flex justify-between items-center py-3" style="border-bottom: 1px solid var(--border-color);">
            <span class="text-secondary">${t('stats.bestClassic')}</span>
            <span class="text-2xl font-black text-yellow-400">${formatDistance(stats.bestClassic)}</span>
          </div>

          <div class="flex justify-between items-center py-3" style="border-bottom: 1px solid var(--border-color);">
            <span class="text-secondary">${t('stats.bestDaily')}</span>
            <span class="text-2xl font-black text-yellow-400">${formatDistance(stats.bestDaily)}</span>
          </div>

          <div class="flex justify-between items-center py-3" style="border-bottom: 1px solid var(--border-color);">
            <span class="text-secondary">${t('stats.avgDistance')}</span>
            <span class="text-2xl font-black text-primary">${formatDistance(stats.averageDistance)}</span>
          </div>

          <div class="flex justify-between items-center py-3" style="border-bottom: 1px solid var(--border-color);">
            <span class="text-secondary">${t('stats.perfectRounds')}</span>
            <span class="text-2xl font-black text-primary">${stats.perfectCount}</span>
          </div>

          <div class="flex justify-between items-center py-3">
            <span class="text-secondary">${t('stats.dailyStreak')}</span>
            <span class="text-2xl font-black text-yellow-400">${stats.streakDaily} 🔥</span>
          </div>
        </div>

        ${Button('btn-close-stats', t('close'), 'secondary')}
      </div>
    </div>
  `;
};

/**
 * Achievement unlock modal component
 * @param {string} achievementId
 * @param {{id: string, icon: string, labelKey: string, descKey: string}} achievement
 */

export const AchievementUnlockModal = (achievementId, achievement) => {
  return `
    <div id="achievement-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4 achievement-fade-in"
         style="z-index: var(--z-modal);" role="dialog" aria-modal="true" aria-labelledby="achievement-modal-title">
      <div class="modal-card rounded-2xl max-w-sm w-full p-8 modal-content">
        <div class="text-center">
          <div class="text-8xl mb-4 achievement-bounce">${achievement.icon}</div>
          <div class="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-2">
            ${t('achievement.unlocked')}
          </div>
          <h3 id="achievement-modal-title" class="text-3xl font-black text-primary mb-2">${t(achievement.labelKey)}</h3>
          <p class="text-secondary text-sm mb-6">${t(achievement.descKey)}</p>

          <div class="mb-3">
            ${Button(`btn-share-achievement-${achievementId}`, t('shareOnAchievement'), 'secondary', true, false)}
          </div>

          ${Button('btn-close-achievement', t('continue'), 'secondary')}
        </div>
      </div>
    </div>
  `;
};
