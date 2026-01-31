/**
 * ValidationSystem - Centralizes all validation logic
 *
 * Responsibilities:
 * - Validate pseudos (format, length)
 * - Validate coordinates (lat/lng ranges)
 * - Validate game session data
 * - Validate rounds structure
 * - Reusable across client and server
 */

import { GAME } from '../config.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string} [error] - Error message if invalid
 * @property {Object} [details] - Additional details about the validation
 */

export class ValidationSystem {
  // Pseudo validation rules
  static PSEUDO_MIN_LENGTH = 3;
  static PSEUDO_MAX_LENGTH = 5;
  static PSEUDO_PATTERN = /^[A-Z]{3,5}$/;

  // Coordinate ranges
  static LAT_MIN = -90;
  static LAT_MAX = 90;
  static LNG_MIN = -180;
  static LNG_MAX = 180;

  // Session validation
  static MIN_GAME_DURATION_MS = 5000;
  static MAX_GAME_DURATION_MS = 10 * 60 * 1000; // 10 minutes
  static MIN_PLAUSIBLE_DURATION_MS = 15000; // 15 seconds minimum for 5 rounds

  constructor() {}

  /**
   * Validate pseudo format
   * @param {string} pseudo - Pseudo to validate
   * @returns {ValidationResult}
   */
  validatePseudo(pseudo) {
    if (!pseudo || typeof pseudo !== 'string') {
      return {
        valid: false,
        error: 'Pseudo is required and must be a string',
      };
    }

    const trimmed = pseudo.trim();

    if (trimmed.length < ValidationSystem.PSEUDO_MIN_LENGTH) {
      return {
        valid: false,
        error: `Pseudo must be at least ${ValidationSystem.PSEUDO_MIN_LENGTH} characters`,
      };
    }

    if (trimmed.length > ValidationSystem.PSEUDO_MAX_LENGTH) {
      return {
        valid: false,
        error: `Pseudo must be at most ${ValidationSystem.PSEUDO_MAX_LENGTH} characters`,
      };
    }

    if (!ValidationSystem.PSEUDO_PATTERN.test(trimmed)) {
      return {
        valid: false,
        error: 'Pseudo must contain only uppercase letters (A-Z)',
      };
    }

    return { valid: true };
  }

  /**
   * Validate latitude value
   * @param {number} lat - Latitude to validate
   * @returns {ValidationResult}
   */
  validateLatitude(lat) {
    if (typeof lat !== 'number') {
      return {
        valid: false,
        error: 'Latitude must be a number',
      };
    }

    if (!Number.isFinite(lat)) {
      return {
        valid: false,
        error: 'Latitude must be a finite number',
      };
    }

    if (lat < ValidationSystem.LAT_MIN || lat > ValidationSystem.LAT_MAX) {
      return {
        valid: false,
        error: `Latitude must be between ${ValidationSystem.LAT_MIN} and ${ValidationSystem.LAT_MAX}`,
        details: { value: lat, min: ValidationSystem.LAT_MIN, max: ValidationSystem.LAT_MAX },
      };
    }

    return { valid: true };
  }

  /**
   * Validate longitude value
   * @param {number} lng - Longitude to validate
   * @returns {ValidationResult}
   */
  validateLongitude(lng) {
    if (typeof lng !== 'number') {
      return {
        valid: false,
        error: 'Longitude must be a number',
      };
    }

    if (!Number.isFinite(lng)) {
      return {
        valid: false,
        error: 'Longitude must be a finite number',
      };
    }

    if (lng < ValidationSystem.LNG_MIN || lng > ValidationSystem.LNG_MAX) {
      return {
        valid: false,
        error: `Longitude must be between ${ValidationSystem.LNG_MIN} and ${ValidationSystem.LNG_MAX}`,
        details: { value: lng, min: ValidationSystem.LNG_MIN, max: ValidationSystem.LNG_MAX },
      };
    }

    return { valid: true };
  }

  /**
   * Validate coordinates (lat, lng)
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {ValidationResult}
   */
  validateCoordinates(lat, lng) {
    const latResult = this.validateLatitude(lat);
    if (!latResult.valid) {
      return latResult;
    }

    const lngResult = this.validateLongitude(lng);
    if (!lngResult.valid) {
      return lngResult;
    }

    return { valid: true };
  }

  /**
   * Validate click object
   * @param {{lat: number, lng: number} | null} click - Click coordinates
   * @returns {ValidationResult}
   */
  validateClick(click) {
    if (click === null) {
      // Null clicks are valid (timeout)
      return { valid: true };
    }

    if (typeof click !== 'object') {
      return {
        valid: false,
        error: 'Click must be an object or null',
      };
    }

    if (!('lat' in click) || !('lng' in click)) {
      return {
        valid: false,
        error: 'Click must have lat and lng properties',
      };
    }

    return this.validateCoordinates(click.lat, click.lng);
  }

  /**
   * Validate session token
   * @param {string} token - Session token
   * @returns {ValidationResult}
   */
  validateToken(token) {
    if (!token || typeof token !== 'string') {
      return {
        valid: false,
        error: 'Token is required and must be a string',
      };
    }

    if (token.trim().length === 0) {
      return {
        valid: false,
        error: 'Token cannot be empty',
      };
    }

    return { valid: true };
  }

