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
import { toDomainModel } from '../../lib/session/sessionModel.js';
import { SubmitSchema } from '../../lib/schemas/submit.js';
import {
  recordDbFailure,
  isDbBreakerOpen,
  getDbBreakerUntil,
  recordDbBreakerShortCircuit,
  getDbBreakerStats,
} from './_circuit-breaker.js';
import { createFallbackRateLimiter, checkDbRateLimit } from './_rate-limit.js';
import { checkPlausibility, validateRounds } from './_round-validation.js';
import { scoreRound } from './_round-scoring.js';
import { acquirePseudoLock } from './_pseudo-lock.js';

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

/**
 * @param {string} code
 * @param {string} message
 * @param {number} [status=400]
 * @param {unknown} [details]
 * @param {Record<string, string>} [headers]
 * @returns {Response}
 */
const errorJson = (code, message, status = 400, details = undefined, headers = undefined) =>
  errorEnvelope(code, message, status, details, headers);

/**
 * Read a previously inserted score for this session token and rebuild a submit response.
 * @param {any} sql
 * @param {string} token
 * @returns {Promise<null | { score: number, rank: number, isTopFifty: boolean, rounds: any[] }>}
 */
const getReplayResult = async (sql, token) => {
  const rows = await sql`
    SELECT score, time, rounds, game_type
    FROM scores
    WHERE session_token = ${token}
    ORDER BY id DESC
    LIMIT 1
  `;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = /** @type {{ score?: number, time?: number, rounds?: any[], game_type?: string }} */ (
    rows[0]
  );
  const score = Number.isFinite(row.score) ? row.score : 0;
  const time = Number.isFinite(row.time) ? row.time : 0;
  const gameType = row.game_type || 'classic';

  let rank = 0;
  try {
    const rankResult = await sql`
      SELECT COUNT(*) + 1 as rank
      FROM scores
      WHERE game_type = ${gameType}
        AND (score > ${score} OR (score = ${score} AND time < ${time}))
    `;
    rank = parseInt(rankResult[0]?.rank ?? '0', 10);
  } catch {
    rank = 0;
  }

  return {
    score,
    rank,
    isTopFifty: rank > 0 && rank <= 50,
    rounds: Array.isArray(row.rounds) ? row.rounds : [],
  };
};

