/**
 * ScoringSystem - Centralizes all scoring logic
 *
 * Responsibilities:
 * - Calculate score based on distance
 * - Calculate score based on distance + time
 * - Calculate total game score
 * - Emit scoring events via EventBus
 */

import { calculateScore as calculateScoreLib, haversine } from '@lib/game-math/index.js';
import {
  distanceToPolygonBorder,
  calculateCountryScore as calculateCountryScoreLib,
} from '@lib/geo-utils/index.js';
import { calculateTimeBonus as calculateTimeBonusLib } from '@lib/scoring/index.js';
import { GAME, SCORING_THRESHOLDS, SCORING_FORMULA } from '@lib/config';
import { FEATURES } from '../config/features.js';
import { MODE_IDS, getTimeBonusConfig } from '../config/game-modes.js';
import { eventBus } from '../core/EventBus.js';
import { getCivilizationName, t } from '../i18n.js';

/**
 * @typedef {Object} ScoreResult
 * @property {number | null} distance - Distance in kilometers (null if timeout)
 * @property {number} score - Calculated score (0-5000)
 * @property {number} timeBonus - Time bonus (0-1000)
 * @property {number} totalScore - Total score with time bonus
 */

export class ScoringSystem {
  #initialized = false;
  /** @type {Array<Function>} */
  #eventUnsubscribers = [];

  constructor() {}

  /**
   * Initialize the scoring system
   * Subscribes to relevant events
   */
  init() {
    if (this.#initialized) {
      return;
    }

    // Subscribe to round completed event to emit score calculated
    const unsubRoundComplete = eventBus.subscribe(
      'game:round:completed',
      (/** @type {{ round: import('../game/Game.js').Round }} */ { round }) => {
        if (round.score !== null) {
          const targetName = round.civilization
            ? getCivilizationName(round.civilization.id, round.civilization.name)
            : round.capital?.name || round.country?.name || round.stadium?.name || 'Unknown';
          eventBus.emit('score:calculated', {
            round: round.roundNumber,
            distance: round.distance,
            score: round.score,
            capital: targetName,
          });
        }
      }
    );

    this.#eventUnsubscribers.push(/** @type {() => void} */ (unsubRoundComplete));
    this.#initialized = true;
  }

  /**
   * Calculate score based on distance only
   * @param {number} distanceKm - Distance in kilometers
   * @returns {number} Score (0-5000)
   */
  calculateScore(distanceKm) {
    return Math.round(calculateScoreLib(distanceKm, SCORING_FORMULA));
  }

  /**
   * Calculate time bonus based on speed only
   *
   * @param {number} baseScore - Base score before bonus
   * @param {number} totalTimeMs - Total time allowed
   * @param {number} timeRemainingMs - Time remaining
   * @param {number} distanceKm - Distance in kilometers (unused for speed-only bonus)
   * @param {string} [gameMode='classic'] - Game mode ('classic' or 'daily')
   * @returns {number} Time bonus (0-maxBonus)
   */
  calculateTimeBonus(
    baseScore,
    totalTimeMs,
    timeRemainingMs,
    distanceKm,
    gameMode = MODE_IDS.CLASSIC
  ) {
    return calculateTimeBonusLib({
      baseScore,
      timeRemainingMs,
      totalTimeMs,
      timeBonusConfig: getTimeBonusConfig(gameMode),
      featureEnabled: FEATURES.TIME_BONUS,
    });
  }

  /**
   * Calculate score with distance and time remaining
   *
   * @param {number} distanceKm - Distance in kilometers
   * @param {number} timeRemainingMs - Time remaining in milliseconds
   * @param {number | null} [totalTimeMs] - Total time allowed (for time bonus calculation)
   * @param {string} [gameMode='classic'] - Game mode ('classic' or 'daily')
   * @returns {ScoreResult}
   */
  calculateScoreWithTime(
    distanceKm,
    timeRemainingMs,
    totalTimeMs = null,
    gameMode = MODE_IDS.CLASSIC
  ) {
    const baseScore = this.calculateScore(distanceKm);

    // Calculate time bonus
    const timeBonus =
      totalTimeMs !== null
        ? this.calculateTimeBonus(baseScore, totalTimeMs, timeRemainingMs, distanceKm, gameMode)
        : 0;

    return {
      distance: Math.round(distanceKm),
      score: baseScore,
      timeBonus,
      totalScore: baseScore + timeBonus,
    };
  }

  /**
   * Calculate distance between two coordinates
   * @param {[number, number]} coords1 - [lat, lng] of first point
   * @param {[number, number]} coords2 - [lat, lng] of second point
   * @returns {number} Distance in kilometers
   */
  calculateDistance(coords1, coords2) {
    return haversine(coords1, coords2);
  }

  /**
   * Calculate score for a click
   * This is the main scoring method used by the game
   *
   * @param {[number, number]} clickCoords - [lat, lng] of user click
   * @param {[number, number]} targetCoords - [lat, lng] of capital
   * @param {number} timeElapsedMs - Time elapsed since round start
   * @param {string} [gameMode='classic'] - Game mode ('classic' or 'daily')
   * @param {number | null} [totalTimeAllowed] - From state.runtimeConfig (timerMs + graceMs); null = fallback GAME for tests
   * @returns {ScoreResult}
   */
  calculateClickScore(
    clickCoords,
    targetCoords,
    timeElapsedMs,
    gameMode = MODE_IDS.CLASSIC,
    totalTimeAllowed = null
  ) {
    const total = totalTimeAllowed ?? GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;

    // Check if timed out
    if (timeElapsedMs > total) {
      /** @type {ScoreResult} */
      const timeoutResult = {
        distance: null,
        score: 0,
        timeBonus: 0,
        totalScore: 0,
      };
      return timeoutResult;
    }

    const distance = this.calculateDistance(clickCoords, targetCoords);
    const timeRemaining = total - timeElapsedMs;

    return this.calculateScoreWithTime(distance, timeRemaining, total, gameMode);
  }

