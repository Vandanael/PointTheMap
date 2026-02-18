import { GAME, API } from '../../lib/config/index.js';
import {
  isCountryCategory,
  isStadiumCategory,
  isCivilizationCategory,
} from '../../lib/config/game-modes.js';
import { createLogger } from './_utils.js';

const logger = createLogger('validation');

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
    logger.error('Invalid rounds array:', {
      isArray: Array.isArray(rounds),
      length: rounds?.length,
      expected: GAME.ROUNDS,
      gameType,
    });
    return { valid: false, error: 'Invalid rounds count' };
  }

  const isCountryMode = isCountryCategory(gameType);
  const isCivilizationMode = isCivilizationCategory(gameType);
  const isStadiumMode = isStadiumCategory(gameType);

  logger.debug('Starting validation:', {
    gameType,
    isCountryMode,
    isCivilizationMode,
    isStadiumMode,
    roundsCount: rounds.length,
    firstRound: rounds[0]
      ? {
          keys: Object.keys(rounds[0]),
          capital: rounds[0].capital,
          country: rounds[0].country,
          civilization: rounds[0].civilization,
          stadium: rounds[0].stadium,
        }
      : null,
  });

  for (let i = 0; i < GAME.ROUNDS; i++) {
    const round = rounds[i];
    const expected = sessionTargets[i];

    const targetField = isCountryMode
      ? round?.country
      : isCivilizationMode
        ? round?.civilization
        : isStadiumMode
          ? round?.stadium
          : round?.capital;

    if (!round || !targetField) {
      // Enhanced logging for debugging
      logger.error('Missing round or targetField:', {
        roundIndex: i,
        gameType,
        isCountryMode,
        isCivilizationMode,
        isStadiumMode,
        hasRound: !!round,
        roundKeys: round ? Object.keys(round) : [],
        'round.capital': round?.capital,
        'round.country': round?.country,
        'round.stadium': round?.stadium,
        'round.civilization': round?.civilization,
        targetField,
        targetFieldType: typeof targetField,
        targetFieldValue: JSON.stringify(targetField),
        isFalsy: !targetField,
        isEmptyString: targetField === '',
        isNull: targetField === null,
        isUndefined: targetField === undefined,
      });
      return { valid: false, error: `Missing round ${i + 1}` };
    }

    const expectedName =
      typeof expected === 'object' && expected !== null && 'name' in expected
        ? expected.name
        : expected;

    if (isCountryMode) {
      const expectedCountryId =
        typeof expected === 'object' && expected !== null && 'countryId' in expected
          ? expected.countryId
          : undefined;
      if (
        typeof expectedCountryId !== 'string' ||
        typeof round?.countryId !== 'string' ||
        round.countryId !== expectedCountryId
      ) {
        return { valid: false, error: `Country ID mismatch at round ${i + 1}` };
      }

      // Keep name as secondary diagnostic only (ID is source of truth)
      if (typeof expectedName === 'string' && targetField !== expectedName) {
        logger.warn('Country name differs but ID matches', {
          roundIndex: i,
          expectedName,
          providedName: targetField,
          expectedCountryId,
        });
      }
    } else if (isCivilizationMode) {
      const expectedCivilizationId =
        typeof expected === 'object' && expected !== null && 'id' in expected
          ? expected.id
          : undefined;
      if (
        typeof expectedCivilizationId !== 'string' ||
        typeof round?.civilizationId !== 'string' ||
        round.civilizationId !== expectedCivilizationId
      ) {
        return { valid: false, error: `Civilization ID mismatch at round ${i + 1}` };
      }

      // Keep name as secondary diagnostic only (ID is source of truth)
      if (typeof expectedName === 'string' && targetField !== expectedName) {
        logger.warn('Civilization name differs but ID matches', {
          roundIndex: i,
          expectedName,
          providedName: targetField,
          expectedCivilizationId,
        });
      }
    } else if (targetField !== expectedName) {
      return {
        valid: false,
        error: `${isStadiumMode ? 'Stadium' : 'Capital'} mismatch at round ${i + 1}`,
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
