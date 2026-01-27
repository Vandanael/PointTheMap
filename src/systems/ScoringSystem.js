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
import { GAME, SCORING_THRESHOLDS } from '../config.js';
import { eventBus } from '../core/EventBus.js';

/**
 * @typedef {Object} ScoreResult
 * @property {number} distance - Distance in kilometers
 * @property {number} score - Calculated score (0-5000)
 * @property {number} timeBonus - Time bonus (0-1000)
 * @property {number} totalScore - Total score with time bonus
 */

export class ScoringSystem {
  #initialized = false;
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
    const unsubRoundComplete = eventBus.subscribe('game:round:completed', ({ round }) => {
      if (round.score !== null) {
        eventBus.emit('score:calculated', {
          round: round.roundNumber,
          distance: round.distance,
          score: round.score,
          capital: round.capital.name,
        });
      }
    });

    this.#eventUnsubscribers.push(unsubRoundComplete);
    this.#initialized = true;
  }

  /**
   * Calculate score based on distance only
   * @param {number} distanceKm - Distance in kilometers
   * @returns {number} Score (0-5000)
   */
  calculateScore(distanceKm) {
    return Math.round(calculateScoreLib(distanceKm));
  }

  /**
   * Calculate time bonus (stub for future feature)
   * Feature flag: ENABLE_TIME_BONUS (currently false)
   * 
   * @param {number} totalTimeMs - Total time allowed
   * @param {number} timeRemainingMs - Time remaining
   * @param {number} distanceKm - Distance in kilometers
   * @returns {number} Time bonus (0-1000)
   */
  calculateTimeBonus(totalTimeMs, timeRemainingMs, distanceKm) {
    // Feature flag - not enabled yet
    const ENABLE_TIME_BONUS = false;
    if (!ENABLE_TIME_BONUS) {
      return 0;
    }

    const MAX_TIME_BONUS = 1000;
    const DISTANCE_THRESHOLD_FOR_BONUS = 200; // Only reward time bonus for good accuracy

    // No bonus if distance is too large
    if (distanceKm >= DISTANCE_THRESHOLD_FOR_BONUS) {
      return 0;
    }

    // Linear bonus based on time remaining
    const timeRatio = Math.max(0, timeRemainingMs / totalTimeMs);
    return Math.round(MAX_TIME_BONUS * timeRatio);
  }

  /**
   * Calculate score with distance and time remaining
   * This method is kept for future enhancements (time bonuses)
   * Currently, we don't use time in scoring per game rules
   *
   * @param {number} distanceKm - Distance in kilometers
   * @param {number} timeRemainingMs - Time remaining in milliseconds
   * @param {number} [totalTimeMs] - Total time allowed (for time bonus calculation)
   * @returns {ScoreResult}
   */
  calculateScoreWithTime(distanceKm, timeRemainingMs, totalTimeMs = null) {
    const baseScore = this.calculateScore(distanceKm);

    // Calculate time bonus (currently disabled via feature flag)
    const timeBonus = totalTimeMs !== null
      ? this.calculateTimeBonus(totalTimeMs, timeRemainingMs, distanceKm)
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
   * @returns {ScoreResult}
   */
  calculateClickScore(clickCoords, targetCoords, timeElapsedMs) {
    const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;

    // Check if timed out
    if (timeElapsedMs > totalTimeAllowed) {
      return {
        distance: null,
        score: 0,
        timeBonus: 0,
        totalScore: 0,
      };
    }

    const distance = this.calculateDistance(clickCoords, targetCoords);
    const timeRemaining = totalTimeAllowed - timeElapsedMs;

    return this.calculateScoreWithTime(distance, timeRemaining, totalTimeAllowed);
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
    const labels = {
      perfect: 'Perfect',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Keep trying',
    };
    return labels[category] || 'Unknown';
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
