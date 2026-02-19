/**
 * Game Mode Configuration System
 * Centralized definitions for all game modes
 *
 * This file provides a single source of truth for game mode configurations,
 * making it easy to add new modes without modifying function code.
 */

import { GAME } from './runtime.js';
import { SCORING } from './scoring.js';

/**
 * Game mode configuration object
 * @typedef {Object} GameModeConfig
 * @property {string} id - Unique mode identifier
 * @property {string} name - Display name
 * @property {string} description - Mode description
 * @property {Object} [capitalSelection] - Capital selection configuration
 * @property {"random" | "seeded"} [capitalSelection.type] - Selection type
 * @property {string} [capitalSelection.dataSource] - Data source: 'capitals'
 * @property {number} [capitalSelection.count] - Number of capitals to select
 * @property {Object} [capitalSelection.balancing] - Balancing configuration
 * @property {number} [capitalSelection.balancing.popular] - Number of popular capitals
 * @property {number} [capitalSelection.balancing.obscure] - Number of obscure capitals
 * @property {(date: Date) => number} [capitalSelection.seed] - Seed function for seeded selection
 * @property {Object} [countrySelection] - Country selection configuration
 * @property {"random" | "seeded"} [countrySelection.type]
 * @property {string} [countrySelection.dataSource]
 * @property {number} [countrySelection.count]
 * @property {{ popular: number, obscure: number }} [countrySelection.balancing]
 * @property {(date: Date) => number} [countrySelection.seed]
 * @property {Object} [stadiumSelection] - Stadium selection configuration
 * @property {"random" | "seeded"} [stadiumSelection.type]
 * @property {string} [stadiumSelection.dataSource]
 * @property {number} [stadiumSelection.count]
 * @property {{ popular: number, obscure: number }} [stadiumSelection.balancing]
 * @property {(date: Date) => number} [stadiumSelection.seed]
 * @property {Object} [civilizationSelection] - Civilization selection configuration
 * @property {"random" | "seeded"} [civilizationSelection.type]
 * @property {string} [civilizationSelection.dataSource]
 * @property {number} [civilizationSelection.count]
 * @property {{ popular: number, obscure: number }} [civilizationSelection.balancing]
 * @property {(date: Date) => number} [civilizationSelection.seed]
 * @property {Object} scoring - Scoring configuration
 * @property {string} [scoring.type] - Scoring algorithm type (e.g., 'country')
 * @property {number} scoring.maxPerRound - Maximum score per round
 * @property {Object} scoring.timeBonus - Time bonus configuration
 * @property {boolean} scoring.timeBonus.enabled - Whether time bonus is enabled
 * @property {number} scoring.timeBonus.maxBonus - Maximum time bonus points
 * @property {number} [scoring.timeBonus.maxBonusPercent] - Maximum bonus as percentage
 * @property {Object} timing - Timing configuration
 * @property {number} timing.roundTime - Time per round in milliseconds
 * @property {number} timing.gracePeriod - Grace period in milliseconds
 * @property {number} timing.roundCount - Number of rounds
 * @property {Object} leaderboard - Leaderboard configuration
 * @property {string} leaderboard.deduplication - Deduplication strategy
 * @property {string} leaderboard.timeframe - Leaderboard timeframe
 */

/**
 * Modes: capital (locate capitals) vs country (locate countries).
 * Each mode can be played as classic (random) or daily (seeded); country currently has classic only.
 */
const MODES = {
  capital: {
    id: 'capital',
    name: 'Capital',
    variants: ['classic', 'daily'],
  },
  country: {
    id: 'country',
    name: 'Country',
    variants: ['classic', 'daily'],
  },
  stadium: {
    id: 'stadium',
    name: 'Stadium',
    variants: ['classic', 'daily'],
  },
  civilization: {
    id: 'civilization',
    name: 'Civilization',
    variants: ['classic', 'daily'],
  },
};

/**
 * Game type string constants — use these instead of magic strings.
 * @type {{ CLASSIC: string, DAILY: string, COUNTRY: string, STADIUM: string, CIVILIZATION: string, COUNTRY_DAILY: string, STADIUM_DAILY: string, CIVILIZATION_DAILY: string }}
 */
