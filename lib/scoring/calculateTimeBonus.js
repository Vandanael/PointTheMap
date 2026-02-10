/**
 * Shared time bonus calculation used by both client (ScoringSystem) and server (submit.js).
 * Single source of truth — eliminates drift between client and server scoring.
 *
 * @param {Object} params
 * @param {number} params.baseScore - Base score before bonus (0-5000)
 * @param {number} params.timeRemainingMs - Time remaining (totalTime - elapsed)
 * @param {number} params.totalTimeMs - Total time allowed (timerMs + graceMs)
 * @param {{ enabled: boolean, maxBonus: number, maxBonusPercent?: number | null }} params.timeBonusConfig - From getTimeBonusConfig(modeId)
 * @param {boolean} [params.featureEnabled=true] - Client passes FEATURES.TIME_BONUS; server defaults true
 * @returns {number} Time bonus (0-maxBonus)
 */
export function calculateTimeBonus({
  baseScore,
  timeRemainingMs,
  totalTimeMs,
  timeBonusConfig,
  featureEnabled = true,
}) {
  if (!featureEnabled || !timeBonusConfig || !timeBonusConfig.enabled) {
    return 0;
  }

  // Only reward time bonus when answered in the first half of the timer
  if (timeRemainingMs < totalTimeMs / 2) {
    return 0;
  }

  const { maxBonusPercent, maxBonus } = timeBonusConfig;
  if (
    maxBonusPercent === null ||
    maxBonusPercent === undefined ||
    maxBonus === null ||
    maxBonus === undefined
  ) {
    return 0;
  }

  const timeRatio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs));
  const bonusPercent = timeRatio * maxBonusPercent;
  const bonus = Math.round(baseScore * bonusPercent);

  return Math.min(bonus, maxBonus);
}
