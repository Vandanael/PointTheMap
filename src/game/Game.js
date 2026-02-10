// @ts-check
import { GAME } from '@lib/config/index.js';
import {
  MODE_IDS,
  getRuntimeGameConfig,
  getTargetsForMode,
  getTargetsFromSession,
  getRoundGameType,
  getNoTargetsError,
  getSessionBestScore,
  isCountryCategory,
  isCivilizationCategory,
} from '@lib/config/game-modes.js';
import { api } from '../services/api.js';
import { createRound, recordClick, timeoutRound } from './Round.js';
import { getStats } from '../features/StatsManager.js';
import { pointInPolygon } from '@lib/geo-utils/index.js';

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
 * @property {number} roundId
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
 * @property {Array<Capital|Country|Stadium|Civilization>} [targets] - Domain model: generic session targets
 * @property {Capital[]} capitals - Legacy: only populated for capital modes
 * @property {Country[]} countries - Legacy: only populated for country modes
 * @property {Stadium[]} stadiums - Legacy: only populated for stadium modes
 * @property {import('./Game.js').Civilization[]} civilizations - Legacy: only populated for civilization modes
 * @property {Round[]} rounds
 * @property {number} currentRoundIndex
 * @property {Round | null} currentRound
 * @property {number} roundIdSeq
 * @property {number} totalScore
 * @property {string | null} pseudo
 * @property {SubmitResult | null} result
 * @property {string | null} error
 * @property {number} sessionBestScore
 * @property {'classic' | 'daily' | 'country' | 'stadium' | 'civilization'} gameType
 * @property {RuntimeGameConfig | null} runtimeConfig - Mode-derived config for this session (set at start)
 */

/** @type {{ IDLE: GameStatusType, LOADING: GameStatusType, PLAYING: GameStatusType, ROUND_RESULT: GameStatusType, GAME_OVER: GameStatusType }} */
export const GameStatus = {
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  ROUND_RESULT: 'round_result',
  GAME_OVER: 'game_over',
};

/**
 * Create initial game state
 * @returns {GameState}
 */
export const createGameState = () => ({
  status: GameStatus.IDLE,
  token: null,
  targets: [], // Domain model: generic session targets
  // Legacy compatibility fields - avoid writing these outside of startGame.
  capitals: [],
  countries: [],
  stadiums: [],
  civilizations: [],
  rounds: [],
  currentRoundIndex: 0,
  currentRound: null,
  roundIdSeq: 0,
  totalScore: 0,
  pseudo: null,
  result: null,
  error: null,
  sessionBestScore: 0,
  gameType: /** @type {'classic' | 'daily' | 'country' | 'stadium' | 'civilization'} */ (
    MODE_IDS.CLASSIC
  ),
  runtimeConfig: null,
});

/**
 * Build legacy compatibility fields from targets.
 * @param {Array<Capital|Country|Stadium|Civilization>} targets
 * @param {string} roundGameType
 */
const buildLegacyTargetFields = (targets, roundGameType) => ({
  capitals: roundGameType === 'capital' ? /** @type {Capital[]} */ (targets) : [],
  countries: roundGameType === MODE_IDS.COUNTRY ? /** @type {Country[]} */ (targets) : [],
  stadiums: roundGameType === MODE_IDS.STADIUM ? /** @type {Stadium[]} */ (targets) : [],
  civilizations:
    roundGameType === MODE_IDS.CIVILIZATION ? /** @type {Civilization[]} */ (targets) : [],
});

/**
 * Start a new game session
 * @param {GameState} state - Current game state
 * @param {'classic' | 'daily' | 'country' | 'stadium' | 'civilization'} [gameType='classic'] - Type of game
 * @returns {Promise<GameState>}
 */
export const startGame = async (
  state,
  gameType = /** @type {'classic' | 'daily' | 'country' | 'stadium' | 'civilization'} */ (
    MODE_IDS.CLASSIC
  )
) => {
  const session = await api.start(gameType);
  const targets = /** @type {Array<Capital | Country | Stadium | Civilization>} */ (
    getTargetsFromSession(session, gameType)
  );

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
  const roundGameType = /** @type {'capital' | 'country' | 'stadium' | 'civilization'} */ (
    getRoundGameType(gameType)
  );

  return {
    ...createGameState(),
    status: GameStatus.PLAYING,
    token: session.token,
    // Domain model: store targets semantically (not mode-specific field names)
    targets,
    // Legacy fields: maintained for backward compatibility with existing code
    ...buildLegacyTargetFields(targets, roundGameType),
    currentRound: createRound(targets[0], 0, roundGameType, 0),
    gameType: /** @type {'classic' | 'daily' | 'country' | 'stadium' | 'civilization'} */ (
      gameType
    ),
    sessionBestScore: previousBestScore,
    runtimeConfig,
  };
};