export const MODE_IDS = {
  CLASSIC: 'classic',
  DAILY: 'daily',
  COUNTRY: 'country',
  STADIUM: 'stadium',
  CIVILIZATION: 'civilization',
  COUNTRY_DAILY: 'country_daily',
  STADIUM_DAILY: 'stadium_daily',
  CIVILIZATION_DAILY: 'civilization_daily',
};

/** Canonical list of all supported mode string values. */
export const MODE_VALUES = Object.values(MODE_IDS);

/** @param {string} gt */
export const isDailyVariant = (gt) =>
  gt === MODE_IDS.DAILY ||
  gt === MODE_IDS.COUNTRY_DAILY ||
  gt === MODE_IDS.STADIUM_DAILY ||
  gt === MODE_IDS.CIVILIZATION_DAILY;

/** @param {string} gt */
export const isCapitalCategory = (gt) => gt === MODE_IDS.CLASSIC || gt === MODE_IDS.DAILY;

/** @param {string} gt */
export const isStadiumCategory = (gt) => gt === MODE_IDS.STADIUM || gt === MODE_IDS.STADIUM_DAILY;

/** @param {string} gt */
export const isCountryCategory = (gt) => gt === MODE_IDS.COUNTRY || gt === MODE_IDS.COUNTRY_DAILY;

/** @param {string} gt */
export const isCivilizationCategory = (gt) =>
  gt === MODE_IDS.CIVILIZATION || gt === MODE_IDS.CIVILIZATION_DAILY;

const DEFAULT_BALANCING = { popular: 2, obscure: 3 };
const DAILY_SEED_SALT = 73856093;
const DAILY_SEED_MOD = 999999;

/** @param {Date} date */
const createDailySeed = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;
  return (parseInt(dateString, 10) * DAILY_SEED_SALT) % DAILY_SEED_MOD;
};

/**
 * @param {{ type: 'random' | 'seeded', dataSource: string }} options
 */
const createSelection = ({ type, dataSource }) => ({
  type,
  dataSource,
  count: 5,
  balancing: DEFAULT_BALANCING,
  ...(type === 'seeded' ? { seed: createDailySeed } : {}),
});

/** @param {{ scoringType?: string }} [options] */
const createScoring = ({ scoringType } = {}) => ({
  maxPerRound: 5000,
  ...(scoringType ? { type: scoringType } : {}),
  timeBonus: {
    enabled: true,
    maxBonus: 1000,
    maxBonusPercent: 0.2,
  },
});

const createTiming = () => ({
  roundTime: 5000,
  gracePeriod: 1000,
  roundCount: 5,
});

/** @param {'all_time' | 'daily'} timeframe */
const createLeaderboard = (timeframe) => ({
  deduplication: 'by_pseudo',
  timeframe,
});

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   selectionKey: 'capitalSelection' | 'countrySelection' | 'stadiumSelection' | 'civilizationSelection',
 *   selectionType: 'random' | 'seeded',
 *   selectionDataSource: string,
 *   scoringType?: string,
 *   leaderboardTimeframe: 'all_time' | 'daily'
 * }} options
 * @returns {GameModeConfig}
 */
const createGameMode = ({
  id,
  name,
  description,
  selectionKey,
  selectionType,
  selectionDataSource,
  scoringType,
  leaderboardTimeframe,
}) => ({
  id,
  name,
  description,
  [selectionKey]: createSelection({ type: selectionType, dataSource: selectionDataSource }),
  scoring: createScoring({ scoringType }),
  timing: createTiming(),
  leaderboard: createLeaderboard(leaderboardTimeframe),
});

/**
 * Game-type configs keyed by API game type.
 * @type {Object.<string, GameModeConfig>}
 */
