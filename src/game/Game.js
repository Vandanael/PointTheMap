import { GAME } from "../config.js";
import {
  MODE_IDS,
  getRuntimeGameConfig,
  getTargetsForMode,
  getTargetsFromSession,
  getRoundGameType,
  getNoTargetsError,
  getSessionBestScore,
} from "../config/game-modes.js";
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
 * @typedef {Object} Stadium
 * @property {string} name
 * @property {string} city
 * @property {string} country
 * @property {number} lat
 * @property {number} lng
 * @property {boolean} [popular]
 */

/**
 * @typedef {Object} Civilization
 * @property {string} id
 * @property {string} name
 * @property {boolean} popular
 */

/**
 * @typedef {Object} Round
 * @property {Capital | null} capital
 * @property {Country | null} country
 * @property {Stadium | null} stadium
 * @property {import('./Game.js').Civilization | null} [civilization] - For civilization mode
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
 * @property {string} [correctCivilizationId] - For civilization mode
 * @property {string | null} [clickedCivilizationId] - For civilization mode
 * @property {number | null} [distanceToTargetKm] - For country/civilization mode
 * @property {'playing' | 'completed' | 'timeout'} status
 * @property {string} [gameType] - 'capital' | 'country' | 'stadium' | 'civilization'
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
 * @property {Stadium[]} stadiums
 * @property {import('./Game.js').Civilization[]} civilizations
 * @property {Round[]} rounds
 * @property {number} currentRoundIndex
 * @property {Round | null} currentRound
 * @property {number} totalScore
 * @property {string | null} pseudo
 * @property {SubmitResult | null} result
 * @property {string | null} error
 * @property {number} sessionBestScore
 * @property {'classic' | 'daily' | 'country' | 'stadium' | 'civilization'} gameType
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
  stadiums: [],
  civilizations: [],
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
 * @param {'classic' | 'daily' | 'country' | 'stadium' | 'civilization'} [gameType='classic'] - Type of game
 * @returns {Promise<GameState>}
 */
export const startGame = async (state, gameType = "classic") => {
  try {
    const session = await api.start(gameType);
    const targets = getTargetsFromSession(session, gameType);

    if (!targets || targets.length === 0) {
      return {
        ...state,
        status: GameStatus.IDLE,
        error: getNoTargetsError(gameType),
      };
    }

    const stats = getStats();
    const previousBestScore = getSessionBestScore(stats, gameType);
    const runtimeConfig = getRuntimeGameConfig(gameType);
    const roundGameType = getRoundGameType(gameType);

    return {
      ...createGameState(),
      status: GameStatus.PLAYING,
      token: session.token,
      capitals: roundGameType === 'capital' ? session.capitals ?? [] : [],
      countries: roundGameType === 'country' ? session.countries ?? [] : [],
      stadiums: roundGameType === 'stadium' ? session.stadiums ?? [] : [],
      civilizations: roundGameType === 'civilization' ? session.civilizations ?? [] : [],
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
  let civilizationData = null;

  // Handle country mode
  if (state.gameType === MODE_IDS.COUNTRY && state.currentRound.country) {
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

  // Handle civilization mode
  if (state.gameType === MODE_IDS.CIVILIZATION && state.currentRound.civilization) {
    const targetCivilizationId = state.currentRound.civilization.id;
    const clickedCivilizationId = mapSystem.getCivilizationAtLatLng(clickCoords);
    const targetCivilizationFeature = mapSystem.getCivilizationFeatureById(targetCivilizationId);

    civilizationData = {
      targetCivilizationFeature,
      isInsideTargetCivilization: clickedCivilizationId === targetCivilizationId,
      clickedCivilizationId,
    };
  }

  const completedRound = recordClick(
    state.currentRound,
    clickCoords,
    state.gameType,
    totalTimeAllowed,
    countryData,
    civilizationData
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
  const targets = getTargetsForMode(state);
  const roundGameType = getRoundGameType(state.gameType);

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
  const round = state.currentRound;
  const key = getRoundGameType(state.gameType);
  return round[key] ?? null;
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