/**
 * Process a round with user click
 * @param {GameState} state - Current game state
 * @param {[number, number]} clickCoords - [lat, lng] of user click
 * @param {import('./ports.js').MapQueryPort} mapQuery - Map query interface for geographic lookups
 * @param {import('./ports.js').RoundRulesPort} roundRules - Round rules interface for validation and scoring
 * @returns {GameState}
 */
export const playRound = (state, clickCoords, mapQuery, roundRules) => {
  if (state.status !== GameStatus.PLAYING || !state.currentRound) {
    return state;
  }

  const totalTimeAllowed = state.runtimeConfig
    ? state.runtimeConfig.timerMs + state.runtimeConfig.graceMs
    : undefined;

  let countryData = null;
  let civilizationData = null;
  const isCountryMode = isCountryCategory(state.gameType);
  const isCivilizationMode = isCivilizationCategory(state.gameType);

  // Handle country mode
  if (isCountryMode && state.currentRound.country) {
    const targetCountryId = state.currentRound.country.countryId;
    let clickedCountryId = mapQuery.getCountryAtLatLng(clickCoords);

    // Get target country feature from GeoJSON
    const targetCountryFeature = mapQuery.getCountryFeatureById(targetCountryId);

    let isInsideTargetCountry = clickedCountryId === targetCountryId;
    if (targetCountryFeature?.geometry && clickedCountryId !== targetCountryId) {
      const [lat, lng] = clickCoords;
      const point = {
        type: /** @type {'Point'} */ ('Point'),
        coordinates: /** @type {[number, number]} */ ([Number(lng), Number(lat)]),
      };
      if (pointInPolygon(point, targetCountryFeature.geometry)) {
        isInsideTargetCountry = true;
        // Prefer the correct country when polygons overlap.
        clickedCountryId = targetCountryId;
      }
    }

    countryData = {
      targetCountryFeature,
      isInsideTargetCountry,
      clickedCountryId,
    };
  }

  // Handle civilization mode
  if (isCivilizationMode && state.currentRound.civilization) {
    const targetCivilizationId = state.currentRound.civilization.id;
    let clickedCivilizationId = mapQuery.getCivilizationAtLatLng(clickCoords);
    const targetCivilizationFeature = mapQuery.getCivilizationFeatureById(targetCivilizationId);

    let isInsideTargetCivilization = clickedCivilizationId === targetCivilizationId;
    if (targetCivilizationFeature?.geometry && clickedCivilizationId !== targetCivilizationId) {
      const [lat, lng] = clickCoords;
      const point = {
        type: /** @type {'Point'} */ ('Point'),
        coordinates: /** @type {[number, number]} */ ([Number(lng), Number(lat)]),
      };
      if (pointInPolygon(point, targetCivilizationFeature.geometry)) {
        isInsideTargetCivilization = true;
        // Prefer the correct civilization when polygons overlap.
        clickedCivilizationId = targetCivilizationId;
      }
    }

    civilizationData = {
      targetCivilizationFeature,
      isInsideTargetCivilization,
      clickedCivilizationId,
    };
  }

  const completedRound = recordClick(
    state.currentRound,
    clickCoords,
    state.gameType,
    totalTimeAllowed,
    countryData,
    civilizationData,
    roundRules
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
  const nextRoundId = state.roundIdSeq + 1;
  const roundCount = state.runtimeConfig?.roundCount ?? GAME.ROUNDS;
  const targets = /** @type {Array<Capital | Country | Stadium | Civilization>} */ (
    getTargetsForMode(state)
  );
  const roundGameType = /** @type {'capital' | 'country' | 'stadium' | 'civilization'} */ (
    getRoundGameType(state.gameType)
  );

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
    currentRound: createRound(targets[nextIndex], nextIndex, roundGameType, nextRoundId),
    roundIdSeq: nextRoundId,
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
export const checkIfNewSessionBest = (state, score) => score > state.sessionBestScore;

/**
 * Update session best score if new score is higher
 * @param {GameState} state - Current game state
 * @param {number} score - New score
 * @returns {GameState}
 */
export const updateSessionBestScore = (state, score) =>
  score > state.sessionBestScore ? { ...state, sessionBestScore: score } : state;
