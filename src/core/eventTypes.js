/**
 * Centralized EventBus contract.
 * Keep event names and payload shapes in one place to avoid drift.
 */

/**
 * Event payloads are documented in `docs/event-bus.md`.
 * This file defines the canonical event name constants.
 */

export const EVENTS = {
  // Errors
  ERROR_SHOW: 'error:show',
  ERROR_OCCURRED: 'error:occurred',
  ERROR_GLOBAL: 'error:global',
  ERROR_FATAL: 'error:fatal',

  // State
  STATE_CHANGED: 'state:changed',

  // Timer
  TIMER_STARTED: 'timer:started',
  TIMER_DANGER: 'timer:danger',
  TIMER_TIMEOUT: 'timer:timeout',
  TIMER_TICK: 'timer:tick',

  // Score
  SCORE_UPDATED: 'score:updated',
  SCORE_CALCULATED: 'score:calculated',

  // Game
  GAME_ROUND_COMPLETED: 'game:round:completed',
  GAME_STARTED: 'game:started',

  // Theme / Language
  THEME_CHANGED: 'theme:changed',
  LANGUAGE_CHANGED: 'language:changed',

  // Storage
  STORAGE_QUOTA_EXCEEDED: 'storage:quota-exceeded',
  STORAGE_QUOTA_RECOVERED: 'storage:quota-recovered',
  STORAGE_QUOTA_FAILED: 'storage:quota-failed',

  // Input
  INPUT_MAP_ENABLED: 'input:map-enabled',
  INPUT_MAP_DISABLED: 'input:map-disabled',
  INPUT_NEXT_ROUND: 'input:next-round',
  INPUT_SUBMIT: 'input:submit',
  INPUT_REPLAY: 'input:replay',
  INPUT_START_GAME: 'input:start-game',
  INPUT_ACTION: 'input:action',
  INPUT_ESCAPE: 'input:escape',

  // Map — tiles
  MAP_TILES_RETRY: 'map:tiles-retry',
  MAP_TILES_LOADING: 'map:tiles-loading',
  MAP_TILES_LOADED: 'map:tiles-loaded',
  MAP_TILES_ERROR: 'map:tiles-error',
  MAP_CLICK: 'map:click',

  // Map — lifecycle
  MAP_READY: 'map:ready',
  MAP_ERROR: 'map:error',
  MAP_DESTROYED: 'map:destroyed',
  MAP_RESULT_SHOWN: 'map:result-shown',
  MAP_CLEARED: 'map:cleared',
  MAP_CAPITALS_CLEARED: 'map:capitals-cleared',
  MAP_VIEW_RESET: 'map:view-reset',

  // Map — countries GeoJSON
  MAP_COUNTRIES_LOADED: 'map:countries-loaded',
  MAP_COUNTRIES_ERROR: 'map:countries-error',
  MAP_COUNTRIES_FULL_LOADED: 'map:countries-full-loaded',
  MAP_COUNTRIES_HIGHLIGHTED: 'map:countries-highlighted',
  MAP_COUNTRY_HIGHLIGHTS_CLEARED: 'map:country-highlights-cleared',

  // Map — civilizations GeoJSON
  MAP_CIVILIZATIONS_LOADED: 'map:civilizations-loaded',
  MAP_CIVILIZATIONS_ERROR: 'map:civilizations-error',
  MAP_CIVILIZATIONS_FULL_LOADED: 'map:civilizations-full-loaded',
  MAP_CIVILIZATIONS_HIGHLIGHTED: 'map:civilizations-highlighted',
  MAP_CIVILIZATION_HIGHLIGHTS_CLEARED: 'map:civilization-highlights-cleared',

  // Stats
  STATS_UPDATED: 'stats:updated',
  STATS_RESET: 'stats:reset',

  // Achievements
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
};
