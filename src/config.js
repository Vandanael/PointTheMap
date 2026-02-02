// Point The Map - Configuration
// Constantes non-sensibles (scoring côté serveur uniquement)
// GAME.* is fallback/default for tests and getRuntimeGameConfig only; in live play use state.runtimeConfig (from getRuntimeGameConfig(gameType)).

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

  // Achievement thresholds (more generous for gameplay satisfaction)
  ACHIEVEMENT_PERFECT: 1,     // < 1km = Achievement-worthy perfect round

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
    country: {
      enabled: false,           // Country mode: no time bonus (distance-based only)
      maxBonus: 0,
      maxBonusPercent: 0,
      distanceThreshold: 200,
    },
  },
};

/** Global timing constants. Mode-specific timing (e.g. timer) lives in GAME / game-modes. */
export const TIMING = {
  SCORE_ANIMATION_MS: 800,
  /** Max wait before showing answer modal after result line; user can tap/click to continue earlier. Reduced from 2500ms to 1.5s for better game feel. */
  RESULT_READ_TIME_MS: 1500,
};


export const MAP = {
  CENTER: [30, 10],
  ZOOM: 3,
  MIN_ZOOM: 0,
  MAX_ZOOM: 19,
  /** Auray, France – used as start screen background (same Carto tiles as game) */
  AURAY_CENTER: [47.6706, -2.9833],
  AURAY_ZOOM: 14,
  // Tuiles CartoDB sans labels (minimaliste)
  TILE_URL_DARK: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
  TILE_URL_LIGHT: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
  ATTRIBUTION: "",
};

/**
 * API and server-side configuration
 * Used by Netlify functions for validation and rate limiting
 */
export const API = {
  // Session configuration
  SESSION_EXPIRY_MS: 10 * 60 * 1000,  // 10 minutes

  // Rate limiting
  RATE_LIMIT_PER_HOUR: 50,            // Maximum requests per hour per IP

  // Game validation
  MIN_GAME_DURATION_MS: 5000,         // Minimum plausible game duration (5 seconds)
  MIN_PLAUSIBLE_DURATION_MS: 15000,   // Minimum realistic duration (15 seconds)
  MAX_GAME_DURATION_MS: 10 * 60 * 1000, // Maximum game duration (10 minutes)
  MIN_ROUND_TIME_MS: 100,             // Minimum plausible time per round (human reaction time)

  // Leaderboard
  LEADERBOARD_TOP_LIMIT: 50,          // Number of top scores to return
  LEADERBOARD_QUERY_LIMIT: 100,       // Fetch limit before deduplication

  // Geographic validation
  MAX_DISTANCE_KM: 20015,             // Half of Earth's circumference (max valid distance)

  // Database timeouts
  DB_QUERY_TIMEOUT_MS: 8000,          // Database query timeout
};
