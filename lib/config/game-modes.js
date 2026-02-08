/**
 * Game Mode Configuration System
 * Centralized definitions for all game modes
 *
 * This file provides a single source of truth for game mode configurations,
 * making it easy to add new modes without modifying function code.
 */

import { GAME } from './runtime.js';

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
 * @property {number} [scoring.timeBonus.distanceThreshold] - Distance threshold for bonus
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

/**
 * Game-type configs keyed by API game type: 'classic' | 'daily' | 'country' | 'country_daily' | 'stadium' | 'stadium_daily' | 'civilization' | 'civilization_daily'.
 * Each category (capital, country, stadium, civilization) can be played as classic (random) or daily (seeded).
 * @type {Object.<string, GameModeConfig>}
 */
export const GAME_MODES = {
  classic: {
    id: 'classic',
    name: 'Classic Mode',
    description: 'Timeless geography challenge',

    // Capital selection strategy
    capitalSelection: {
      type: 'random',
      dataSource: 'capitals',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
    },

    // Scoring configuration
    scoring: {
      maxPerRound: 5000,
      timeBonus: {
        enabled: false,
        maxBonus: 0,
        maxBonusPercent: 0,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'all_time',
    },
  },

  daily: {
    id: 'daily',
    name: 'Daily Challenge',
    description: 'Same capitals for everyone today',

    // Capital selection strategy
    capitalSelection: {
      type: 'seeded',
      dataSource: 'capitals',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
      // Seed function: converts date to integer seed (YYYYMMDD format)
      seed: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;

        // Add salt to prevent prediction (prime number for better distribution)
        const salt = 73856093;
        return (parseInt(dateString, 10) * salt) % 999999;
      },
    },

    // Scoring configuration
    scoring: {
      maxPerRound: 5000,
      timeBonus: {
        enabled: true,
        maxBonus: 1000,
        maxBonusPercent: 0.2,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'daily',
    },
  },

  country: {
    id: 'country',
    name: 'Country Mode',
    description: 'Find countries on the map',

    // Country selection strategy
    countrySelection: {
      type: 'random',
      dataSource: 'countries',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
    },

    // Scoring configuration (country-specific)
    scoring: {
      maxPerRound: 5000,
      type: 'country', // Use country scoring algorithm
      timeBonus: {
        enabled: false,
        maxBonus: 0,
        maxBonusPercent: 0,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'all_time',
    },
  },

  country_daily: {
    id: 'country_daily',
    name: 'Country Daily Challenge',
    description: 'Same countries for everyone today',

    // Country selection strategy
    countrySelection: {
      type: 'seeded',
      dataSource: 'countries',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
      seed: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;
        const salt = 73856093;
        return (parseInt(dateString, 10) * salt) % 999999;
      },
    },

    // Scoring configuration
    scoring: {
      maxPerRound: 5000,
      type: 'country',
      timeBonus: {
        enabled: true,
        maxBonus: 1000,
        maxBonusPercent: 0.2,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'daily',
    },
  },

  stadium: {
    id: 'stadium',
    name: 'Stadium Mode',
    description: 'Find stadiums on the map',

    // Stadium selection strategy
    stadiumSelection: {
      type: 'random',
      dataSource: 'stadiums',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
    },

    // Scoring configuration (point-based, same as classic)
    scoring: {
      maxPerRound: 5000,
      timeBonus: {
        enabled: false,
        maxBonus: 0,
        maxBonusPercent: 0,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'all_time',
    },
  },

  stadium_daily: {
    id: 'stadium_daily',
    name: 'Stadium Daily Challenge',
    description: 'Same stadiums for everyone today',

    // Stadium selection strategy
    stadiumSelection: {
      type: 'seeded',
      dataSource: 'stadiums',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
      seed: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;
        const salt = 73856093;
        return (parseInt(dateString, 10) * salt) % 999999;
      },
    },

    // Scoring configuration
    scoring: {
      maxPerRound: 5000,
      timeBonus: {
        enabled: true,
        maxBonus: 1000,
        maxBonusPercent: 0.2,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'daily',
    },
  },

  civilization: {
    id: 'civilization',
    name: 'Civilization Mode',
    description: 'Find civilizations on the map',

    // Civilization selection strategy
    civilizationSelection: {
      type: 'random',
      dataSource: 'civilizations',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
    },

    // Scoring configuration (zone-based, same as country)
    scoring: {
      maxPerRound: 5000,
      type: 'country',
      timeBonus: {
        enabled: false,
        maxBonus: 0,
        maxBonusPercent: 0,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'all_time',
    },
  },

  civilization_daily: {
    id: 'civilization_daily',
    name: 'Civilization Daily Challenge',
    description: 'Same civilizations for everyone today',

    // Civilization selection strategy
    civilizationSelection: {
      type: 'seeded',
      dataSource: 'civilizations',
      count: 5,
      balancing: { popular: 2, obscure: 3 },
      seed: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}${month}${day}`;
        const salt = 73856093;
        return (parseInt(dateString, 10) * salt) % 999999;
      },
    },

    // Scoring configuration
    scoring: {
      maxPerRound: 5000,
      type: 'country',
      timeBonus: {
        enabled: true,
        maxBonus: 1000,
        maxBonusPercent: 0.2,
        distanceThreshold: 200,
      },
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5,
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'daily',
    },
  },
};

/**
 * Runtime helpers keyed by game type: targets(state), roundGameType, noTargetsErrorKey, sessionBestScoreKey, sessionTargetsKey.
 * noTargetsErrorKey is an i18n key (e.g. error.noTargetsCapitals); callers must pass through t() for display.
 * @type {Object.<string, { targets: (state: { gameType: string, targets?: unknown[], capitals: unknown[], countries: unknown[], stadiums: unknown[], civilizations: unknown[] }) => unknown[], sessionTargetsKey: string, roundGameType: string, noTargetsErrorKey: string, sessionBestScoreKey: string }>}
 */
const MODE_CONFIG = {
  [MODE_IDS.CLASSIC]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'capitals',
    roundGameType: 'capital',
    noTargetsErrorKey: 'error.noTargetsCapitals',
    sessionBestScoreKey: 'bestScoreClassic',
  },
  [MODE_IDS.DAILY]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'capitals',
    roundGameType: 'capital',
    noTargetsErrorKey: 'error.noTargetsCapitals',
    sessionBestScoreKey: 'bestScoreDaily',
  },
  [MODE_IDS.COUNTRY]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'countries',
    roundGameType: 'country',
    noTargetsErrorKey: 'error.noTargetsCountries',
    sessionBestScoreKey: 'bestScoreCountry',
  },
  [MODE_IDS.STADIUM]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'stadiums',
    roundGameType: 'stadium',
    noTargetsErrorKey: 'error.noTargetsStadiums',
    sessionBestScoreKey: 'bestScoreStadium',
  },
  [MODE_IDS.CIVILIZATION]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'civilizations',
    roundGameType: 'civilization',
    noTargetsErrorKey: 'error.noTargetsCivilizations',
    sessionBestScoreKey: 'bestScoreCivilization',
  },
  [MODE_IDS.COUNTRY_DAILY]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'countries',
    roundGameType: 'country',
    noTargetsErrorKey: 'error.noTargetsCountries',
    sessionBestScoreKey: 'bestScoreCountryDaily',
  },
  [MODE_IDS.STADIUM_DAILY]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'stadiums',
    roundGameType: 'stadium',
    noTargetsErrorKey: 'error.noTargetsStadiums',
    sessionBestScoreKey: 'bestScoreStadiumDaily',
  },
  [MODE_IDS.CIVILIZATION_DAILY]: {
    targets: (state) => state.targets ?? [],
    sessionTargetsKey: 'civilizations',
    roundGameType: 'civilization',
    noTargetsErrorKey: 'error.noTargetsCivilizations',
    sessionBestScoreKey: 'bestScoreCivilizationDaily',
  },
};

/**
 * Get targets array for current game type from state.
 * @param {{ gameType: string, capitals: unknown[], countries: unknown[], stadiums: unknown[], civilizations: unknown[], targets?: unknown[] }} state
 * @returns {unknown[]}
 */
export function getTargetsForMode(state) {
  const config = MODE_CONFIG[state.gameType];
  return config ? config.targets(state) : (state.targets ?? []);
}

/**
 * Get targets array from session by game type (for startGame).
 * @param {{ capitals?: unknown[], countries?: unknown[], stadiums?: unknown[], civilizations?: unknown[] }} session
 * @param {string} gameType
 * @returns {unknown[]}
 */
export function getTargetsFromSession(session, gameType) {
  const config = MODE_CONFIG[gameType];
  const key = config ? config.sessionTargetsKey : 'capitals';
  const sessionMap = /** @type {Record<string, unknown[] | undefined>} */ (session);
  return sessionMap[key] ?? [];
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
 * @returns {{ enabled: boolean, maxBonus: number, maxBonusPercent?: number, distanceThreshold?: number } | null}
 */
export function getTimeBonusConfig(modeId) {
  if (!isValidMode(modeId)) return null;
  return GAME_MODES[modeId]?.scoring?.timeBonus ?? null;
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
