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
import { GAME, SCORING_THRESHOLDS, SCORING_FORMULA, SCORING } from '../config.js';
import { eventBus } from '../core/EventBus.js';
import { t } from '../i18n.js';

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
    const unsubRoundComplete = eventBus.subscribe('game:round:completed', (/** @type {{ round: import('../game/Game.js').Round }} */ { round }) => {
      if (round.score !== null) {
        const targetName = round.capital?.name || round.country?.name || 'Unknown';
        eventBus.emit('score:calculated', {
          round: round.roundNumber,
          distance: round.distance,
          score: round.score,
          capital: targetName,
        });
      }
    });

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
   * Calculate time bonus based on speed and accuracy
   *
   * @param {number} baseScore - Base score before bonus
   * @param {number} totalTimeMs - Total time allowed
   * @param {number} timeRemainingMs - Time remaining
   * @param {number} distanceKm - Distance in kilometers
   * @param {string} [gameMode='classic'] - Game mode ('classic' or 'daily')
   * @returns {number} Time bonus (0-maxBonus)
   */
  calculateTimeBonus(baseScore, totalTimeMs, timeRemainingMs, distanceKm, gameMode = 'classic') {
    // Get mode-specific config
    const config = SCORING.TIME_BONUS_BY_MODE[gameMode];

    // Check global and mode-specific flags
    if (!SCORING.ENABLE_TIME_BONUS || !config || !config.enabled) {
      return 0;
    }

    // Only reward time bonus for good accuracy
    if (distanceKm >= config.distanceThreshold) {
      return 0;
    }

    // Calculate bonus as percentage of base score
    const timeRatio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs));
    const bonusPercent = timeRatio * config.maxBonusPercent;
    const bonus = Math.round(baseScore * bonusPercent);

    return Math.min(bonus, config.maxBonus);
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
  calculateScoreWithTime(distanceKm, timeRemainingMs, totalTimeMs = null, gameMode = 'classic') {
    const baseScore = this.calculateScore(distanceKm);

    // Calculate time bonus
    const timeBonus = totalTimeMs !== null
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
  calculateClickScore(clickCoords, targetCoords, timeElapsedMs, gameMode = 'classic', totalTimeAllowed = null) {
    const total = totalTimeAllowed ?? (GAME.TIMER_MS + GAME.GRACE_PERIOD_MS);

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
   * @param {Array<{score: number}>} rounds - Array of rounds with scores
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
   * Uses Haversine for distances between coordinates
   *
   * @param {[number, number]} clickCoords - [lat, lng] of click
   * @param {Object} countryFeature - GeoJSON feature of the country
   * @param {boolean} isInsideCountry - Whether click is inside the country
   * @returns {number} Distance in kilometers (0 if inside)
   */
  calculateDistanceToCountry(clickCoords, countryFeature, isInsideCountry) {
    if (isInsideCountry) {
      return 0;
    }
    if (!countryFeature?.geometry) {
      return Infinity;
    }

    const [clickLat, clickLng] = clickCoords;
    const geometry = countryFeature.geometry;
    let minDistance = Infinity;

    const processRing = (ring) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lng1, lat1] = ring[i];
        const [lng2, lat2] = ring[i + 1];

        // Calculate distance to line segment
        const distance = this.#distanceToLineSegment(
          clickLat, clickLng,
          lat1, lng1,
          lat2, lng2
        );

        minDistance = Math.min(minDistance, distance);
      }
    };

    if (geometry.type === 'Polygon') {
      // Process only exterior ring (index 0) for border distance
      processRing(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      // Process exterior rings of all polygons
      geometry.coordinates.forEach(polygon => {
        processRing(polygon[0]);
      });
    }

    return minDistance;
  }

  /**
   * Calculate distance from point to line segment
   * @private
   * @returns {number} Distance in kilometers
   */
  #distanceToLineSegment(lat, lng, lat1, lng1, lat2, lng2) {
    // Convert to approximate Cartesian for segment projection
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Segment is a point
      return haversine([lat, lng], [lat1, lng1]);
    }

    // Calculate projection parameter
    const t = Math.max(0, Math.min(1,
      ((lng - lng1) * dx + (lat - lat1) * dy) / lengthSquared
    ));

    // Calculate closest point on segment
    const closestLat = lat1 + t * dy;
    const closestLng = lng1 + t * dx;

    // Return Haversine distance to closest point
    return haversine([lat, lng], [closestLat, closestLng]);
  }

  /**
   * Calculate score for Country mode based on distance to country
   *
   * Scoring curve:
   * - d = 0 km (inside country): 5000 points
   * - 0 < d ≤ 50 km: 4000 points
   * - 50 < d ≤ 200 km: 3000 points
   * - d > 200 km: exponential decay from 3000 to 0
   *
   * @param {number} distanceKm - Distance to target country in kilometers
   * @returns {number} Score (0-5000)
   */
  calculateCountryScore(distanceKm) {
    if (distanceKm === 0) {
      return 5000; // Perfect - inside correct country
    }

    if (distanceKm <= 50) {
      return 4000; // Just next to it (very close)
    }

    if (distanceKm <= 200) {
      return 3000; // Nearby
    }

    // Exponential decay for d > 200 km
    // score = 3000 * exp(-(d - 200) / 1500)
    const decayConstant = 1500;
    const score = 3000 * Math.exp(-(distanceKm - 200) / decayConstant);

    return Math.round(Math.max(0, Math.min(3000, score)));
  }

  /**
   * Calculate score for a country click
   *
   * @param {[number, number]} clickCoords - [lat, lng] of user click
   * @param {Object} targetCountryFeature - GeoJSON feature of target country
   * @param {boolean} isInsideTargetCountry - Whether click is inside target country
   * @param {number} timeElapsedMs - Time elapsed since round start
   * @param {string} [gameMode='country'] - Game mode
   * @param {number | null} [totalTimeAllowed] - Total time allowed
   * @returns {ScoreResult & { distanceToCountry: number }}
   */
  calculateCountryClickScore(
    clickCoords,
    targetCountryFeature,
    isInsideTargetCountry,
    timeElapsedMs,
    gameMode = 'country',
    totalTimeAllowed = null
  ) {
    const total = totalTimeAllowed ?? (GAME.TIMER_MS + GAME.GRACE_PERIOD_MS);

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
    this.#eventUnsubscribers.forEach(unsub => unsub());
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
