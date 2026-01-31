import { GAME } from "../config.js";
import { getRuntimeGameConfig } from "../config/game-modes.js";
import { api } from "../services/api.js";
import { createRound, recordClick, timeoutRound } from "./Round.js";
import { getStats } from "../features/StatsManager.js";
import { mapSystem } from "../systems/MapSystem.js";

/**
 * @typedef {'idle' | 'loading' | 'playing' | 'round_result' | 'game_over'} GameStatusType
 */

/**
 * @typedef {Object} Capital
 * @property {string} name
 * @property {string} country
 * @property {number} lat
 * @property {number} lng
 * @property {boolean} [popular]
 */

/**
 * @typedef {Object} Country
 * @property {string} name
 * @property {string} countryId
 * @property {boolean} popular
 */

/**
 * @typedef {Object} Round
 * @property {Capital | null} capital
 * @property {Country | null} country
 * @property {number} roundNumber
 * @property {number} startTime
 * @property {number | null} endTime
 * @property {{lat: number, lng: number} | null} click
 * @property {number | null} distance
 * @property {number | null} score
 * @property {number} [baseScore] - Base score before time bonus
 * @property {number} [timeBonus] - Time bonus points
 * @property {string} [correctCountryId] - For country mode
 * @property {string | null} [clickedCountryId] - For country mode
 * @property {number | null} [distanceToTargetKm] - For country mode
 * @property {'playing' | 'completed' | 'timeout'} status
 * @property {string} [gameType] - 'capital' or 'country'
 */

/**
 * @typedef {Object} SubmitResult
 * @property {number} score
 * @property {number} rank
 * @property {boolean} isTopFifty
 * @property {Round[]} [rounds]
 */

/**
 * @typedef {import('../config/game-modes.js').RuntimeGameConfig} RuntimeGameConfig
 */

/**
 * @typedef {Object} GameState
 * @property {GameStatusType} status
 * @property {string | null} token
 * @property {Capital[]} capitals
 * @property {Country[]} countries
 * @property {Round[]} rounds
 * @property {number} currentRoundIndex
 * @property {Round | null} currentRound
 * @property {number} totalScore
 * @property {string | null} pseudo
 * @property {SubmitResult | null} result
 * @property {string | null} error
 * @property {number} sessionBestScore
 * @property {'classic' | 'daily' | 'country'} gameType
 * @property {RuntimeGameConfig | null} runtimeConfig - Mode-derived config for this session (set at start)
 */

export const GameStatus = {
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  ROUND_RESULT: "round_result",
  GAME_OVER: "game_over",
};

/**
 * Create initial game state
 * @returns {GameState}
 */
export const createGameState = () => ({
  status: GameStatus.IDLE,
  token: null,
  capitals: [],
  countries: [],
  rounds: [],
  currentRoundIndex: 0,
  currentRound: null,
  totalScore: 0,
  pseudo: null,
  result: null,
  error: null,
  sessionBestScore: 0,
  gameType: "classic",
  runtimeConfig: null,
});

/**
 * Start a new game session
 * @param {GameState} state - Current game state
 * @param {'classic' | 'daily' | 'country'} [gameType='classic'] - Type of game
 * @returns {Promise<GameState>}
 */
export const startGame = async (state, gameType = "classic") => {
  try {
    const session = await api.start(gameType);
    const isCountryMode = gameType === 'country';
    const targets = isCountryMode ? session.countries : session.capitals;

    if (!targets || targets.length === 0) {
      return {
        ...state,
        status: GameStatus.IDLE,
        error: isCountryMode ? "Aucun pays disponible" : "Aucune capitale disponible",
      };
    }

    // Load best score from stats to initialize sessionBestScore
    const stats = getStats();
    const previousBestScore = gameType === 'country'
      ? stats.bestScoreCountry ?? 0
      : gameType === 'classic'
        ? stats.bestScoreClassic
        : stats.bestScoreDaily;

    const runtimeConfig = getRuntimeGameConfig(gameType);
    const roundGameType = isCountryMode ? 'country' : 'capital';

    return {
      ...createGameState(),
      status: GameStatus.PLAYING,
      token: session.token,
      capitals: isCountryMode ? [] : session.capitals,
      countries: isCountryMode ? session.countries : [],
      currentRound: createRound(targets[0], 0, roundGameType),
      gameType,
      sessionBestScore: previousBestScore,
      runtimeConfig,
    };
  } catch (error) {
    return {
      ...state,
      status: GameStatus.IDLE,
      error: error.message,
    };
  }
};

