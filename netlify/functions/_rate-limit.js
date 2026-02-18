import { recordDbFailure } from './_circuit-breaker.js';

const cleanupIntervalRaw = Number.parseInt(
  process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || '300000',
  10
);
const RATE_LIMIT_CLEANUP_INTERVAL_MS =
  Number.isFinite(cleanupIntervalRaw) && cleanupIntervalRaw > 0 ? cleanupIntervalRaw : 300000;
let lastRateLimitCleanupAt = 0;

/**
 * Create an in-memory fallback rate limiter.
 * @param {{ windowMs: number, maxRequests: number }} options
 * @returns {{ check: (ip: string) => { allowed: boolean, remaining: number } }}
 */
export function createFallbackRateLimiter({ windowMs, maxRequests }) {
  /** @type {Map<string, { count: number, expiresAt: number }>} */
  const limits = new Map();

  return {
    check(ip) {
      const now = Date.now();
      const entry = limits.get(ip);
      if (!entry || now > entry.expiresAt) {
        limits.set(ip, { count: 1, expiresAt: now + windowMs });
        return { allowed: true, remaining: maxRequests - 1 };
      }
      if (entry.count >= maxRequests) {
        return { allowed: false, remaining: 0 };
      }
      entry.count += 1;
      return { allowed: true, remaining: maxRequests - entry.count };
    },
  };
}

/**
 * Opportunistic cleanup of expired rate-limit rows.
 * Runs at most once per cleanup interval and only for a sampled subset of requests.
 * @param {{ sql: any, logger?: any, sampleRate?: number, force?: boolean }} options
 * @returns {Promise<boolean>} true when cleanup query ran
 */
export async function maybeCleanupExpiredRateLimits({
  sql,
  logger,
  sampleRate = 0.05,
  force = false,
}) {
  const now = Date.now();
  if (!force) {
    if (now - lastRateLimitCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) return false;
    if (Math.random() >= sampleRate) return false;
  }
  await sql`DELETE FROM rate_limits WHERE expires_at < NOW()`;
  lastRateLimitCleanupAt = now;
  if (logger?.debug) {
    logger.debug('Rate-limit cleanup executed');
  }
  return true;
}

/**
 * DB-based rate limiter with in-memory fallback.
 * @param {{ ip: string, sql: any, keyPrefix: string, maxRequests: number, fallback: ReturnType<typeof createFallbackRateLimiter>, logger?: any }} options
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkDbRateLimit({ ip, sql, keyPrefix, maxRequests, fallback, logger }) {
  try {
    const hourKey = `${keyPrefix}${ip}-${Math.floor(Date.now() / 3600000)}`;
    const expiresAt = new Date(Date.now() + 3600000);

    try {
      await maybeCleanupExpiredRateLimits({ sql, logger });
    } catch (cleanupError) {
      if (process.env.NODE_ENV === 'development' && logger) {
        const error = /** @type {Error} */ (cleanupError);
        logger.warn('Rate-limit cleanup failed:', error.message);
      }
    }

    // Atomic upsert: INSERT or increment in a single query (no race condition)
    const result = await sql`
      INSERT INTO rate_limits (key, count, expires_at)
      VALUES (${hourKey}, 1, ${expiresAt})
      ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `;

    const count = result[0]?.count ?? 1;
    if (count > maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: maxRequests - count };
  } catch (e) {
    recordDbFailure(e);
    if (process.env.NODE_ENV === 'development' && logger) {
      const error = /** @type {Error & {code?: string}} */ (e);
      logger.error('Rate limit error:', error.message, error.code);
    }
    return fallback.check(ip);
  }
}
