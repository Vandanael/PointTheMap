import { isDatabaseConnectionError } from './_utils.js';

const DB_BREAKER_WINDOW_MS = 60 * 1000;
const DB_BREAKER_COOLDOWN_MS = 60 * 1000;
const DB_BREAKER_THRESHOLD = 3;

/** @type {number[]} */
let dbFailureTimestamps = [];
let dbBreakerUntil = 0;
let dbBreakerOpenCount = 0;
let dbBreakerShortCircuitCount = 0;
let dbConnectionFailureCount = 0;

/** @param {unknown} error */
export const recordDbFailure = (error) => {
  if (!isDatabaseConnectionError(error)) return;
  dbConnectionFailureCount += 1;
  const now = Date.now();
  dbFailureTimestamps = dbFailureTimestamps.filter((ts) => now - ts <= DB_BREAKER_WINDOW_MS);
  dbFailureTimestamps.push(now);
  if (dbFailureTimestamps.length >= DB_BREAKER_THRESHOLD) {
    const nextBreakerUntil = now + DB_BREAKER_COOLDOWN_MS;
    if (nextBreakerUntil > dbBreakerUntil) {
      dbBreakerUntil = nextBreakerUntil;
      dbBreakerOpenCount += 1;
    }
  }
};

export const isDbBreakerOpen = () => Date.now() < dbBreakerUntil;

export const getDbBreakerUntil = () => dbBreakerUntil;

export const recordDbBreakerShortCircuit = () => {
  dbBreakerShortCircuitCount += 1;
};

export const getDbBreakerStats = () => ({
  connectionFailures: dbConnectionFailureCount,
  openCount: dbBreakerOpenCount,
  shortCircuitCount: dbBreakerShortCircuitCount,
  recentFailureCount: dbFailureTimestamps.length,
  breakerUntil: dbBreakerUntil,
});

export const resetDbBreakerForTests = () => {
  dbFailureTimestamps = [];
  dbBreakerUntil = 0;
  dbBreakerOpenCount = 0;
  dbBreakerShortCircuitCount = 0;
  dbConnectionFailureCount = 0;
};
