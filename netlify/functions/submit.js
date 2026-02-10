// POST /.netlify/functions/submit
// Flat handler (no compose) to avoid "w is not a function" after esbuild minification

import { getDatabase } from './db.js';
import {
  jsonResponse,
  successResponse,
  parseJsonBody,
  getClientIp,
  isDatabaseConnectionError,
  createLogger,
} from './_utils.js';
import { API } from '../../lib/config/index.js';
import { toDomainModel } from '../../src/lib/session/sessionModel.js';
import { SubmitSchema } from '../../lib/schemas/submit.js';
import { recordDbFailure, isDbBreakerOpen, getDbBreakerUntil } from './_circuit-breaker.js';
import { createFallbackRateLimiter, checkDbRateLimit } from './_rate-limit.js';
import { checkPlausibility, validateRounds } from './_round-validation.js';
import { scoreRound } from './_round-scoring.js';

const logger = createLogger('submit');
const E2E_BYPASS_ENABLED = process.env.E2E_BYPASS_ENABLED === '1';
const E2E_BYPASS_TOKEN = process.env.E2E_BYPASS_TOKEN;

const isE2EBypass = (req) => {
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
  jsonResponse({ ok: false, error: { code, message, details } }, status, headers);

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
    if (req.method !== 'POST') {
      return errorJson('method_not_allowed', 'Method not allowed', 405);
    }

    const bypass = isE2EBypass(req);

    if (isDbBreakerOpen()) {
      const retryAfterSeconds = Math.ceil((getDbBreakerUntil() - Date.now()) / 1000);
      return errorJson(
        'service_unavailable',
        'Service temporarily unavailable. Please retry.',
        503,
        { retryAfter: retryAfterSeconds },
        { 'Retry-After': String(retryAfterSeconds) }
      );
    }

    let sql;
    try {
      sql = getDatabase(context);
    } catch (dbError) {
      const error = /** @type {Error} */ (dbError);
      logger.error('Database connection failed:', error.message);
      recordDbFailure(dbError);
      return errorJson(
        'db_connection_failed',
        'Database connection failed. Please try again later.',
        503
      );
    }
    context.sql = sql;

    logger.info('[submit] Function invoked');

    const ip = getClientIp(req, context);

    if (!bypass) {
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

      if (!rateLimit.allowed) {
        return errorJson('rate_limited', 'Rate limit exceeded. Try again later.', 429);
      }
      logger.info('[submit] rate limit ok, remaining:', rateLimit.remaining);
    } else {
      logger.info('[submit] e2e bypass enabled: skipping rate limit');
    }

    const body = await parseJsonBody(req);
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) {
      return errorJson('invalid_payload', 'Invalid payload', 400, parsed.error.flatten());
    }
    const { token, rounds, pseudo, gameType = 'classic', payloadVersion } = parsed.data;
    const effectivePayloadVersion = payloadVersion ?? 1;
    if (!SUPPORTED_PAYLOAD_VERSIONS.has(effectivePayloadVersion)) {
      return errorJson(
        'unsupported_payload_version',
        `Unsupported payload version (${effectivePayloadVersion})`,
        400
      );
    }
    const csrfToken = req.headers.get('x-csrf-token');

    logger.info(
      '[submit] Request details - Token:',
      token?.substring(0, 8),
      'CSRF from header:',
      csrfToken?.substring(0, 8),
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
      return errorJson('invalid_pseudo', 'Invalid pseudo (3-5 uppercase letters required)', 400);
    }

    let sessionResult;
    try {
      sessionResult = await sql`
        SELECT token, targets, start_time, used, game_type, expires_at, csrf_token, player_id
        FROM sessions
        WHERE token = ${token}
          AND expires_at > NOW()
      `;
    } catch (dbError) {
      const error = /** @type {Error & {code?: string}} */ (dbError);
      logger.error('Database query error (session lookup):', error.message, error.code);
      return errorJson(
        isDatabaseConnectionError(error) ? 'db_connection_error' : 'db_error',
        'Database error. Please try again later.',
        isDatabaseConnectionError(error) ? 503 : 500
      );
    }

    if (sessionResult.length === 0) {
      return errorJson('session_not_found', 'Session not found or expired', 401);
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
      return errorJson('csrf_mismatch', 'Invalid CSRF token', 403);
    }

    if (session.used) {
      return errorJson('session_used', 'Session already used', 401);
    }

    if (session.gameType && session.gameType !== gameType) {
      return errorJson('game_type_mismatch', 'Game type mismatch', 400);
    }

    const now = Date.now();

    if (session.startTime > now) {
      return errorJson('invalid_session_timestamp', 'Invalid session timestamp', 400);
    }

    const gameDuration = now - session.startTime;

    if (gameDuration < 0) {
      return errorJson('invalid_game_duration', 'Invalid game duration', 400);
    }

    if (gameDuration > API.SESSION_EXPIRY_MS) {
      await sql`DELETE FROM sessions WHERE token = ${token}`;
      return errorJson('session_expired', 'Session expired', 401);
    }

    if (!bypass && gameDuration < API.MIN_GAME_DURATION_MS) {
      return errorJson('suspicious_fast', 'Suspicious activity: too fast', 400);
    }

    // Aggregate round timing sanity check (prevents impossible time bonuses)
    const timeElapsedValues = rounds
      .map((round) => round?.timeElapsed)
      .filter((value) => typeof value === 'number' && Number.isFinite(value));
    if (timeElapsedValues.length === rounds.length) {
      const totalElapsed = timeElapsedValues.reduce((sum, value) => sum + value, 0);
      if (totalElapsed > gameDuration + 1000) {
        return errorJson('invalid_round_times', 'Round timings exceed total game duration', 400, {
          totalElapsed,
          gameDuration,
        });
      }
    }

    const validation = validateRounds(rounds, session.targets, session.gameType || 'classic');
    if (!validation.valid) {
      return errorJson('invalid_rounds', validation.error || 'Invalid rounds', 400);
    }

    if (!bypass) {
      const plausibility = checkPlausibility(gameDuration);
      if (!plausibility.valid) {
        return errorJson(
          'implausible_duration',
          plausibility.reason || 'Session duration implausible',
          400
        );
      }
    }

    const validatedRounds = rounds.map((round, i) => scoreRound(round, i, session));

    const totalScore = validatedRounds.reduce(
      (/** @type {number} */ sum, /** @type {any} */ r) => sum + r.score,
      0
    );
    const clientIp = getClientIp(req, context);

    if (clientIp === 'unknown') {
      return errorJson('client_ip_unknown', 'Unable to verify player identity', 400);
    }

    let existingPseudoResult;
    try {
      existingPseudoResult = await sql`
        SELECT pseudo
        FROM scores
        WHERE ip = ${clientIp}
        ORDER BY timestamp DESC
        LIMIT 1
      `;
    } catch (dbError) {
      const error = /** @type {Error & {code?: string}} */ (dbError);
      logger.error('Database query error (pseudo check):', error.message, error.code);
      return errorJson(
        isDatabaseConnectionError(error) ? 'db_connection_error' : 'db_error',
        'Database error. Please try again later.',
        isDatabaseConnectionError(error) ? 503 : 500
      );
    }

    let existingPseudo = null;
    if (existingPseudoResult.length > 0) {
      const first = existingPseudoResult[0];
      if (first) existingPseudo = first.pseudo;
      if (existingPseudo !== trimmedPseudo) {
        return errorJson('pseudo_already_set_for_this_ip', 'Pseudo already set for this IP', 409, {
          pseudo: existingPseudo,
        });
      }
    }

    let rank = 1;
    let isTopFifty = false;

    try {
      logger.info('[submit] Starting database transaction');

      // Double-check pseudo hasn't changed (authoritative check before marking session)
      const doubleCheckResult = await sql`
        SELECT pseudo
        FROM scores
        WHERE ip = ${clientIp}
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const doubleCheckRow = doubleCheckResult[0];
      if (doubleCheckRow && doubleCheckRow.pseudo !== trimmedPseudo) {
        logger.info('[submit] Pseudo mismatch detected');
        return errorJson('pseudo_already_set_for_this_ip', 'Pseudo already set for this IP', 409, {
          pseudo: doubleCheckRow.pseudo,
        });
      }

      // Mark session as used (after pseudo check passes, before score insert)
      await sql`UPDATE sessions SET used = true WHERE token = ${token}`;
      logger.info('[submit] Session marked as used');

      // Insert score
      await sql`
        INSERT INTO scores (pseudo, score, time, rounds, timestamp, game_type, session_token, ip, player_id)
        VALUES (${trimmedPseudo}, ${totalScore}, ${gameDuration}, ${JSON.stringify(validatedRounds)}::jsonb, ${now}, ${gameType}, ${token}, ${clientIp}, ${session.playerId})
      `;
      logger.info('[submit] Score inserted');

      // Update player stats
      if (session.playerId) {
        await sql`
          UPDATE players
          SET total_games = total_games + 1,
              total_score = total_score + ${totalScore}
          WHERE player_id = ${session.playerId}
        `;
        logger.info('[submit] Player stats updated');
      }

      // Clean up session
      await sql`DELETE FROM sessions WHERE token = ${token}`;
      logger.info('[submit] Session deleted');

      let rankResult;
      try {
        logger.info('[submit] Calculating rank');
        rankResult = await sql`
          SELECT COUNT(*) + 1 as rank
          FROM scores
          WHERE game_type = ${gameType}
            AND (score > ${totalScore} OR (score = ${totalScore} AND time < ${gameDuration}))
        `;
        rank = parseInt(rankResult[0]?.rank || '1', 10);
        isTopFifty = rank <= 50;
        logger.info('[submit] Rank calculated:', rank);
      } catch (rankError) {
        // If rank query fails, we still return the score but with rank 0
        logger.error('[submit] Rank query error:', rankError);
        rank = 0;
        isTopFifty = false;
      }

      logger.info('[submit] Submission successful');
      return successResponse({
        score: totalScore,
        rank,
        isTopFifty,
        rounds: validatedRounds,
      });
    } catch (dbError) {
      const error = /** @type {Error & {code?: string}} */ (dbError);
      logger.error('[submit] Database operation failed:', error.message, error.code, error.stack);

      // Handle database connection errors
      if (isDatabaseConnectionError(error)) {
        logger.error('[submit] Connection error detected');
        return errorJson(
          'db_connection_error',
          'Database connection error. Please try again later.',
          503,
          {
            score: totalScore,
            rank: 0,
            isTopFifty: false,
            rounds: validatedRounds,
          }
        );
      }

      logger.error('[submit] Generic database error');
      return errorJson('db_error', 'Database error. Please try again later.', 500, {
        score: totalScore,
        rank: 0,
        isTopFifty: false,
        rounds: validatedRounds,
      });
    }
  } catch (outerError) {
    // Catch any unhandled errors that might cause 502
    const error = /** @type {Error & {code?: string}} */ (outerError);
    logger.error('[submit] Unhandled error caught:', error.message, error.code, error.stack);

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