const SUPPORTED_PAYLOAD_VERSIONS = new Set([1]);

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
    /** @type {{ startedAt: number, bypass: boolean, stages: Record<string, number> }} */
    const metrics = {
      startedAt: Date.now(),
      bypass: false,
      stages: {},
    };
    /**
     * @param {string} stage
     * @param {number} startedAt
     */
    const markStage = (stage, startedAt) => {
      metrics.stages[stage] = Date.now() - startedAt;
    };
    /**
     * @param {Response} response
     * @param {'success' | 'rejected' | 'failure'} outcome
     * @param {Record<string, unknown>} [details]
     */
    const finish = (response, outcome, details = undefined) => {
      const payload = {
        outcome,
        totalMs: Date.now() - metrics.startedAt,
        bypass: metrics.bypass,
        stages: metrics.stages,
        breaker: {
          ...getDbBreakerStats(),
          isOpen: isDbBreakerOpen(),
        },
        ...(details ? { details } : {}),
      };
      if (outcome === 'success') {
        logger.info('[submit] metrics', payload);
      } else if (outcome === 'rejected') {
        logger.warn('[submit] metrics', payload);
      } else {
        logger.error('[submit] metrics', payload);
      }
      return response;
    };

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
    metrics.bypass = bypass;

    if (isDbBreakerOpen()) {
      recordDbBreakerShortCircuit();
      const retryAfterSeconds = Math.ceil((getDbBreakerUntil() - Date.now()) / 1000);
      return finish(
        errorJson(
          'service_unavailable',
          'Service temporarily unavailable. Please retry.',
          503,
          { retryAfter: retryAfterSeconds },
          { 'Retry-After': String(retryAfterSeconds) }
        ),
        'failure',
        { reason: 'db_breaker_open' }
      );
    }

    let sql;
    try {
      sql = getDatabase(context);
    } catch (dbError) {
      const error = /** @type {Error} */ (dbError);
      logger.error('Database connection failed:', error.message);
      recordDbFailure(dbError);
      return finish(
        errorJson(
          'db_connection_failed',
          'Database connection failed. Please try again later.',
          503
        ),
        'failure',
        { reason: 'db_connection_setup_failed' }
      );
    }
    context.sql = sql;
    // Best-effort TTL cleanup for stale sessions.
    try {
      await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
    } catch (cleanupError) {
      logger.warn(
        '[submit] session cleanup skipped:',
        /** @type {Error} */ (cleanupError).message
      );
    }

    logger.info('[submit] Function invoked');

    const ip = getClientIp(req, context);

    if (!bypass) {
      const rateLimitStart = Date.now();
      // Wrap rate limit check in try-catch
      let rateLimit;
      try {
        rateLimit = await checkDbRateLimit({
          ip,
          sql,
          keyPrefix: '',
          maxRequests: API.RATE_LIMIT_PER_HOUR,
          fallback: fallbackLimiter,
          logger,
        });
      } catch (rateLimitError) {
        // If rate limiting fails, log but allow request to proceed
        logger.error('Rate limit check failed:', rateLimitError);
        rateLimit = fallbackLimiter.check(ip);
      }
      markStage('rateLimitMs', rateLimitStart);

      if (!rateLimit.allowed) {
        return finish(
          errorJson('rate_limited', 'Rate limit exceeded. Try again later.', 429),
          'rejected'
        );
      }
      logger.info('[submit] rate limit ok, remaining:', rateLimit.remaining);
    } else {
      logger.info('[submit] e2e bypass enabled: skipping rate limit');
      metrics.stages.rateLimitMs = 0;
    }

    const parseAndValidateStart = Date.now();
    const body = await parseJsonBody(req);
    const parsed = SubmitSchema.safeParse(body);
    markStage('parseAndValidateMs', parseAndValidateStart);
    if (!parsed.success) {
      logger.error('[submit] Payload validation failed:', parsed.error.flatten());
      logger.info(
        '[submit] Invalid payload details:',
        redactForLog({
          fieldErrors: parsed.error.flatten().fieldErrors,
          formErrors: parsed.error.flatten().formErrors,
          token: body?.token,
          gameType: body?.gameType,
          roundsCount: body?.rounds?.length,
        })
      );
      return finish(
        errorJson('invalid_payload', 'Invalid payload', 400, parsed.error.flatten()),
        'rejected'
      );
    }
    const { token, rounds, pseudo, gameType = 'classic', payloadVersion } = parsed.data;
    const effectivePayloadVersion = payloadVersion ?? 1;
    if (!SUPPORTED_PAYLOAD_VERSIONS.has(effectivePayloadVersion)) {
      return finish(
        errorJson(
          'unsupported_payload_version',
          `Unsupported payload version (${effectivePayloadVersion})`,
          400
        ),
        'rejected'
      );
    }
    const csrfToken = req.headers.get('x-csrf-token');

    logger.info(
      '[submit] Request details - Token:',
      redactToken(token),
      'CSRF from header:',
      redactToken(csrfToken),
      'payloadVersion:',
      payloadVersion ?? null
    );

    // Validate pseudo: 3-5 uppercase letters
    const trimmedPseudo = pseudo.trim();
    if (
      trimmedPseudo.length < 3 ||
      trimmedPseudo.length > 5 ||
      !/^[A-Z]{3,5}$/.test(trimmedPseudo)
    ) {
      return finish(
        errorJson('invalid_pseudo', 'Invalid pseudo (3-5 uppercase letters required)', 400),
        'rejected'
      );
    }

    const sessionLookupStart = Date.now();
    let sessionResult;
    try {
      sessionResult = await sql`
        SELECT token, targets, start_time, used, game_type, expires_at, csrf_token, player_id
        FROM sessions
        WHERE token = ${token}
          AND expires_at > NOW()
      `;
      markStage('sessionLookupMs', sessionLookupStart);
    } catch (dbError) {
      const error = /** @type {Error & {code?: string}} */ (dbError);
      logger.error('Database query error (session lookup):', error.message, error.code);
      return finish(
        errorJson(
          isDatabaseConnectionError(error) ? 'db_connection_error' : 'db_error',
          'Database error. Please try again later.',
          isDatabaseConnectionError(error) ? 503 : 500
        ),
        'failure',
        { stage: 'session_lookup' }
      );
    }

    if (sessionResult.length === 0) {
      return finish(
        errorJson('session_not_found', 'Session not found or expired', 401),
        'rejected'
      );
    }

    const sessionRow = /** @type {any} */ (sessionResult[0]);
    // Map DB row to persistence model, then normalize to domain model
    const persistenceSession = {
      token: sessionRow.token,
      targets: sessionRow.targets,
      startTime: parseInt(sessionRow.start_time, 10),
      used: sessionRow.used,
      gameType: sessionRow.game_type,
      csrfToken: sessionRow.csrf_token,
      playerId: sessionRow.player_id ?? undefined,
    };
    const session = toDomainModel(persistenceSession);

    // CSRF token validation (strict: reject any mismatch)
    if (session.csrfToken !== csrfToken) {
      logger.info('[submit] CSRF token mismatch, returning 403');
      return finish(errorJson('csrf_mismatch', 'Invalid CSRF token', 403), 'rejected');
    }

    if (session.used) {
      const replay = await getReplayResult(sql, token);
      if (replay) {
        return finish(successEnvelope(replay, {}, { idempotentReplay: true }), 'success', {
          idempotentReplay: true,
        });
      }
      return finish(errorJson('session_used', 'Session already used', 401), 'rejected');
    }

    if (session.gameType && session.gameType !== gameType) {
      return finish(errorJson('game_type_mismatch', 'Game type mismatch', 400), 'rejected');
    }

    const now = Date.now();

    if (session.startTime > now) {
      return finish(
        errorJson('invalid_session_timestamp', 'Invalid session timestamp', 400),
        'rejected'
      );
    }

    const gameDuration = now - session.startTime;

    if (gameDuration < 0) {
      return finish(errorJson('invalid_game_duration', 'Invalid game duration', 400), 'rejected');
    }

    if (gameDuration > API.SESSION_EXPIRY_MS) {
      await sql`DELETE FROM sessions WHERE token = ${token}`;
      return finish(errorJson('session_expired', 'Session expired', 401), 'rejected');
    }

    if (!bypass && gameDuration < API.MIN_GAME_DURATION_MS) {
      return finish(errorJson('suspicious_fast', 'Suspicious activity: too fast', 400), 'rejected');
    }

    // Aggregate round timing sanity check (prevents impossible time bonuses)
    const timeElapsedValues = rounds
      .map((round) => round?.timeElapsed)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    if (timeElapsedValues.length === rounds.length) {
      const totalElapsed = timeElapsedValues.reduce((sum, value) => sum + value, 0);
      if (totalElapsed > gameDuration + 1000) {
        return finish(
          errorJson('invalid_round_times', 'Round timings exceed total game duration', 400, {
            totalElapsed,
            gameDuration,
          }),
          'rejected'
        );
      }
    }

    const roundProcessingStart = Date.now();
    const validation = validateRounds(rounds, session.targets, session.gameType || 'classic');
    if (!validation.valid) {
      return finish(
        errorJson('invalid_rounds', validation.error || 'Invalid rounds', 400),
        'rejected'
      );
    }

    if (!bypass) {
      const plausibility = checkPlausibility(gameDuration);
      if (!plausibility.valid) {
        return finish(
          errorJson(
            'implausible_duration',
            plausibility.reason || 'Session duration implausible',
            400
          ),
          'rejected'
        );
      }
    }

    const validatedRounds = rounds.map((round, i) => scoreRound(round, i, session));
    markStage('roundValidationAndScoringMs', roundProcessingStart);

    const totalScore = validatedRounds.reduce(
      (/** @type {number} */ sum, /** @type {any} */ r) => sum + r.score,
      0
    );
    const clientIp = getClientIp(req, context);

    if (clientIp === 'unknown') {
      return finish(
        errorJson('client_ip_unknown', 'Unable to verify player identity', 400),
        'rejected'
      );
    }

    const pseudoLockStart = Date.now();
    /** @type {{ ok: true, lock: { pseudo: string, updatedAt: string, expiresAt: string } } | { ok: false, pseudo: string | null, lock: { pseudo: string | null, updatedAt: string | null, expiresAt: string | null } }} */
    let pseudoLockResult;
    try {
      pseudoLockResult = await acquirePseudoLock({
        sql,
        ip: clientIp,
        pseudo: trimmedPseudo,
      });
      markStage('pseudoLockMs', pseudoLockStart);
    } catch (dbError) {
      const error = /** @type {Error & {code?: string}} */ (dbError);
      logger.error('Database query error (pseudo lock):', error.message, error.code);
      return finish(
        errorJson(
          isDatabaseConnectionError(error) ? 'db_connection_error' : 'db_error',
          'Database error. Please try again later.',
          isDatabaseConnectionError(error) ? 503 : 500
        ),
        'failure',
        { stage: 'pseudo_lock' }
      );
    }

    if (!pseudoLockResult.ok) {
      const lockedPseudo = 'pseudo' in pseudoLockResult ? pseudoLockResult.pseudo : null;
      return finish(
        errorJson('pseudo_already_set_for_this_ip', 'Pseudo already set for this IP', 409, {
          pseudo: lockedPseudo,
          lock: pseudoLockResult.lock,
        }),
        'rejected'
      );
    }

    let rank = 1;
    let isTopFifty = false;

    const transactionStart = Date.now();
    try {
      // Atomic transaction: mark session used, insert score, update player, delete session
      logger.info('[submit] Starting database transaction');
      const txnQueries = [
        sql`UPDATE sessions SET used = true WHERE token = ${token} AND used = false`,
        sql`
          INSERT INTO scores (pseudo, score, time, rounds, timestamp, game_type, session_token, ip, player_id)
          VALUES (${trimmedPseudo}, ${totalScore}, ${gameDuration}, ${JSON.stringify(validatedRounds)}::jsonb, ${now}, ${gameType}, ${token}, ${clientIp}, ${session.playerId})
        `,
        ...(session.playerId
          ? [
              sql`
              UPDATE players
              SET total_games = total_games + 1,
                  total_score = total_score + ${totalScore}
              WHERE player_id = ${session.playerId}
            `,
            ]
          : []),
      ];
      await sql.transaction(txnQueries);
      logger.info('[submit] Transaction committed');
      markStage('transactionMs', transactionStart);

      let rankResult;
      const rankLookupStart = Date.now();
      try {
        logger.info('[submit] Calculating rank');
        rankResult = await sql`
          SELECT COUNT(*) + 1 as rank
          FROM scores
          WHERE game_type = ${gameType}
            AND (score > ${totalScore} OR (score = ${totalScore} AND time < ${gameDuration}))
        `;
        rank = parseInt(rankResult[0]?.rank ?? '1', 10);
        isTopFifty = rank <= 50;
        logger.info('[submit] Rank calculated:', rank);
        markStage('rankLookupMs', rankLookupStart);
      } catch (rankError) {
        // If rank query fails, we still return the score but with rank 0
        logger.error('[submit] Rank query error:', rankError);
        rank = 0;
        isTopFifty = false;
        markStage('rankLookupMs', rankLookupStart);
      }

      logger.info('[submit] Submission successful');
      return finish(
        successEnvelope({
          score: totalScore,
          rank,
          isTopFifty,
          rounds: validatedRounds,
        }),
        'success'
      );
    } catch (dbError) {
      markStage('transactionMs', transactionStart);
      const error = /** @type {Error & {code?: string}} */ (dbError);
      logger.error('[submit] Database operation failed:', error.message, error.code, error.stack);

      if (error.code === '23505') {
        const replay = await getReplayResult(sql, token);
        if (replay) {
          return finish(successEnvelope(replay, {}, { idempotentReplay: true }), 'success', {
            idempotentReplay: true,
          });
        }
      }

      // Handle database connection errors
      if (isDatabaseConnectionError(error)) {
        logger.error('[submit] Connection error detected');
        return finish(
          errorJson(
            'db_connection_error',
            'Database connection error. Please try again later.',
            503,
            {
              score: totalScore,
              rank: 0,
              isTopFifty: false,
              rounds: validatedRounds,
            }
          ),
          'failure',
          { stage: 'transaction' }
        );
      }

      logger.error('[submit] Generic database error');
      return finish(
        errorJson('db_error', 'Database error. Please try again later.', 500, {
          score: totalScore,
          rank: 0,
          isTopFifty: false,
          rounds: validatedRounds,
        }),
        'failure',
        { stage: 'transaction' }
      );
    }
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
