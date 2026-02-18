/**
 * Enforce circuit-breaker and rate-limit guards for submit flow.
 *
 * @param {{
 *   req: Request,
 *   bypass: boolean,
 *   sql: any,
 *   ip: string,
 *   checkDbRateLimit: (options: any) => Promise<{ allowed: boolean, remaining: number }>,
 *   fallbackLimiter: { check: (ip: string) => { allowed: boolean, remaining: number } },
 *   maxRequests: number,
 *   markStage: (stage: string, startedAt: number) => void,
 *   onRateLimitBypass: () => void,
 *   logger: { info: (...args: any[]) => void, warn: (...args: any[]) => void, error: (...args: any[]) => void },
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response,
 *   isDbBreakerOpen: () => boolean,
 *   getDbBreakerUntil: () => number,
 *   recordDbBreakerShortCircuit: () => void
 * }} deps
 * @returns {Promise<{ ok: true } | { ok: false, response: Response }>}
 */
export async function enforceSubmitGuards(deps) {
  const {
    bypass,
    sql,
    ip,
    checkDbRateLimit,
    fallbackLimiter,
    maxRequests,
    markStage,
    onRateLimitBypass,
    logger,
    errorJson,
    finish,
    isDbBreakerOpen,
    getDbBreakerUntil,
    recordDbBreakerShortCircuit,
  } = deps;

  if (isDbBreakerOpen()) {
    recordDbBreakerShortCircuit();
    const retryAfterSeconds = Math.ceil((getDbBreakerUntil() - Date.now()) / 1000);
    return {
      ok: false,
      response: finish(
        errorJson(
          'service_unavailable',
          'Service temporarily unavailable. Please retry.',
          503,
          { retryAfter: retryAfterSeconds },
          { 'Retry-After': String(retryAfterSeconds) }
        ),
        'failure',
        { reason: 'db_breaker_open' }
      ),
    };
  }

  if (!bypass) {
    const rateLimitStart = Date.now();
    let rateLimit;
    try {
      rateLimit = await checkDbRateLimit({
        ip,
        sql,
        keyPrefix: '',
        maxRequests,
        fallback: fallbackLimiter,
        logger,
      });
    } catch (rateLimitError) {
      logger.error('Rate limit check failed:', rateLimitError);
      rateLimit = fallbackLimiter.check(ip);
    }
    markStage('rateLimitMs', rateLimitStart);

    if (!rateLimit.allowed) {
      return {
        ok: false,
        response: finish(
          errorJson('rate_limited', 'Rate limit exceeded. Try again later.', 429),
          'rejected'
        ),
      };
    }
    logger.info('[submit] rate limit ok, remaining:', rateLimit.remaining);
    return { ok: true };
  }

  logger.info('[submit] e2e bypass enabled: skipping rate limit');
  onRateLimitBypass();
  return { ok: true };
}
