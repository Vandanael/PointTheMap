// Point The Map - Configuration
// Constantes non-sensibles (scoring côté serveur uniquement)

export const GAME = {
  ROUNDS: 5,
  TIMER_MS: 5000,
  GRACE_PERIOD_MS: 500,
  DANGER_ZONE_MS: 1500,
  MAX_SCORE_PER_ROUND: 5000,
};

/**
 * Scoring formula configuration (Version 2)
 * Uses sigmoid-based formula for smooth, continuous scoring
 */
export const SCORING_FORMULA = {
  version: 2,
  perfectThreshold: 0.1,  // km - distance below which score is perfect
  k: 800,                 // Scale parameter (distance at ~50% score → ~1000km)
  p: 1.2,                 // Power parameter (gentle decay for casual-friendly scoring)
  maxScore: 5000,         // Maximum possible score per round
};

/**
 * Scoring thresholds - Single source of truth for all distance-based categories
 * Used by: ScoringSystem, UI components, visual constants
 */
export const SCORING_THRESHOLDS = {
  // Category boundaries (km)
  PERFECT_MAX: 0.1,      // < 0.1km = Perfect (V2: reduced from 1km)
  EXCELLENT_MAX: 50,     // 0.1-50km = Excellent
  GOOD_MAX: 200,         // 50-200km = Good
  FAIR_MAX: 1000,        // 200-1000km = Fair
  // > 1000km = Poor

  // Visual/UI thresholds (can differ from category boundaries)
  VISUAL_EXCELLENT: 100,  // Green line color
  VISUAL_GOOD: 500,       // Yellow line color
};

/**
 * Time bonus configuration by game mode
 * Controls speed-based scoring bonuses
 */
export const SCORING = {
  ENABLE_TIME_BONUS: true,  // Global feature flag
  TIME_BONUS_BY_MODE: {
    classic: {
      enabled: false,           // Classic mode: pure geography skill, no time pressure
      maxBonus: 0,
      maxBonusPercent: 0,
      distanceThreshold: 200,
    },
    daily: {
      enabled: true,            // Daily mode: competitive speedrun aspect
      maxBonus: 1000,           // Maximum bonus points (20% of 5000)
      maxBonusPercent: 0.20,    // 20% max bonus
      distanceThreshold: 200,   // Only award bonus if distance < 200km
    },
  },
};

export const TIMING = {
  SCORE_ANIMATION_MS: 800,
  RESULT_DELAY_MS: 2500,
};


export const MAP = {
  CENTER: [30, 10],
  ZOOM: 3,
  MIN_ZOOM: 0,
  MAX_ZOOM: 19,
  // Tuiles CartoDB sans labels (minimaliste)
  TILE_URL_DARK: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
  TILE_URL_LIGHT: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
  ATTRIBUTION: "",
};

// Réexport des capitales depuis le fichier existant
export { capitals } from "../capitals.js";