/**
 * Process a round with user click
 * @param {GameState} state - Current game state
 * @param {[number, number]} clickCoords - [lat, lng] of user click
 * @returns {GameState}
 */
export const playRound = (state, clickCoords) => {
  if (state.status !== GameStatus.PLAYING || !state.currentRound) {
    return state;
  }

  const totalTimeAllowed = state.runtimeConfig
    ? state.runtimeConfig.timerMs + state.runtimeConfig.graceMs
    : undefined;

  let countryData = null;

  // Handle country mode
  if (state.gameType === 'country' && state.currentRound.country) {
    const targetCountryId = state.currentRound.country.countryId;
    const clickedCountryId = mapSystem.getCountryAtLatLng(clickCoords);

    // Get target country feature from GeoJSON
    const targetCountryFeature = mapSystem.getCountryFeatureById(targetCountryId);

    countryData = {
      targetCountryFeature,
      isInsideTargetCountry: clickedCountryId === targetCountryId,
      clickedCountryId,
    };
  }

  const completedRound = recordClick(
    state.currentRound,
    clickCoords,
    state.gameType,
    totalTimeAllowed,
    countryData
  );

  return {
    ...state,
    status: GameStatus.ROUND_RESULT,
    rounds: [...state.rounds, completedRound],
    currentRound: completedRound,
    totalScore: state.totalScore + completedRound.score,
  };
};

/**
 * Handle round timeout
 * @param {GameState} state - Current game state
 * @returns {GameState}
 */
export const handleTimeout = (state) => {
  if (state.status !== GameStatus.PLAYING || !state.currentRound) {
    return state;
  }

  const timedOutRound = timeoutRound(state.currentRound);
  return {
    ...state,
    status: GameStatus.ROUND_RESULT,
    rounds: [...state.rounds, timedOutRound],
    currentRound: timedOutRound,
  };
};

/**
 * Advance to next round or end game
 * @param {GameState} state - Current game state
 * @returns {GameState}
 */
export const nextRound = (state) => {
  const nextIndex = state.currentRoundIndex + 1;
  const roundCount = state.runtimeConfig?.roundCount ?? GAME.ROUNDS;
  const targets = state.gameType === 'country' ? state.countries : state.capitals;
  const roundGameType = state.gameType === 'country' ? 'country' : 'capital';

  if (nextIndex >= roundCount || nextIndex >= targets.length) {
    return {
      ...state,
      status: GameStatus.GAME_OVER,
      currentRound: null,
    };
  }

  return {
    ...state,
    status: GameStatus.PLAYING,
    currentRoundIndex: nextIndex,
    currentRound: createRound(targets[nextIndex], nextIndex, roundGameType),
  };
};

/**
 * Reset game to initial state
 * @returns {GameState}
 */
export const resetGame = () => createGameState();

/**
 * Get current target being played (capital or country)
 * @param {GameState} state - Current game state
 * @returns {Capital | Country | null}
 */
export const getCurrentTarget = (state) => {
  if (!state.currentRound) return null;
  return state.gameType === 'country'
    ? state.currentRound.country
    : state.currentRound.capital;
};

/**
 * Get current capital being played (legacy compatibility)
 * @param {GameState} state - Current game state
 * @returns {Capital | null}
 */
export const getCurrentCapital = (state) => state.currentRound?.capital || null;

/**
 * Check if current round is the last round
 * @param {GameState} state - Current game state
 * @returns {boolean}
 */
export const isLastRound = (state) => {
  const roundCount = state.runtimeConfig?.roundCount ?? GAME.ROUNDS;
  return state.currentRoundIndex >= roundCount - 1;
};

/**
 * Get game progress
 * @param {GameState} state - Current game state
 * @returns {{current: number, total: number}}
 */
export const getProgress = (state) => {
  const total = state.runtimeConfig?.roundCount ?? GAME.ROUNDS;
  return {
    current: state.currentRoundIndex + 1,
    total,
  };
};

/**
 * Check if score is a new session best
 * @param {GameState} state - Current game state
 * @param {number} score - Score to check
 * @returns {boolean}
 */
export const checkIfNewSessionBest = (state, score) =>
  score > state.sessionBestScore;

/**
 * Update session best score if new score is higher
 * @param {GameState} state - Current game state
 * @param {number} score - New score
 * @returns {GameState}
 */
export const updateSessionBestScore = (state, score) =>
  score > state.sessionBestScore
    ? { ...state, sessionBestScore: score }
    : state;
