// POST /.netlify/functions/submit
// Flat handler (no compose) to avoid "w is not a function" after esbuild minification

import { getDatabase } from './db.js';
import {
  successEnvelope,
  errorEnvelope,
  parseJsonBody,
  getClientIp,
  isDatabaseConnectionError,
  createLogger,
  redactForLog,
  redactToken,
} from './_utils.js';
import { API } from '../../lib/config/index.js';
import { SubmitSchema } from '../../lib/schemas/submit.js';
import {
  recordDbFailure,
  isDbBreakerOpen,
  getDbBreakerUntil,
  recordDbBreakerShortCircuit,
  getDbBreakerStats,
} from './_circuit-breaker.js';
import { createFallbackRateLimiter, checkDbRateLimit } from './_rate-limit.js';
import { acquirePseudoLock } from './_pseudo-lock.js';
import {
  createErrorJson,
  createSubmitMetrics,
  getReplayResult,
  SUPPORTED_PAYLOAD_VERSIONS,
} from './submit/helpers.js';
import { parseAndValidatePayload } from './submit/payload.js';
import { loadActiveSessionByToken } from './submit/session.js';
import { initSubmitDatabase } from './submit/database.js';
import { enforceSubmitGuards } from './submit/guards.js';
import { persistSubmitAndBuildResponse } from './submit/transaction.js';
import { enforcePseudoLock } from './submit/pseudoLock.js';
import { enforceSessionGuards } from './submit/sessionGuards.js';
import { validateAndScoreRounds } from './submit/rounds.js';

const logger = createLogger('submit');
const E2E_BYPASS_ENABLED = process.env.E2E_BYPASS_ENABLED === '1';
const E2E_BYPASS_TOKEN = process.env.E2E_BYPASS_TOKEN;
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' ||
  process.env.CONTEXT === 'production' ||
  process.env.NETLIFY_ENV === 'production';

if (IS_PRODUCTION && E2E_BYPASS_ENABLED) {
  logger.warn('[submit] E2E_BYPASS_ENABLED is set in production; bypass remains blocked');
}

const isE2EBypass = (req) => {
  if (IS_PRODUCTION) return false;
  if (!E2E_BYPASS_ENABLED || !E2E_BYPASS_TOKEN) return false;
  const token = req.headers.get('x-e2e-bypass');
  return token === E2E_BYPASS_TOKEN;
};

/**
 * 502 from Netlify usually means: function timeout (default 10s), crash before response, or cold-start failure.
 * This handler returns 500/503 for all caught errors; if you still see 502, check Netlify function logs and
 * consider increasing the submit function timeout in the Netlify UI (Pro: up to 26s).
 */

const errorJson = createErrorJson(errorEnvelope);

const fallbackLimiter = createFallbackRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: API.RATE_LIMIT_PER_HOUR,
});

/**
 * @param {Request} req
 * @param {any} context
 * @returns {Promise<Response>}
 */
