/**
 * Stats Manager
 *
 * Manages personal statistics tracking (local-only, no backend sync)
 */

import { MODE_IDS } from "../config/game-modes.js";
import { storageManager } from "../storage/StorageManager.js";
import { logger } from "../utils/logger.js";
import { eventBus } from "../core/EventBus.js";

/**
 * Default stats object
 */
const DEFAULT_STATS = {
  bestClassic: Infinity,
  bestDaily: Infinity,
  bestScoreClassic: 0,
  bestScoreDaily: 0,
  bestScoreStadium: 0,
  bestScoreCivilization: 0,
  averageDistance: 0,
  perfectCount: 0,
  playCount: 0,
  streakDaily: 0,
  lastDailyDate: null,
  totalRoundsPlayed: 0,
  under20kmCount: 0,
  lastUpdated: Date.now(),
  lastAccess: Date.now()
};

/**
 * Get current stats from storage
 * @returns {typeof DEFAULT_STATS}
 */
export const getStats = () => {
  let stats = storageManager.get('stats');
  if (!stats) {
    logger.warn('Stats: No stats found, initializing with defaults');
    stats = { ...DEFAULT_STATS };
    // Persist default stats
    storageManager.set('stats', stats);
  }

  // Update lastAccess
  stats.lastAccess = Date.now();
  storageManager.set('stats', stats);

  return stats;
};

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 * @returns {string}
 */
const getToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString().split('T')[0];
};

/**
 * Get yesterday's date in YYYY-MM-DD format (UTC)
 * @returns {string}
 */
const getYesterday = () => {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday.toISOString().split('T')[0];
};

/**
 * Update stats after game completion
 * @param {Array<{distance: number, score: number}>} rounds - Array of round results
 * @param {"classic" | "daily"} gameType - Type of game played
 * @returns {typeof DEFAULT_STATS} Updated stats
 */
export const updateStats = (rounds, gameType) => {
  try {
    const stats = getStats();
    const today = getToday();

    // Calculate game metrics
    const avgDistance = rounds.reduce((sum, r) => sum + (r.distance || 0), 0) / rounds.length;
    const totalScore = rounds.reduce((sum, r) => sum + (r.score || 0), 0);
    const perfectRounds = rounds.filter(r => r.distance < 1).length;
    const under20kmRounds = rounds.filter(r => r.distance < 20).length;

    // Update play count
    stats.playCount += 1;

    // Update total rounds played
    stats.totalRoundsPlayed += rounds.length;

    // Update perfect count
    stats.perfectCount += perfectRounds;

    // Update under 20km count
    stats.under20kmCount += under20kmRounds;

    // Update running average distance
    // Using incremental average formula: new_avg = old_avg + (new_value - old_avg) / n
    if (stats.playCount === 1) {
      stats.averageDistance = avgDistance;
    } else {
      stats.averageDistance = stats.averageDistance + (avgDistance - stats.averageDistance) / stats.playCount;
    }

    // Update best scores by game type
    if (gameType === MODE_IDS.CLASSIC) {
      if (avgDistance < stats.bestClassic) {
        stats.bestClassic = avgDistance;
        logger.info(`Stats: New best classic distance: ${avgDistance.toFixed(2)} km`);
      }
      if (totalScore > stats.bestScoreClassic) {
        stats.bestScoreClassic = totalScore;
        logger.info(`Stats: New best classic score: ${totalScore}`);
      }
    } else if (gameType === MODE_IDS.DAILY) {
      if (avgDistance < stats.bestDaily) {
        stats.bestDaily = avgDistance;
        logger.info(`Stats: New best daily distance: ${avgDistance.toFixed(2)} km`);
      }
      if (totalScore > stats.bestScoreDaily) {
        stats.bestScoreDaily = totalScore;
        logger.info(`Stats: New best daily score: ${totalScore}`);
      }

      // Update daily streak (only for daily games)
      const lastDate = stats.lastDailyDate;
      const yesterday = getYesterday();

      if (lastDate === today) {
        // Already played today, no change to streak
        logger.debug('Stats: Already played today, streak unchanged');
      } else if (lastDate === yesterday) {
        // Consecutive day
        stats.streakDaily += 1;
        logger.info(`Stats: Daily streak continued: ${stats.streakDaily} days`);
      } else {
        // Streak broken or first time, reset to 1
        stats.streakDaily = 1;
        logger.info('Stats: Daily streak reset to 1');
      }

      stats.lastDailyDate = today;
    } else if (gameType === MODE_IDS.STADIUM) {
      if (totalScore > (stats.bestScoreStadium || 0)) {
        stats.bestScoreStadium = totalScore;
        logger.info(`Stats: New best stadium score: ${totalScore}`);
      }
    } else if (gameType === MODE_IDS.CIVILIZATION) {
      if (totalScore > (stats.bestScoreCivilization || 0)) {
        stats.bestScoreCivilization = totalScore;
        logger.info(`Stats: New best civilization score: ${totalScore}`);
      }
    }

    // Update timestamps
    stats.lastUpdated = Date.now();
    stats.lastAccess = Date.now();

    // Persist to storage
    storageManager.set('stats', stats);

    // Emit event
    eventBus.emit('stats:updated', { stats });

    logger.info(`Stats: Updated after ${gameType} game (${stats.playCount} total plays)`);

    return stats;
  } catch (error) {
    logger.error('Stats: Failed to update stats', error);
    return getStats(); // Return current stats on error
  }
};

/**
 * Reset all stats to defaults (for testing or user request)
 * @returns {boolean} Success
 */
export const resetStats = () => {
  try {
    storageManager.set('stats', { ...DEFAULT_STATS });
    logger.info('Stats: Reset to defaults');
    eventBus.emit('stats:reset', {});
    return true;
  } catch (error) {
    logger.error('Stats: Failed to reset', error);
    return false;
  }
};