export const GAME_MODES = {
  classic: createGameMode({
    id: 'classic',
    name: 'Classic Mode',
    description: 'Timeless geography challenge',
    selectionKey: 'capitalSelection',
    selectionType: 'random',
    selectionDataSource: 'capitals',
    leaderboardTimeframe: 'all_time',
  }),
  daily: createGameMode({
    id: 'daily',
    name: 'Daily Challenge',
    description: 'Same capitals for everyone today',
    selectionKey: 'capitalSelection',
    selectionType: 'seeded',
    selectionDataSource: 'capitals',
    leaderboardTimeframe: 'daily',
  }),
  country: createGameMode({
    id: 'country',
    name: 'Country Mode',
    description: 'Find countries on the map',
    selectionKey: 'countrySelection',
    selectionType: 'random',
    selectionDataSource: 'countries',
    scoringType: 'country',
    leaderboardTimeframe: 'all_time',
  }),
  country_daily: createGameMode({
    id: 'country_daily',
    name: 'Country Daily Challenge',
    description: 'Same countries for everyone today',
    selectionKey: 'countrySelection',
    selectionType: 'seeded',
    selectionDataSource: 'countries',
    scoringType: 'country',
    leaderboardTimeframe: 'daily',
  }),
  stadium: createGameMode({
    id: 'stadium',
    name: 'Stadium Mode',
    description: 'Find stadiums on the map',
    selectionKey: 'stadiumSelection',
    selectionType: 'random',
    selectionDataSource: 'stadiums',
    leaderboardTimeframe: 'all_time',
  }),
  stadium_daily: createGameMode({
    id: 'stadium_daily',
    name: 'Stadium Daily Challenge',
    description: 'Same stadiums for everyone today',
    selectionKey: 'stadiumSelection',
    selectionType: 'seeded',
    selectionDataSource: 'stadiums',
    leaderboardTimeframe: 'daily',
  }),
  civilization: createGameMode({
    id: 'civilization',
    name: 'Civilization Mode',
    description: 'Find civilizations on the map',
    selectionKey: 'civilizationSelection',
    selectionType: 'random',
    selectionDataSource: 'civilizations',
    scoringType: 'country',
    leaderboardTimeframe: 'all_time',
  }),
  civilization_daily: createGameMode({
    id: 'civilization_daily',
    name: 'Civilization Daily Challenge',
    description: 'Same civilizations for everyone today',
    selectionKey: 'civilizationSelection',
    selectionType: 'seeded',
    selectionDataSource: 'civilizations',
    scoringType: 'country',
    leaderboardTimeframe: 'daily',
  }),
};

for (const [modeId, mode] of Object.entries(GAME_MODES)) {
  const canonicalTimeBonus = SCORING.TIME_BONUS_BY_MODE[modeId];
  if (canonicalTimeBonus) {
    mode.scoring.timeBonus = canonicalTimeBonus;
  }
}

/**
 * Runtime helpers keyed by game type: targets(state), roundGameType, noTargetsErrorKey, sessionBestScoreKey.
 * noTargetsErrorKey is an i18n key (e.g. error.noTargetsCapitals); callers must pass through t() for display.
 * @type {Object.<string, { targets: (state: { gameType: string, targets?: unknown[] }) => unknown[], roundGameType: string, noTargetsErrorKey: string, sessionBestScoreKey: string }>}
 */
const MODE_CONFIG = {
  [MODE_IDS.CLASSIC]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'capital',
    noTargetsErrorKey: 'error.noTargetsCapitals',
    sessionBestScoreKey: 'bestScoreClassic',
  },
  [MODE_IDS.DAILY]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'capital',
    noTargetsErrorKey: 'error.noTargetsCapitals',
    sessionBestScoreKey: 'bestScoreDaily',
  },
  [MODE_IDS.COUNTRY]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'country',
    noTargetsErrorKey: 'error.noTargetsCountries',
    sessionBestScoreKey: 'bestScoreCountry',
  },
  [MODE_IDS.STADIUM]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'stadium',
    noTargetsErrorKey: 'error.noTargetsStadiums',
    sessionBestScoreKey: 'bestScoreStadium',
  },
  [MODE_IDS.CIVILIZATION]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'civilization',
    noTargetsErrorKey: 'error.noTargetsCivilizations',
    sessionBestScoreKey: 'bestScoreCivilization',
  },
  [MODE_IDS.COUNTRY_DAILY]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'country',
    noTargetsErrorKey: 'error.noTargetsCountries',
    sessionBestScoreKey: 'bestScoreCountryDaily',
  },
  [MODE_IDS.STADIUM_DAILY]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'stadium',
    noTargetsErrorKey: 'error.noTargetsStadiums',
    sessionBestScoreKey: 'bestScoreStadiumDaily',
  },
  [MODE_IDS.CIVILIZATION_DAILY]: {
    targets: (state) => state.targets ?? [],
    roundGameType: 'civilization',
    noTargetsErrorKey: 'error.noTargetsCivilizations',
    sessionBestScoreKey: 'bestScoreCivilizationDaily',
  },
};