export default async function submitHandler(req, context) {
  try {
    const { metrics, markStage, setBypass, finish } = createSubmitMetrics({
      logger,
      getDbBreakerStats,
      isDbBreakerOpen,
    });

    if (req.method !== 'POST') {
      return finish(errorJson('method_not_allowed', 'Method not allowed', 405), 'rejected');
    }

    if (IS_PRODUCTION && req.headers.get('x-e2e-bypass')) {
      logger.warn('[submit] Bypass header blocked in production');
      return finish(
        errorJson('bypass_not_allowed', 'E2E bypass is not allowed in production', 403),
        'rejected'
      );
    }

    const bypass = isE2EBypass(req);
    setBypass(bypass);

    const databaseResult = await initSubmitDatabase({
      context,
      getDatabase,
      logger,
      recordDbFailure,
      errorJson,
      finish,
    });
    if (databaseResult.ok === false) return databaseResult.response;
    const { sql } = databaseResult;

    logger.info('[submit] Function invoked');

    const ip = getClientIp(req, context);
    const guardResult = await enforceSubmitGuards({
      req,
      bypass,
      sql,
      ip,
      checkDbRateLimit,
      fallbackLimiter,
      maxRequests: API.RATE_LIMIT_PER_HOUR,
      markStage,
      onRateLimitBypass: () => {
        metrics.stages.rateLimitMs = 0;
      },
      logger,
      errorJson,
      finish,
      isDbBreakerOpen,
      getDbBreakerUntil,
      recordDbBreakerShortCircuit,
    });
    if (guardResult.ok === false) return guardResult.response;

    const payloadResult = await parseAndValidatePayload({
      req,
      parseJsonBody,
      SubmitSchema,
      markStage,
      logger,
      redactForLog,
      redactToken,
      errorJson,
      finish,
      supportedPayloadVersions: SUPPORTED_PAYLOAD_VERSIONS,
    });
    if (payloadResult.ok === false) return payloadResult.response;

    const { token, rounds, trimmedPseudo, gameType, csrfToken } = payloadResult;

    const sessionResult = await loadActiveSessionByToken({
      sql,
      token,
      markStage,
      logger,
      isDatabaseConnectionError,
      errorJson,
      finish,
    });
    if (sessionResult.ok === false) return sessionResult.response;
    const session = sessionResult.session;

    const sessionGuardsResult = await enforceSessionGuards({
      sql,
      token,
      session,
      csrfToken,
      gameType,
      rounds,
      bypass,
      sessionExpiryMs: API.SESSION_EXPIRY_MS,
      minGameDurationMs: API.MIN_GAME_DURATION_MS,
      logger,
      getReplayResult,
      successEnvelope,
      errorJson,
      finish,
    });
    if (sessionGuardsResult.ok === false) return sessionGuardsResult.response;
    const { now, gameDuration } = sessionGuardsResult;

    const roundResult = await validateAndScoreRounds({
      rounds,
      session,
      bypass,
      gameDuration,
      markStage,
      errorJson,
      finish,
    });
    if (roundResult.ok === false) return roundResult.response;
    const { validatedRounds, totalScore } = roundResult;
    const clientIp = getClientIp(req, context);

    if (clientIp === 'unknown') {
      return finish(
        errorJson('client_ip_unknown', 'Unable to verify player identity', 400),
        'rejected'
      );
    }

    const pseudoLockResult = await enforcePseudoLock({
      sql,
      clientIp,
      trimmedPseudo,
      acquirePseudoLock,
      markStage,
      logger,
      isDatabaseConnectionError,
      errorJson,
      finish,
    });
    if (pseudoLockResult.ok === false) return pseudoLockResult.response;

    const persistResult = await persistSubmitAndBuildResponse({
      sql,
      token,
      trimmedPseudo,
      totalScore,
      gameDuration,
      validatedRounds,
      gameType,
      now,
      clientIp,
      playerId: session.playerId,
      markStage,
      logger,
      isDatabaseConnectionError,
      getReplayResult,
      successEnvelope,
      errorJson,
      finish,
    });
    if (persistResult.ok === false) return persistResult.response;

    logger.info('[submit] Submission successful');
    return finish(successEnvelope(persistResult.payload), 'success');
  } catch (outerError) {
    // Catch any unhandled errors that might cause 502
    const error = /** @type {Error & {code?: string}} */ (outerError);
    logger.error('[submit] Unhandled error caught:', error.message, error.code, error.stack);
    logger.error('[submit] breaker stats on unhandled error:', {
      ...getDbBreakerStats(),
      isOpen: isDbBreakerOpen(),
    });

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      logger.error('[submit] JSON parsing error');
      return errorJson('invalid_json', 'Invalid request body', 400);
    }

    // Check if it's a database connection error
    if (isDatabaseConnectionError(error)) {
      logger.error('[submit] Connection error in outer catch');
      return errorJson(
        'db_connection_error',
        'Database connection error. Please try again later.',
        503
      );
    }

    // Log full error details
    logger.error(
      '[submit] Generic error - full details:',
      JSON.stringify({
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack,
      })
    );

    // Generic error response - ALWAYS return a response to prevent 502
    return errorJson('internal_error', 'Internal server error. Please try again later.', 500);
  }
}
