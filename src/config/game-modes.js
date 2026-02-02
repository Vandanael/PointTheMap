/**
 * Game Mode Configuration System
 * Centralized definitions for all game modes
 *
 * This file provides a single source of truth for game mode configurations,
 * making it easy to add new modes without modifying function code.
 */

import { GAME } from '../config.js';

/**
 * Game mode configuration object
 * @typedef {Object} GameModeConfig
 * @property {string} id - Unique mode identifier
 * @property {string} name - Display name
 * @property {string} description - Mode description
 * @property {Object} capitalSelection - Capital selection configuration
 * @property {string} capitalSelection.type - Selection type: 'random' | 'seeded'
 * @property {string} capitalSelection.dataSource - Data source: 'capitals'
 * @property {number} capitalSelection.count - Number of capitals to select
 * @property {Object} capitalSelection.balancing - Balancing configuration
 * @property {number} capitalSelection.balancing.popular - Number of popular capitals
 * @property {number} capitalSelection.balancing.obscure - Number of obscure capitals
 * @property {Function} [capitalSelection.seed] - Seed function for seeded selection
 * @property {Object} scoring - Scoring configuration
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
export const MODES = {
  capital: {
    id: 'capital',
    name: 'Capital',
    variants: ['classic', 'daily']
  },
  country: {
    id: 'country',
    name: 'Country',
    variants: ['classic']
  }
};

/**
 * Game-type configs keyed by API game type: 'classic' | 'daily' | 'country'.
 * classic = capital + classic, daily = capital + daily, country = country + classic.
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
      balancing: { popular: 2, obscure: 3 }
    },

    // Scoring configuration
    scoring: {
      maxPerRound: 5000,
      timeBonus: {
        enabled: false,
        maxBonus: 0,
        maxBonusPercent: 0,
        distanceThreshold: 200
      }
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'all_time'
    }
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
      }
    },

    // Scoring configuration
    scoring: {
      maxPerRound: 5000,
      timeBonus: {
        enabled: true,
        maxBonus: 1000,
        maxBonusPercent: 0.20,
        distanceThreshold: 200
      }
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'daily'
    }
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
      balancing: { popular: 2, obscure: 3 }
    },

    // Scoring configuration (country-specific)
    scoring: {
      maxPerRound: 5000,
      type: 'country', // Use country scoring algorithm
      timeBonus: {
        enabled: false,
        maxBonus: 0,
        maxBonusPercent: 0,
        distanceThreshold: 200
      }
    },

    // Timing
    timing: {
      roundTime: 5000,
      gracePeriod: 500,
      roundCount: 5
    },

    // Leaderboard
    leaderboard: {
      deduplication: 'by_pseudo',
      timeframe: 'all_time'
    }
  }
};

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