  /**
   * Calculate total score from multiple rounds
   * @param {Array<{score: number | null | undefined}>} rounds - Array of rounds with scores
   * @returns {number} Total score
   */
  calculateTotalScore(rounds) {
    return rounds.reduce((total, round) => total + (round.score || 0), 0);
  }

  /**
   * Get score category based on distance
   * Uses shared SCORING_THRESHOLDS constants
   * @param {number} distanceKm - Distance in kilometers
   * @returns {'perfect' | 'excellent' | 'good' | 'fair' | 'poor'}
   */
  getScoreCategory(distanceKm) {
    const { PERFECT_MAX, EXCELLENT_MAX, GOOD_MAX, FAIR_MAX } = SCORING_THRESHOLDS;

    if (distanceKm < PERFECT_MAX) return 'perfect';
    if (distanceKm < EXCELLENT_MAX) return 'excellent';
    if (distanceKm < GOOD_MAX) return 'good';
    if (distanceKm < FAIR_MAX) return 'fair';
    return 'poor';
  }

  /**
   * Get human-readable label for score category
   * @param {'perfect' | 'excellent' | 'good' | 'fair' | 'poor'} category
   * @returns {string} Localized label
   */
  getCategoryLabel(category) {
    const translation = t(`category.${category}`);
    // If translation returns the key itself (not found), use unknown fallback
    if (translation === `category.${category}`) {
      return t('category.unknown');
    }
    return translation;
  }

  /**
   * Get score percentage (0-100)
   * @param {number} score - Score value
   * @returns {number} Percentage (0-100)
   */
  getScorePercentage(score) {
    const MAX_SCORE = 5000;
    return Math.round((score / MAX_SCORE) * 100);
  }

  /**
   * Calculate distance from point to country polygon (in kilometers)
   * Uses shared geo-utils library
   *
   * @param {[number, number]} clickCoords - [lat, lng] of click
   * @param {{ geometry?: any }} countryFeature - GeoJSON feature of the country
   * @param {boolean} isInsideCountry - Whether click is inside the country
   * @returns {number} Distance in kilometers (0 if inside)
   */
  calculateDistanceToCountry(clickCoords, countryFeature, isInsideCountry) {
    if (isInsideCountry) return 0;
    if (!countryFeature?.geometry) return Infinity;
    return distanceToPolygonBorder(clickCoords, countryFeature.geometry);
  }

  /**
   * Calculate score for Country mode based on distance to country
   * Delegates to shared geo-utils library
   *
   * @param {number} distanceKm - Distance to target country in kilometers
   * @returns {number} Score (0-5000)
   */
  calculateCountryScore(distanceKm) {
    return calculateCountryScoreLib(distanceKm);
  }

  /**
   * Calculate score for a country click
   *
   * @param {[number, number]} clickCoords - [lat, lng] of user click
   * @param {{ geometry?: any }} targetCountryFeature - GeoJSON feature of target country
   * @param {boolean} isInsideTargetCountry - Whether click is inside target country
   * @param {number} timeElapsedMs - Time elapsed since round start
   * @param {string} [gameMode='country'] - Game mode
   * @param {number | null} [totalTimeAllowed] - Total time allowed
   * @returns {ScoreResult & { distanceToCountry: number | null }}
   */
  calculateCountryClickScore(
    clickCoords,
    targetCountryFeature,
    isInsideTargetCountry,
    timeElapsedMs,
    gameMode = MODE_IDS.COUNTRY,
    totalTimeAllowed = null
  ) {
    const total = totalTimeAllowed ?? GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;

    // Check if timed out
    if (timeElapsedMs > total) {
      return {
        distance: null,
        distanceToCountry: null,
        score: 0,
        timeBonus: 0,
        totalScore: 0,
      };
    }

    const distanceToCountry = this.calculateDistanceToCountry(
      clickCoords,
      targetCountryFeature,
      isInsideTargetCountry
    );

    const baseScore = this.calculateCountryScore(distanceToCountry);
    const timeRemaining = total - timeElapsedMs;

    // Time bonus (if enabled for country mode)
    const timeBonus = this.calculateTimeBonus(
      baseScore,
      total,
      timeRemaining,
      distanceToCountry,
      gameMode
    );

    return {
      distance: Math.round(distanceToCountry),
      distanceToCountry: Math.round(distanceToCountry),
      score: baseScore,
      timeBonus,
      totalScore: baseScore + timeBonus,
    };
  }

  /**
   * Destroy the scoring system
   * Unsubscribes from all events
   */
  destroy() {
    this.#eventUnsubscribers.forEach((unsub) => unsub());
    this.#eventUnsubscribers = [];
    this.#initialized = false;
  }
}

// Singleton instance
/** @type {ScoringSystem | null} */
let _scoringSystemInstance = null;

/**
 * Get the singleton instance of ScoringSystem
 * @returns {ScoringSystem}
 */
export function getScoringSystem() {
  if (!_scoringSystemInstance) {
    _scoringSystemInstance = new ScoringSystem();
  }
  return _scoringSystemInstance;
}

// Export singleton instance (auto-initialized)
export const scoringSystem = getScoringSystem();
