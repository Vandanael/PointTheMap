/**
 * Share Feature
 *
 * Handle sharing game results via native share API or clipboard fallback
 */

import { logger } from '../utils/logger.js';
import { t } from '../i18n.js';

const PUBLIC_URL = import.meta.env?.VITE_PUBLIC_URL || 'https://pointthemap.net';

/**
 * Calculate daily challenge number from a date
 * @param {string | null} dailyDate - ISO date string (YYYY-MM-DD) or null for classic mode
 * @returns {number | null} Daily number or null for classic mode
 */
export const getDailyNumber = (dailyDate) => {
  if (!dailyDate) return null;

  try {
    // Reference date: 2025-01-01 is Daily #1
    const referenceDate = new Date('2025-01-01');
    const targetDate = new Date(dailyDate);

    // Calculate days difference
    const diffTime = targetDate.getTime() - referenceDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays + 1; // +1 because day 0 is Daily #1
  } catch (error) {
    logger.error('Share: Failed to calculate daily number', error);
    return null;
  }
};

/**
 * Format share text for game results
 * @param {number | null} dailyNumber - Daily challenge number (null for classic mode)
 * @param {number} avgDistance - Average distance in km
 * @param {Array<{distance: number}>} rounds - Array of round results
 * @returns {string} Formatted share text (language determined by current i18n setting)
 */
export const formatShareText = (dailyNumber, avgDistance, rounds) => {
  try {
    // Calculate badges
    const perfectRounds = rounds.filter((r) => r.distance < 1).length;
    const under20kmRounds = rounds.filter((r) => r.distance < 20).length;

    // Build share text
    const lines = [];

    // Title line (fully localized)
    if (dailyNumber !== null) {
      lines.push(t('shareResults.dailyTitle', { dailyNumber }));
    } else {
      lines.push(t('shareResults.title'));
    }

    // Score line (fully localized)
    const scoreLabel = t('shareResults.scoreLabel');
    const avgLabel = t('shareResults.avgLabel');
    lines.push(`${scoreLabel}: ${avgDistance.toFixed(2)} km ${avgLabel}`);

    // Badges line (only if any badges, fully localized)
    const badges = [];
    if (perfectRounds > 0) {
      const perfectLabel = t('category.perfect');
      badges.push(`${perfectLabel} x${perfectRounds}`);
    }
    if (under20kmRounds > 0) {
      const under20kmLabel = t('shareResults.under20km');
      badges.push(`${under20kmLabel} x${under20kmRounds}`);
    }
    if (badges.length > 0) {
      lines.push(badges.join(' — '));
    }

    // Rounds info (fully localized)
    const roundsLabel = t('shareResults.roundsLabel');
    lines.push(`(${rounds.length} ${roundsLabel})`);

    // URL
    lines.push(PUBLIC_URL);

    return lines.join('\n');
  } catch (error) {
    logger.error('Share: Failed to format share text', error);
    // Fallback
    return `Point The Map\n${PUBLIC_URL}`;
  }
};

/**
 * Share game results using native share API or clipboard fallback
 * @param {string} text - Text to share
 * @returns {Promise<boolean>} True if share succeeded, false otherwise
 */
export const shareGameResults = async (text) => {
  try {
    // Try native share first (mobile browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          text: text,
          url: PUBLIC_URL,
        });
        logger.info('Share: Success via native share');
        return true;
      } catch (error) {
        // User cancelled or share failed
        if (error.name === 'AbortError') {
          logger.debug('Share: User cancelled native share');
          return false; // User cancelled, don't show error
        }
        logger.warn('Share: Native share failed, trying clipboard', error);
        // Fall through to clipboard
      }
    }

    // Fallback: clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        logger.info('Share: Success via clipboard');
        return true;
      } catch (error) {
        logger.warn('Share: Clipboard API failed, trying fallback method', error);
        // Fall through to last resort
      }
    }

    logger.warn('Share: Clipboard API not available');
    return false;
  } catch (error) {
    logger.error('Share: Unexpected error', error);
    return false;
  }
};
