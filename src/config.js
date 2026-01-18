// Point The Map - Configuration
// Constantes non-sensibles (scoring côté serveur uniquement)

export const GAME = {
  ROUNDS: 5,
  TIMER_MS: 5000,
  GRACE_PERIOD_MS: 500,
  DANGER_ZONE_MS: 1500,
  MAX_SCORE_PER_ROUND: 5000,
  MAX_TOTAL_SCORE: 25000,
};

export const TIMING = {
  MODAL_DISPLAY_MS: 1000,
  SCORE_ANIMATION_MS: 800,
  RESULT_DELAY_MS: 2500,
};

export const VALIDATION = {
  PSEUDO_REGEX: /^[A-Z]{3,5}$/,
  MIN_PSEUDO_LENGTH: 3,
  MAX_PSEUDO_LENGTH: 5,
};

export const LEADERBOARD = {
  TOP_LIMIT: 50,
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
