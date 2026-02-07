/**
 * Centralized EventBus contract.
 * Keep event names and payload shapes in one place to avoid drift.
 */

/**
 * Event payloads are documented in `docs/event-bus.md`.
 * This file defines the canonical event name constants.
 */

export const EVENTS = {
  ERROR_SHOW: 'error:show',
  ERROR_OCCURRED: 'error:occurred',
  ERROR_GLOBAL: 'error:global',
  ERROR_FATAL: 'error:fatal',
  STATE_CHANGED: 'state:changed',
  TIMER_STARTED: 'timer:started',
  TIMER_DANGER: 'timer:danger',
  TIMER_TIMEOUT: 'timer:timeout',
  TIMER_TICK: 'timer:tick',
  SCORE_UPDATED: 'score:updated',
  GAME_ROUND_COMPLETED: 'game:round:completed',
  GAME_STARTED: 'game:started',
  THEME_CHANGED: 'theme:changed',
  LANGUAGE_CHANGED: 'language:changed',
  STORAGE_QUOTA_EXCEEDED: 'storage:quota-exceeded',
  STORAGE_QUOTA_RECOVERED: 'storage:quota-recovered',
  STORAGE_QUOTA_FAILED: 'storage:quota-failed',
  INPUT_MAP_ENABLED: 'input:map-enabled',
  INPUT_MAP_DISABLED: 'input:map-disabled',
  INPUT_NEXT_ROUND: 'input:next-round',
  INPUT_SUBMIT: 'input:submit',
  INPUT_REPLAY: 'input:replay',
  INPUT_START_GAME: 'input:start-game',
  INPUT_ACTION: 'input:action',
  INPUT_ESCAPE: 'input:escape',
  MAP_TILES_RETRY: 'map:tiles-retry',
  MAP_TILES_LOADING: 'map:tiles-loading',
  MAP_TILES_LOADED: 'map:tiles-loaded',
  MAP_TILES_ERROR: 'map:tiles-error',
  MAP_CLICK: 'map:click',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
};