/**
 * Get targets array for current game type from state.
 * @param {{ gameType: string, targets?: unknown[] }} state
 * @returns {unknown[]}
 */
export function getTargetsForMode(state) {
  const config = MODE_CONFIG[state.gameType];
  return config ? config.targets(state) : (state.targets ?? []);
}

/**
 * Get targets array from session (for startGame).
 * @param {{ targets?: unknown[] }} session
 * @param {string} gameType
 * @returns {unknown[]}
 */
export function getTargetsFromSession(session, gameType) {
  if (!MODE_CONFIG[gameType]) return [];
  return Array.isArray(session.targets) ? session.targets : [];
}

/**
 * Get round game type string for API game type.
 * @param {string} gameType
 * @returns {string}
 */
export function getRoundGameType(gameType) {
  const config = MODE_CONFIG[gameType];
  return config ? config.roundGameType : 'capital';
}

/**
 * Get "no targets available" i18n key for game type. Call t(getNoTargetsError(gameType)) for display.
 * @param {string} gameType
 * @returns {string}
 */
export function getNoTargetsError(gameType) {
  const config = MODE_CONFIG[gameType];
  return config ? config.noTargetsErrorKey : 'error.noTargetsCapitals';
}

/**
 * Get session best score from stats for game type.
 * @param {Record<string, number>} stats
 * @param {string} gameType
 * @returns {number}
 */
export function getSessionBestScore(stats, gameType) {
  const config = MODE_CONFIG[gameType];
  const key = config ? config.sessionBestScoreKey : 'bestScoreClassic';
  return stats[key] ?? 0;
}

/**
 * Get mode configuration by ID
 * @param {string} modeId - Mode identifier
 * @returns {GameModeConfig} Mode configuration
 * @throws {Error} if mode not found
 */
export function getGameMode(modeId) {
  const mode = GAME_MODES[modeId];
  if (!mode) {
    throw new Error(`Unknown game mode: ${modeId}`);
  }
  return mode;
}

/**
 * Validate mode ID
 * @param {string} modeId - Mode identifier to validate
 * @returns {boolean} True if mode exists
 */
export function isValidMode(modeId) {
  return modeId in GAME_MODES;
}

/**
 * Get time bonus configuration for a mode.
 * Returns null for invalid mode IDs.
 * @param {string} modeId
 * @returns {{ enabled: boolean, maxBonus: number, maxBonusPercent?: number } | null}
 */
export function getTimeBonusConfig(modeId) {
  if (!isValidMode(modeId)) return null;
  return SCORING.TIME_BONUS_BY_MODE[modeId] ?? null;
}

/**
 * Get all available modes (capital, country). Each mode can have classic/daily variants.
 * @returns {{ id: string, name: string, variants: string[] }[]}
 */
export function getAllModes() {
  return Object.values(MODES);
}

/**
 * Get mode IDs (capital, country).
 * @returns {string[]} Array of mode IDs
 */
export function getModeIds() {
  return Object.keys(MODES);
}

/**
 * Runtime game config used by the client during live play.
 * Derived from mode; single source of truth (no GAME.* in runtime paths).
 * @typedef {Object} RuntimeGameConfig
 * @property {number} roundCount - Number of rounds
 * @property {number} timerMs - Round timer duration (ms)
 * @property {number} graceMs - Grace period before timer starts (ms)
 * @property {number} dangerZoneMs - Time before expiry for "danger" visual (ms)
 */

/**
 * Get runtime game config for the given mode.
 * Use this in live play; do not read GAME.* in runtime paths.
 * @param {string} modeId - Mode identifier ('classic' | 'daily' | …)
 * @returns {RuntimeGameConfig}
 */
export function getRuntimeGameConfig(modeId) {
  const mode = getGameMode(modeId);
  const { timing } = mode;
  return {
    roundCount: timing.roundCount,
    timerMs: timing.roundTime,
    graceMs: timing.gracePeriod,
    dangerZoneMs: GAME.DANGER_ZONE_MS, // not yet per-mode; single fallback
  };
}
