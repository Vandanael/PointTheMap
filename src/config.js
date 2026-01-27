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
 * Scoring thresholds - Single source of truth for all distance-based categories
 * Used by: ScoringSystem, UI components, visual constants
 */
export const SCORING_THRESHOLDS = {
  // Category boundaries (km)
  PERFECT_MAX: 1,        // < 1km = Perfect
  EXCELLENT_MAX: 50,     // 1-50km = Excellent
  GOOD_MAX: 200,         // 50-200km = Good
  FAIR_MAX: 1000,        // 200-1000km = Fair
  // > 1000km = Poor

  // Smooth transition zones
  PERFECT_TRANSITION_START: 0.5,  // Start transition from perfect
  PERFECT_TRANSITION_END: 2,       // End transition to excellent

  // Formula transition points (km)
  EXPONENTIAL_END: 100,  // End of exponential decay (1-100km)
  LINEAR_END: 500,       // End of linear interpolation (100-500km)
  // > 500km = exponential decay

  // Visual/UI thresholds (can differ from category boundaries)
  VISUAL_EXCELLENT: 100,  // Green line color
  VISUAL_GOOD: 500,       // Yellow line color
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
