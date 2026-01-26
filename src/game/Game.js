import { GAME } from "../config.js";
import { api } from "../services/api.js";
import { createRound, recordClick, timeoutRound } from "./Round.js";

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
 * @typedef {Object} Round
 * @property {Capital} capital
 * @property {number} roundNumber
 * @property {number} startTime
 * @property {number | null} endTime
 * @property {{lat: number, lng: number} | null} click
 * @property {number | null} distance
 * @property {number | null} score
 * @property {'playing' | 'completed' | 'timeout'} status
 */

/**
 * @typedef {Object} SubmitResult
 * @property {number} score
 * @property {number} rank
 * @property {boolean} isTopFifty
 * @property {Round[]} [rounds]
 */

/**
 * @typedef {Object} GameState
 * @property {GameStatusType} status
 * @property {string | null} token
 * @property {Capital[]} capitals
 * @property {Round[]} rounds
 * @property {number} currentRoundIndex
 * @property {Round | null} currentRound
 * @property {number} totalScore
 * @property {string | null} pseudo
 * @property {SubmitResult | null} result
 * @property {string | null} error
 * @property {number} sessionBestScore
 * @property {'classic' | 'daily'} gameType
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
  rounds: [],
  currentRoundIndex: 0,
  currentRound: null,
  totalScore: 0,
  pseudo: null,
  result: null,
  error: null,
  sessionBestScore: 0,
  gameType: "classic", // "classic" ou "daily"
});

/**
 * Start a new game session
 * @param {GameState} state - Current game state
 * @param {'classic' | 'daily'} [gameType='classic'] - Type of game
 * @returns {Promise<GameState>}
 */
export const startGame = async (state, gameType = "classic") => {
  try {
    const session = await api.start(gameType);
    if (!session?.capitals || session.capitals.length === 0) {
      return {
        ...state,
        status: GameStatus.IDLE,
        error: "Aucune capitale disponible",
      };
    }
    return {
      ...createGameState(),
      status: GameStatus.PLAYING,
      token: session.token,
      capitals: session.capitals,
      currentRound: createRound(session.capitals[0], 0),
      gameType,
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

  const completedRound = recordClick(state.currentRound, clickCoords);
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

  if (nextIndex >= GAME.ROUNDS) {
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
    currentRound: createRound(state.capitals[nextIndex], nextIndex),
  };
};

/**
 * Reset game to initial state
 * @returns {GameState}
 */
export const resetGame = () => createGameState();

/**
 * Get current capital being played
 * @param {GameState} state - Current game state
 * @returns {Capital | null}
 */
export const getCurrentCapital = (state) => state.currentRound?.capital || null;

/**
 * Check if current round is the last round
 * @param {GameState} state - Current game state
 * @returns {boolean}
 */
export const isLastRound = (state) =>
  state.currentRoundIndex >= GAME.ROUNDS - 1;

/**
 * Get game progress
 * @param {GameState} state - Current game state
 * @returns {{current: number, total: number}}
 */
export const getProgress = (state) => ({
  current: state.currentRoundIndex + 1,
  total: GAME.ROUNDS,
});

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
