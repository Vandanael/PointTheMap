/**
 * Achievement Manager
 *
 * Manages achievement unlocking and tracking (local-only, no backend sync)
 */

import { storageManager } from "../storage/StorageManager.js";
import { logger } from "../utils/logger.js";
import { eventBus } from "../core/EventBus.js";

/**
 * Achievement definitions
 * Each achievement has:
 * - id: unique identifier
 * - icon: emoji icon
 * - labelKey: i18n key for title
 * - descKey: i18n key for description
 */
export const ACHIEVEMENTS = {
  perfectRound: {
    id: 'perfectRound',
    icon: '🎯',
    labelKey: 'achievement.perfectRound',
    descKey: 'achievement.perfectRoundDesc'
  },
  perfectGame: {
    id: 'perfectGame',
    icon: '🏆',
    labelKey: 'achievement.perfectGame',
    descKey: 'achievement.perfectGameDesc'
  },
  avgUnder10: {
    id: 'avgUnder10',
    icon: '⭐',
    labelKey: 'achievement.avgUnder10',
    descKey: 'achievement.avgUnder10Desc'
  },
  avgUnder50: {
    id: 'avgUnder50',
    icon: '✨',
    labelKey: 'achievement.avgUnder50',
    descKey: 'achievement.avgUnder50Desc'
  },
  top1pct: {
    id: 'top1pct',
    icon: '👑',
    labelKey: 'achievement.top1pct',
    descKey: 'achievement.top1pctDesc'
  },
  streak3: {
    id: 'streak3',
    icon: '🔥',
    labelKey: 'achievement.streak3',
    descKey: 'achievement.streak3Desc'
  },
  play10: {
    id: 'play10',
    icon: '🎮',
    labelKey: 'achievement.play10',
    descKey: 'achievement.play10Desc'
  },
  play50: {
    id: 'play50',
    icon: '🚀',
    labelKey: 'achievement.play50',
    descKey: 'achievement.play50Desc'
  }
};

/**
 * Default achievements object
 */
const DEFAULT_ACHIEVEMENTS = {
  perfectRound: false,
  perfectGame: false,
  avgUnder10: false,
  avgUnder50: false,
  top1pct: false,
  streak3: false,
  play10: false,
  play50: false,
  lastAccess: Date.now()
};

/**
 * Get current achievements from storage
 * @returns {typeof DEFAULT_ACHIEVEMENTS}
 */
export const getAchievements = () => {
  let achievements = storageManager.get('achievements');
  if (!achievements) {
    logger.warn('Achievements: No achievements found, initializing with defaults');
    achievements = { ...DEFAULT_ACHIEVEMENTS };
    // Persist default achievements
    storageManager.set('achievements', achievements);
  }

  // Update lastAccess
  achievements.lastAccess = Date.now();
  storageManager.set('achievements', achievements);

  return achievements;
};

/**
 * Check for new achievement unlocks after game completion
 * @param {Array<{distance: number}>} rounds - Array of round results
 * @param {{playCount: number, streakDaily: number, perfectCount: number}} stats - Current stats
 * @param {number | null} rank - Leaderboard rank (null if not ranked)
 * @returns {Array<{id: string, achievement: typeof ACHIEVEMENTS[keyof typeof ACHIEVEMENTS]}>} Array of newly unlocked achievements
 */
export const checkAchievements = (rounds, stats, rank) => {
  try {
    const achievements = getAchievements();
    const newUnlocks = [];

    // Calculate game metrics
    const avgDistance = rounds.reduce((sum, r) => sum + (r.distance || 0), 0) / rounds.length;
    const perfectRounds = rounds.filter(r => r.distance < 1).length;
    const allPerfect = perfectRounds === rounds.length && rounds.length > 0;

    // Check: perfectRound - Any round < 1km
    if (!achievements.perfectRound && perfectRounds > 0) {
      achievements.perfectRound = true;
      newUnlocks.push({ id: 'perfectRound', achievement: ACHIEVEMENTS.perfectRound });
      logger.info('Achievement unlocked: perfectRound');
    }

    // Check: perfectGame - All 5 rounds < 1km
    if (!achievements.perfectGame && allPerfect) {
      achievements.perfectGame = true;
      newUnlocks.push({ id: 'perfectGame', achievement: ACHIEVEMENTS.perfectGame });
      logger.info('Achievement unlocked: perfectGame');
    }

    // Check: avgUnder10 - Game average < 10km
    if (!achievements.avgUnder10 && avgDistance < 10) {
      achievements.avgUnder10 = true;
      newUnlocks.push({ id: 'avgUnder10', achievement: ACHIEVEMENTS.avgUnder10 });
      logger.info('Achievement unlocked: avgUnder10');
    }

    // Check: avgUnder50 - Game average < 50km
    if (!achievements.avgUnder50 && avgDistance < 50) {
      achievements.avgUnder50 = true;
      newUnlocks.push({ id: 'avgUnder50', achievement: ACHIEVEMENTS.avgUnder50 });
      logger.info('Achievement unlocked: avgUnder50');
    }

    // Check: top1pct - Rank 1-5 (top 1% of ~500)
    if (!achievements.top1pct && rank !== null && rank <= 5) {
      achievements.top1pct = true;
      newUnlocks.push({ id: 'top1pct', achievement: ACHIEVEMENTS.top1pct });
      logger.info('Achievement unlocked: top1pct');
    }

    // Check: streak3 - 3-day daily streak
    if (!achievements.streak3 && stats.streakDaily >= 3) {
      achievements.streak3 = true;
      newUnlocks.push({ id: 'streak3', achievement: ACHIEVEMENTS.streak3 });
      logger.info('Achievement unlocked: streak3');
    }

    // Check: play10 - 10 games played
    if (!achievements.play10 && stats.playCount >= 10) {
      achievements.play10 = true;
      newUnlocks.push({ id: 'play10', achievement: ACHIEVEMENTS.play10 });
      logger.info('Achievement unlocked: play10');
    }

    // Check: play50 - 50 games played
    if (!achievements.play50 && stats.playCount >= 50) {
      achievements.play50 = true;
      newUnlocks.push({ id: 'play50', achievement: ACHIEVEMENTS.play50 });
      logger.info('Achievement unlocked: play50');
    }

    // Persist if any unlocked
    if (newUnlocks.length > 0) {
      achievements.lastAccess = Date.now();
      storageManager.set('achievements', achievements);

      // Emit events for each unlock
      newUnlocks.forEach(({ id, achievement }) => {
        eventBus.emit('achievement:unlocked', { id, achievement });
      });

      logger.info(`Achievements: ${newUnlocks.length} new unlock(s)`);
    }

    return newUnlocks;
  } catch (error) {
    logger.error('Achievements: Failed to check achievements', error);
    return [];
  }
};

/**
 * Reset all achievements to defaults (for testing or user request)
 * @returns {boolean} Success
 */
export const resetAchievements = () => {
  try {
    storageManager.set('achievements', { ...DEFAULT_ACHIEVEMENTS });
    logger.info('Achievements: Reset to defaults');
    eventBus.emit('achievements:reset', {});
    return true;
  } catch (error) {
    logger.error('Achievements: Failed to reset', error);
    return false;
  }
};
