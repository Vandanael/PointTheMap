import { isDatabaseConnectionError } from './_utils.js';

const DB_BREAKER_WINDOW_MS = 60 * 1000;
const DB_BREAKER_COOLDOWN_MS = 60 * 1000;
const DB_BREAKER_THRESHOLD = 3;

/** @type {number[]} */
let dbFailureTimestamps = [];
let dbBreakerUntil = 0;

/** @param {unknown} error */
export const recordDbFailure = (error) => {
  if (!isDatabaseConnectionError(error)) return;
  const now = Date.now();
  dbFailureTimestamps = dbFailureTimestamps.filter((ts) => now - ts <= DB_BREAKER_WINDOW_MS);
  dbFailureTimestamps.push(now);
  if (dbFailureTimestamps.length >= DB_BREAKER_THRESHOLD) {
    dbBreakerUntil = now + DB_BREAKER_COOLDOWN_MS;
  }
};

export const isDbBreakerOpen = () => Date.now() < dbBreakerUntil;

export const getDbBreakerUntil = () => dbBreakerUntil;
