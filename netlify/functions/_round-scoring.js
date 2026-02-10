import { haversine, calculateScore } from '../../lib/game-math/index.js';
import {
  pointInPolygon,
  distanceToPolygonBorder,
  calculateCountryScore,
} from '../../lib/geo-utils/index.js';
import { getCountryFeature, getCivilizationFeature } from './_geo-data.js';
import { GAME, API } from '../../lib/config/index.js';
import { getTimeBonusConfig } from '../../lib/config/game-modes.js';
import { calculateTimeBonus } from '../../lib/scoring/index.js';
import { createLogger } from './_utils.js';

const logger = createLogger('submit');

/**
 * Apply time bonus using shared lib with server-side distanceThreshold guard.
 * @param {number} baseScore
 * @param {number} distance
 * @param {number} timeElapsed
 * @param {string} gameType
 * @returns {number} time bonus
 */
function applyTimeBonus(baseScore, distance, timeElapsed, gameType) {
  const modeConfig = getTimeBonusConfig(gameType);
  if (
    !timeElapsed ||
    modeConfig?.distanceThreshold === null ||
    modeConfig?.distanceThreshold === undefined ||
    distance >= modeConfig.distanceThreshold
  ) {
    return 0;
  }
  const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
  return calculateTimeBonus({
    baseScore,
    timeRemainingMs: totalTimeAllowed - timeElapsed,
    totalTimeMs: totalTimeAllowed,
    timeBonusConfig: modeConfig,
  });
}

/**
 * Score a single round server-side.
 * @param {any} round - Submitted round data
 * @param {number} i - Round index
 * @param {{ gameType: string, targets: any[] }} session
 * @returns {any} Validated round with server-computed score
 */
