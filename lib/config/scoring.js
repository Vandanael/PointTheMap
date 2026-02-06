/**
 * Scoring formula configuration (Version 2)
 * Uses sigmoid-based formula for smooth, continuous scoring
 */
export const SCORING_FORMULA = {
  version: 2,
  perfectThreshold: 0.1, // km - distance below which score is perfect
  k: 800, // Scale parameter (distance at ~50% score → ~1000km)
  p: 1.2, // Power parameter (gentle decay for casual-friendly scoring)
  maxScore: 5000, // Maximum possible score per round
};

/**
 * Scoring thresholds - Single source of truth for all distance-based categories
 * Used by: ScoringSystem, UI components, visual constants
 */
export const SCORING_THRESHOLDS = {
  // Category boundaries (km)
  PERFECT_MAX: 0.1, // < 0.1km = Perfect (V2: reduced from 1km)
  EXCELLENT_MAX: 50, // 0.1-50km = Excellent
  GOOD_MAX: 200, // 50-200km = Good
  FAIR_MAX: 1000, // 200-1000km = Fair
  // > 1000km = Poor

  // Achievement thresholds (more generous for gameplay satisfaction)
  ACHIEVEMENT_PERFECT: 1, // < 1km = Achievement-worthy perfect round

  // Visual/UI thresholds (can differ from category boundaries)
  VISUAL_EXCELLENT: 100, // Green line color
  VISUAL_GOOD: 500, // Yellow line color
};

/** Shared config for all daily variants (competitive speedrun aspect) */
const DAILY_TIME_BONUS = {
  enabled: true,
  maxBonus: 1000,
  maxBonusPercent: 0.2,
  distanceThreshold: 200,
};

/** Shared config for all classic variants (no time pressure) */
const NO_TIME_BONUS = {
  enabled: false,
  maxBonus: 0,
  maxBonusPercent: 0,
  distanceThreshold: 200,
};

export const SCORING = {
  TIME_BONUS_BY_MODE: {
    classic: NO_TIME_BONUS,
    daily: DAILY_TIME_BONUS,
    country: NO_TIME_BONUS,
    stadium: NO_TIME_BONUS,
    civilization: NO_TIME_BONUS,
    country_daily: DAILY_TIME_BONUS,
    stadium_daily: DAILY_TIME_BONUS,
    civilization_daily: DAILY_TIME_BONUS,
  },
};