  /**
   * Validate game duration plausibility
   * @param {number} durationMs - Game duration in milliseconds
   * @returns {ValidationResult}
   */
  validateGameDuration(durationMs) {
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
      return {
        valid: false,
        error: 'Duration must be a finite number',
      };
    }

    if (durationMs < ValidationSystem.MIN_PLAUSIBLE_DURATION_MS) {
      return {
        valid: false,
        error: 'Game duration too short (suspicious)',
        details: {
          duration: durationMs,
          minimum: ValidationSystem.MIN_PLAUSIBLE_DURATION_MS,
        },
      };
    }

    if (durationMs > ValidationSystem.MAX_GAME_DURATION_MS) {
      return {
        valid: false,
        error: 'Game duration too long (session expired)',
        details: {
          duration: durationMs,
          maximum: ValidationSystem.MAX_GAME_DURATION_MS,
        },
      };
    }

    return { valid: true };
  }

  /**
   * Validate round structure
   * @param {Object} round - Round object to validate
   * @param {number} roundIndex - Expected round index
   * @returns {ValidationResult}
   */
  validateRound(round, roundIndex) {
    if (!round || typeof round !== 'object') {
      return {
        valid: false,
        error: `Round ${roundIndex + 1} is missing or invalid`,
      };
    }

    // Validate capital
    if (!round.capital || typeof round.capital !== 'string') {
      return {
        valid: false,
        error: `Round ${roundIndex + 1} missing capital name`,
      };
    }

    // Validate status
    const validStatuses = ['playing', 'completed', 'timeout'];
    if (!validStatuses.includes(round.status)) {
      return {
        valid: false,
        error: `Round ${roundIndex + 1} has invalid status`,
      };
    }

    // Validate click if present
    if (round.click !== null && round.click !== undefined) {
      const clickResult = this.validateClick(round.click);
      if (!clickResult.valid) {
        return {
          valid: false,
          error: `Round ${roundIndex + 1}: ${clickResult.error}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate all rounds for a session
   * @param {Array<Object>} rounds - Array of rounds
   * @param {Array<{name: string}>} [expectedCapitals] - Expected capitals for this session
   * @param {number} [expectedCount] - From state.runtimeConfig.roundCount; fallback GAME.ROUNDS for tests
   * @returns {ValidationResult}
   */
  validateRounds(rounds, expectedCapitals, expectedCount = undefined) {
    if (!Array.isArray(rounds)) {
      return {
        valid: false,
        error: 'Rounds must be an array',
      };
    }

    const count = expectedCount ?? GAME.ROUNDS;
    if (rounds.length !== count) {
      return {
        valid: false,
        error: `Expected ${count} rounds, got ${rounds.length}`,
      };
    }

    // Validate each round
    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];
      const roundResult = this.validateRound(round, i);

      if (!roundResult.valid) {
        return roundResult;
      }

      // Validate capital matches expected
      if (expectedCapitals && expectedCapitals[i]) {
        const expectedName = expectedCapitals[i].name;
        if (round.capital !== expectedName) {
          return {
            valid: false,
            error: `Round ${i + 1}: Expected capital "${expectedName}", got "${round.capital}"`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Validate complete game session
   * @param {Object} session - Session object
   * @param {string} session.token - Session token
   * @param {Array<Object>} session.rounds - Rounds array
   * @param {string} session.pseudo - Player pseudo
   * @param {number} [session.startTime] - Session start time
   * @param {number} [session.endTime] - Session end time
   * @param {number} [expectedRoundCount] - From state.runtimeConfig.roundCount when validating client-side
   * @returns {ValidationResult}
   */
  validateSession(session, expectedRoundCount = undefined) {
    if (!session || typeof session !== 'object') {
      return {
        valid: false,
        error: 'Session must be an object',
      };
    }

    // Validate token
    const tokenResult = this.validateToken(session.token);
    if (!tokenResult.valid) {
      return tokenResult;
    }

    // Validate pseudo
    const pseudoResult = this.validatePseudo(session.pseudo);
    if (!pseudoResult.valid) {
      return pseudoResult;
    }

    // Validate rounds (expectedRoundCount from runtime config when available)
    const roundsResult = this.validateRounds(session.rounds, undefined, expectedRoundCount);
    if (!roundsResult.valid) {
      return roundsResult;
    }

    // Validate duration if timestamps provided
    if (session.startTime && session.endTime) {
      const duration = session.endTime - session.startTime;
      const durationResult = this.validateGameDuration(duration);
      if (!durationResult.valid) {
        return durationResult;
      }
    }

    return { valid: true };
  }

  /**
   * Quick pseudo validation (for UI feedback)
   * @param {string} pseudo - Pseudo to check
   * @returns {boolean}
   */
  isValidPseudoFormat(pseudo) {
    return this.validatePseudo(pseudo).valid;
  }

  /**
   * Quick coordinates validation (for UI feedback)
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {boolean}
   */
  areValidCoordinates(lat, lng) {
    return this.validateCoordinates(lat, lng).valid;
  }
}

// Singleton instance
let _validationSystemInstance = null;

/**
 * Get the singleton instance of ValidationSystem
 * @returns {ValidationSystem}
 */
export function getValidationSystem() {
  if (!_validationSystemInstance) {
    _validationSystemInstance = new ValidationSystem();
  }
  return _validationSystemInstance;
}

// Export singleton instance
export const validationSystem = getValidationSystem();