export function scoreRound(round, i, session) {
  const isCountryMode = session.gameType === 'country' || session.gameType === 'country_daily';
  const isCivilizationMode =
    session.gameType === 'civilization' || session.gameType === 'civilization_daily';
  const serverTarget = /** @type {any} */ (session.targets[i]);
  const modeKey = session.gameType ?? 'classic';

  // Country mode: server-side GeoJSON validation
  if (isCountryMode) {
    if (!round.click) {
      return {
        country: round.country,
        countryId: round.countryId,
        click: null,
        distance: null,
        score: 0,
        status: 'timeout',
      };
    }

    const targetCountryId = serverTarget?.countryId ?? '';
    const targetFeature = targetCountryId
      ? /** @type {any} */ (getCountryFeature(targetCountryId))
      : undefined;
    let serverScore;
    let distance;

    if (targetFeature) {
      const isInside = pointInPolygon(
        { coordinates: [round.click.lng, round.click.lat] },
        targetFeature.geometry
      );
      distance = isInside
        ? 0
        : distanceToPolygonBorder([round.click.lat, round.click.lng], targetFeature.geometry);
      serverScore = calculateCountryScore(distance);

      serverScore += applyTimeBonus(serverScore, distance, round.timeElapsed, modeKey);

      if (round.score && Math.abs(round.score - serverScore) > 100) {
        logger.warn(
          `[submit] Country score mismatch: client=${round.score}, server=${serverScore}`
        );
      }
    } else {
      logger.error('[submit] Missing country GeoJSON feature:', targetCountryId);
      distance = null;
      serverScore = 0;
    }

    const safeDistance =
      typeof distance === 'number' && Number.isFinite(distance) ? Math.round(distance) : null;
    return {
      country: round.country,
      countryId: round.countryId,
      correctCountryId: serverTarget.countryId,
      clickedCountryId: round.clickedCountryId,
      click: round.click,
      distance: safeDistance,
      score: serverScore,
      status: targetFeature ? 'completed' : 'invalid',
    };
  }

  // Civilization mode: server-side GeoJSON validation
  if (isCivilizationMode) {
    if (!round.click) {
      return {
        civilization: round.civilization,
        civilizationId: round.civilizationId,
        click: null,
        distance: null,
        score: 0,
        status: 'timeout',
      };
    }

    const targetCivilizationId = serverTarget?.id ?? '';
    const targetFeature = targetCivilizationId
      ? /** @type {any} */ (getCivilizationFeature(targetCivilizationId))
      : undefined;
    let serverScore;
    let distance;

    if (targetFeature) {
      const isInside = pointInPolygon(
        { coordinates: [round.click.lng, round.click.lat] },
        targetFeature.geometry
      );
      distance = isInside
        ? 0
        : distanceToPolygonBorder([round.click.lat, round.click.lng], targetFeature.geometry);
      serverScore = calculateCountryScore(distance);

      serverScore += applyTimeBonus(serverScore, distance, round.timeElapsed, modeKey);

      if (round.score && Math.abs(round.score - serverScore) > 100) {
        logger.warn(
          `[submit] Civilization score mismatch: client=${round.score}, server=${serverScore}`
        );
      }
    } else {
      logger.error('[submit] Missing civilization GeoJSON feature:', targetCivilizationId);
      distance = null;
      serverScore = 0;
    }

    const safeDistance =
      typeof distance === 'number' && Number.isFinite(distance) ? Math.round(distance) : null;
    return {
      civilization: round.civilization,
      civilizationId: round.civilizationId,
      correctCivilizationId: serverTarget.id,
      clickedCivilizationId: round.clickedCivilizationId,
      click: round.click,
      distance: safeDistance,
      score: serverScore,
      status: targetFeature ? 'completed' : 'invalid',
    };
  }

  // Stadium mode: server-side validation (has lat/lng like capitals)
  if (session.gameType === 'stadium' || session.gameType === 'stadium_daily') {
    const stadiumCoords = /** @type {[number, number]} */ ([
      serverTarget.lat ?? 0,
      serverTarget.lng ?? 0,
    ]);

    if (!round.click) {
      return {
        stadium: round.stadium,
        click: null,
        distance: null,
        score: 0,
        status: 'timeout',
      };
    }

    const clickCoords = /** @type {[number, number]} */ ([round.click.lat, round.click.lng]);
    const distance = haversine(clickCoords, stadiumCoords);

    if (distance > API.MAX_DISTANCE_KM) {
      return {
        stadium: round.stadium,
        click: round.click,
        distance: API.MAX_DISTANCE_KM,
        score: 0,
        status: 'invalid',
      };
    }

    const baseScore = Math.round(calculateScore(distance));
    const timeBonus = applyTimeBonus(baseScore, distance, round.timeElapsed, modeKey);
    const totalScore = baseScore + timeBonus;

    if (round.score && Math.abs(round.score - totalScore) > 1) {
      logger.warn(
        `[submit] Stadium score mismatch: client=${round.score}, server=${totalScore} (base=${baseScore}, bonus=${timeBonus})`
      );
    }

    return {
      stadium: round.stadium,
      click: round.click,
      distance: Math.round(distance),
      score: totalScore,
      status: 'completed',
    };
  }

  // Capital mode: validate server-side
  const capitalCoords = /** @type {[number, number]} */ ([serverTarget.lat, serverTarget.lng]);

  if (!round.click) {
    return {
      capital: round.capital,
      click: null,
      distance: null,
      score: 0,
      status: 'timeout',
    };
  }

  const clickCoords = /** @type {[number, number]} */ ([round.click.lat, round.click.lng]);
  const distance = haversine(clickCoords, capitalCoords);

  if (distance > API.MAX_DISTANCE_KM) {
    return {
      capital: round.capital,
      click: round.click,
      distance: API.MAX_DISTANCE_KM,
      score: 0,
      status: 'invalid',
    };
  }

  const baseScore = Math.round(calculateScore(distance));
  const timeBonus = applyTimeBonus(baseScore, distance, round.timeElapsed, modeKey);
  const totalScore = baseScore + timeBonus;

  if (round.score && Math.abs(round.score - totalScore) > 1) {
    logger.warn(
      `[submit] Score mismatch: client=${round.score}, server=${totalScore} (base=${baseScore}, bonus=${timeBonus})`
    );
  }

  return {
    capital: round.capital,
    click: round.click,
    distance: Math.round(distance),
    score: Math.round(totalScore),
    status: 'completed',
  };
}
