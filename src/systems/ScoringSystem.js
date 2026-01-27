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
import { GAME } from '../config.js';
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
   * Calculate score with distance and time remaining
   * This method is kept for future enhancements (time bonuses)
   * Currently, we don't use time in scoring per game rules
   *
   * @param {number} distanceKm - Distance in kilometers
   * @param {number} timeRemainingMs - Time remaining in milliseconds
   * @returns {ScoreResult}
   */
  calculateScoreWithTime(distanceKm, timeRemainingMs) {
    const baseScore = this.calculateScore(distanceKm);

    // Currently no time bonus per game rules
    // But this method allows future enhancements
    const timeBonus = 0;

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

    return this.calculateScoreWithTime(distance, timeRemaining);
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
   * @param {number} distanceKm - Distance in kilometers
   * @returns {'perfect' | 'excellent' | 'good' | 'fair' | 'poor'}
   */
  getScoreCategory(distanceKm) {
    if (distanceKm < 1) return 'perfect';
    if (distanceKm < 50) return 'excellent';
    if (distanceKm < 200) return 'good';
    if (distanceKm < 1000) return 'fair';
    return 'poor';
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
