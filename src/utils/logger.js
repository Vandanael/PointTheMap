// Point The Map - Enhanced Logger
// Désactivé en production (sauf errors/fatal), actif en développement

/**
 * @typedef {'debug' | 'info' | 'log' | 'warn' | 'error' | 'fatal'} LogLevel
 */

/** @type {Record<LogLevel, number>} */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  log: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const isDev = import.meta.env.DEV;
const isVitest = typeof import.meta !== 'undefined' && /** @type {any} */ (import.meta).vitest;
const globalProcess =
  typeof globalThis !== 'undefined' ? /** @type {any} */ (globalThis).process : undefined;
const isNodeTest =
  globalProcess?.env && (globalProcess.env.VITEST || globalProcess.env.NODE_ENV === 'test');
const isGlobalVitest =
  typeof globalThis !== 'undefined' &&
  /** @type {any} */ (globalThis.__vitest__ || /** @type {any} */ (globalThis).__VITEST__);
const isTest = Boolean(
  isVitest ||
  isNodeTest ||
  isGlobalVitest ||
  import.meta.env.MODE === 'test' ||
  import.meta.env.TEST
);
const minLevel = isTest ? LOG_LEVELS.fatal : isDev ? LOG_LEVELS.debug : LOG_LEVELS.warn;

/**
 * Format log message with timestamp and level
 * @param {LogLevel} level
 * @param {any[]} args
 * @returns {any[]}
 */
const formatMessage = (level, args) => {
  if (!isDev) return args; // No formatting in production/test

  const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  return [prefix, ...args];
};

/**
 * Create a logger instance
 * @param {string} [category] - Optional category for this logger
 * @returns {Logger}
 */
const createLogger = (category = 'app') => {
  /**
   * @param {LogLevel} level
   * @param {...any} args
   */
  const log = (level, ...args) => {
    if (LOG_LEVELS[level] < minLevel) return;

    const formatted = formatMessage(level, args);
    /** @type {keyof Console} */
    const method = level === 'fatal' ? 'error' : level;

    if (category !== 'app' && isDev) {
      console[method](`[${category}]`, ...formatted);
    } else {
      console[method](...formatted);
    }
  };

  return {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    log: (...args) => log('log', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
    fatal: (...args) => log('fatal', ...args),
  };
};

export const logger = createLogger();

/**
 * @typedef {Object} Logger
 * @property {(...args: any[]) => void} debug
 * @property {(...args: any[]) => void} info
 * @property {(...args: any[]) => void} log
 * @property {(...args: any[]) => void} warn
 * @property {(...args: any[]) => void} error
 * @property {(...args: any[]) => void} fatal
 */
