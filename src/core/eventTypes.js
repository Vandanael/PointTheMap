/**
 * Centralized EventBus contract.
 * Keep event names and payload shapes in one place to avoid drift.
 */

/**
 * @typedef {Object} EventPayloads
 * @property {{ message: string }} 'error:show'
 * @property {{ error: Error, context: string, fatal: boolean, timestamp: number }} 'error:occurred'
 * @property {{ error: Error, type: string, timestamp: number }} 'error:global'
 * @property {{ error: Error, context: string, timestamp: number }} 'error:fatal'
 * @property {{ state: any, prevState: any, action: string }} 'state:changed'
 * @property {{ timerMs?: number, roundId?: number | null }} 'timer:started'
 * @property {{ roundId?: number | null }} 'timer:danger'
 * @property {{ roundId?: number | null }} 'timer:timeout'
 * @property {{ timestamp: number, roundId?: number | null }} 'timer:tick'
 * @property {{ oldScore: number, newScore: number, delta: number }} 'score:updated'
 * @property {{ round: any }} 'game:round:completed'
 * @property {{ gameType: string, capitalCount?: number }} 'game:started'
 * @property {{ theme: string }} 'theme:changed'
 * @property {{ language: string }} 'language:changed'
 * @property {{ message: string }} 'storage:quota-exceeded'
 * @property {{ message: string }} 'storage:quota-recovered'
 * @property {{ message: string }} 'storage:quota-failed'
 * @property {{}} 'input:map-enabled'
 * @property {{}} 'input:map-disabled'
 * @property {{}} 'input:next-round'
 * @property {{ pseudo: string }} 'input:submit'
 * @property {{}} 'input:replay'
 * @property {{ gameType?: string }} 'input:start-game'
 * @property {{ key: string }} 'input:action'
 * @property {{}} 'input:escape'
 * @property {{}} 'map:tiles-retry'
 * @property {{}} 'map:tiles-loading'
 * @property {{}} 'map:tiles-loaded'
 * @property {{ error?: any }} 'map:tiles-error'
 * @property {{ lat: number, lng: number }} 'map:click'
 * @property {{ roundId?: number | null }} 'timer:started'
 * @property {{ id: string, achievement: any }} 'achievement:unlocked'
 */

/**
 * @type {const}
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
