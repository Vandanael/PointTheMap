/**
 * Stats Manager
 *
 * Manages personal statistics tracking (local-only, no backend sync)
 */

import { MODE_IDS } from '@lib/config/game-modes.js';
import { storageManager } from '../storage/StorageManager.js';
import { logger } from '../utils/logger.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/eventTypes.js';

/**
 * Default stats object
 */
const DEFAULT_STATS = {
  bestClassic: Infinity,
  bestDaily: Infinity,
  bestScoreClassic: 0,
  bestScoreDaily: 0,
  bestScoreCountry: 0,
  bestScoreStadium: 0,
  bestScoreCivilization: 0,
  bestScoreCountryDaily: 0,
  bestScoreStadiumDaily: 0,
  bestScoreCivilizationDaily: 0,
  averageDistance: 0,
  perfectCount: 0,
  playCount: 0,
  streakDaily: 0,
  lastDailyDate: null,
  streakCountryDaily: 0,
  lastCountryDailyDate: null,
  streakStadiumDaily: 0,
  lastStadiumDailyDate: null,
  streakCivilizationDaily: 0,
  lastCivilizationDailyDate: null,
  totalRoundsPlayed: 0,
  under20kmCount: 0,
  lastUpdated: Date.now(),
  lastAccess: Date.now(),
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
    .toISOString()
    .split('T')[0];
};

/**
 * Get yesterday's date in YYYY-MM-DD format (UTC)
 * @returns {string}
 */
const getYesterday = () => {
  const now = new Date();
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1)
  );
  return yesterday.toISOString().split('T')[0];
};

/**
 * Update daily streak for a given streak/date key pair
 * @param {Record<string, any>} stats
 * @param {string} streakKey
 * @param {string} dateKey
 * @param {string} today
 * @param {string} yesterday
 */
const updateDailyStreak = (stats, streakKey, dateKey, today, yesterday) => {
  const lastDate = stats[dateKey];
  if (lastDate === today) {
    // Already played today, no change
  } else if (lastDate === yesterday) {
    stats[streakKey] += 1;
  } else {
    stats[streakKey] = 1;
  }
  stats[dateKey] = today;
};

/**
 * Update stats after game completion
 * @param {Array<{distance: number, score: number}>} rounds - Array of round results
 * @param {string} gameType - Type of game played
 * @returns {typeof DEFAULT_STATS} Updated stats
 */
export const updateStats = (rounds, gameType) => {
  try {
    const stats = getStats();
    const today = getToday();

    // Calculate game metrics
    const avgDistance = rounds.reduce((sum, r) => sum + (r.distance || 0), 0) / rounds.length;
    const totalScore = rounds.reduce((sum, r) => sum + (r.score || 0), 0);
    const perfectRounds = rounds.filter(
      (r) => r.distance !== null && r.distance !== undefined && r.distance < 1
    ).length;
    const under20kmRounds = rounds.filter(
      (r) => r.distance !== null && r.distance !== undefined && r.distance < 20
    ).length;

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
      stats.averageDistance =
        stats.averageDistance + (avgDistance - stats.averageDistance) / stats.playCount;
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

      // Update daily streak
      const yesterday = getYesterday();
      updateDailyStreak(stats, 'streakDaily', 'lastDailyDate', today, yesterday);
    } else if (gameType === MODE_IDS.COUNTRY) {
      if (totalScore > (stats.bestScoreCountry || 0)) {
        stats.bestScoreCountry = totalScore;
        logger.info(`Stats: New best country score: ${totalScore}`);
      }
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
    } else if (gameType === MODE_IDS.COUNTRY_DAILY) {
      if (totalScore > (stats.bestScoreCountryDaily || 0)) {
        stats.bestScoreCountryDaily = totalScore;
        logger.info(`Stats: New best country daily score: ${totalScore}`);
      }
      const yesterday = getYesterday();
      updateDailyStreak(stats, 'streakCountryDaily', 'lastCountryDailyDate', today, yesterday);
    } else if (gameType === MODE_IDS.STADIUM_DAILY) {
      if (totalScore > (stats.bestScoreStadiumDaily || 0)) {
        stats.bestScoreStadiumDaily = totalScore;
        logger.info(`Stats: New best stadium daily score: ${totalScore}`);
      }
      const yesterday = getYesterday();
      updateDailyStreak(stats, 'streakStadiumDaily', 'lastStadiumDailyDate', today, yesterday);
    } else if (gameType === MODE_IDS.CIVILIZATION_DAILY) {
      if (totalScore > (stats.bestScoreCivilizationDaily || 0)) {
        stats.bestScoreCivilizationDaily = totalScore;
        logger.info(`Stats: New best civilization daily score: ${totalScore}`);
      }
      const yesterday = getYesterday();
      updateDailyStreak(
        stats,
        'streakCivilizationDaily',
        'lastCivilizationDailyDate',
        today,
        yesterday
      );
    }

    // Update timestamps
    stats.lastUpdated = Date.now();
    stats.lastAccess = Date.now();

    // Persist to storage
    storageManager.set('stats', stats);

    // Emit event
    eventBus.emit(EVENTS.STATS_UPDATED, { stats });

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
    eventBus.emit(EVENTS.STATS_RESET, {});
    return true;
  } catch (error) {
    logger.error('Stats: Failed to reset', error);
    return false;
  }
};
