import { GAME, API } from '../../lib/config/index.js';

/**
 * @param {number} gameDuration
 * @returns {{valid: boolean, reason?: string}}
 */
export const checkPlausibility = (gameDuration) => {
  if (gameDuration < API.MIN_PLAUSIBLE_DURATION_MS || gameDuration > API.MAX_GAME_DURATION_MS) {
    return { valid: false, reason: 'Session duration implausible' };
  }
  return { valid: true };
};

/**
 * Validate submitted rounds against session targets.
 * @param {any[]} rounds - Submitted rounds
 * @param {any[]} sessionTargets - Session targets (capitals, countries, stadiums, or civilizations)
 * @param {string} gameType - Game mode identifier
 * @returns {{valid: boolean, error?: string}}
 */
export const validateRounds = (rounds, sessionTargets, gameType) => {
  if (!Array.isArray(rounds) || rounds.length !== GAME.ROUNDS) {
    return { valid: false, error: 'Invalid rounds count' };
  }

  const isCountryMode = gameType === 'country' || gameType === 'country_daily';
  const isCivilizationMode = gameType === 'civilization' || gameType === 'civilization_daily';
  const isStadiumMode = gameType === 'stadium' || gameType === 'stadium_daily';

  for (let i = 0; i < GAME.ROUNDS; i++) {
    const round = rounds[i];
    const expected = sessionTargets[i];

    const targetField = isCountryMode
      ? round.country
      : isCivilizationMode
        ? round.civilization
        : isStadiumMode
          ? round.stadium
          : round.capital;

    if (!round || !targetField) {
      return { valid: false, error: `Missing round ${i + 1}` };
    }

    const expectedName =
      typeof expected === 'object' && expected !== null && 'name' in expected
        ? expected.name
        : expected;
    if (targetField !== expectedName) {
      return {
        valid: false,
        error: `${isCountryMode ? 'Country' : isCivilizationMode ? 'Civilization' : isStadiumMode ? 'Stadium' : 'Capital'} mismatch at round ${i + 1}`,
      };
    }

    // Per-round time validation - detect suspiciously fast submissions
    if (round.timeElapsed !== undefined && round.timeElapsed !== null) {
      if (typeof round.timeElapsed !== 'number' || !Number.isFinite(round.timeElapsed)) {
        return { valid: false, error: `Invalid time at round ${i + 1}` };
      }
      if (round.timeElapsed < API.MIN_ROUND_TIME_MS) {
        return {
          valid: false,
          error: `Round ${i + 1} completed too fast (${round.timeElapsed}ms)`,
        };
      }
      if (round.timeElapsed > GAME.TIMER_MS + GAME.GRACE_PERIOD_MS + 1000) {
        return {
          valid: false,
          error: `Round ${i + 1} time exceeds maximum (${round.timeElapsed}ms)`,
        };
      }
    }

    if (round.click) {
      const { lat, lng } = round.click;

      // Type and finiteness validation
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { valid: false, error: `Invalid click coordinates at round ${i + 1}` };
      }

      // Check for NaN, Infinity, -Infinity
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { valid: false, error: `Invalid coordinate values at round ${i + 1}` };
      }

      // Geographic bounds validation
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: `Click out of bounds at round ${i + 1}` };
      }
    }
  }

  return { valid: true };
};
