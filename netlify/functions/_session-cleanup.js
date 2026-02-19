const cleanupIntervalRaw = Number.parseInt(
  process.env.SESSION_CLEANUP_INTERVAL_MS || process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || '',
  10
);
const cleanupSampleRateRaw = Number.parseFloat(
  process.env.SESSION_CLEANUP_SAMPLE_RATE || process.env.RATE_LIMIT_CLEANUP_SAMPLE_RATE || ''
);

const DEFAULT_INTERVAL_MS =
  Number.isFinite(cleanupIntervalRaw) && cleanupIntervalRaw > 0 ? cleanupIntervalRaw : 300000;
const DEFAULT_SAMPLE_RATE =
  Number.isFinite(cleanupSampleRateRaw) && cleanupSampleRateRaw > 0 && cleanupSampleRateRaw <= 1
    ? cleanupSampleRateRaw
    : 0.1;

/** @type {Map<string, number>} */
const lastCleanupAtByScope = new Map();

/**
 * Decide if cleanup should run for this request.
 * Sampling check remains effective even when serverless cold starts reset memory.
 *
 * @param {{
 *   scope?: string,
 *   now?: number,
 *   minIntervalMs?: number,
 *   sampleRate?: number,
 *   random?: () => number
 * }} [options]
 */
export function shouldRunSessionCleanup(options = {}) {
  const {
    scope = 'global',
    now = Date.now(),
    minIntervalMs = DEFAULT_INTERVAL_MS,
    sampleRate = DEFAULT_SAMPLE_RATE,
    random = Math.random,
  } = options;

  if (sampleRate <= 0 || random() >= sampleRate) return false;

  const lastRunAt = lastCleanupAtByScope.get(scope) || 0;
  if (lastRunAt > 0 && now - lastRunAt < minIntervalMs) return false;

  lastCleanupAtByScope.set(scope, now);
  return true;
}

/**
 * Best-effort stale session cleanup.
 *
 * @param {{
 *   sql: any,
 *   logger: { warn?: (...args: any[]) => void, debug?: (...args: any[]) => void },
 *   scope?: string,
 *   now?: number,
 *   minIntervalMs?: number,
 *   sampleRate?: number,
 *   random?: () => number
 * }} deps
 * @returns {Promise<boolean>} true if cleanup query was executed
 */
export async function cleanupExpiredSessions(deps) {
  const { sql, logger, scope = 'global', now, minIntervalMs, sampleRate, random } = deps;
  if (!shouldRunSessionCleanup({ scope, now, minIntervalMs, sampleRate, random })) return false;

  try {
    await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
    logger?.debug?.('Session cleanup executed');
  } catch (cleanupError) {
    const error = /** @type {Error} */ (cleanupError);
    logger?.warn?.('Session cleanup skipped:', error.message);
  }
  return true;
}

/** Test helper: reset in-memory cleanup gates. */
export function __testOnlyResetSessionCleanupState() {
  lastCleanupAtByScope.clear();
}
