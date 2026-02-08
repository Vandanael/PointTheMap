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
// Import shared game logic from lib (same functions used by client)
import { haversine, calculateScore } from '../../lib/game-math/index.js';
import {
  pointInPolygon,
  distanceToPolygonBorder,
  calculateCountryScore,
} from '../../lib/geo-utils/index.js';
import { getCountryFeature, getCivilizationFeature } from './_geo-data.js';
import { GAME, API } from '../../lib/config/index.js';
import { getTimeBonusConfig } from '../../lib/config/game-modes.js';
import { toDomainModel } from '../../src/lib/session/sessionModel.js';
import { SubmitSchema } from '../../lib/schemas/submit.js';

const logger = createLogger('submit');

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

const DB_BREAKER_WINDOW_MS = 60 * 1000;
const DB_BREAKER_COOLDOWN_MS = 60 * 1000;
const DB_BREAKER_THRESHOLD = 3;
const SUPPORTED_PAYLOAD_VERSIONS = new Set([1]);

/** @type {number[]} */
let dbFailureTimestamps = [];
let dbBreakerUntil = 0;

const fallbackRateLimits = new Map();
const FALLBACK_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/** @param {unknown} error */
const recordDbFailure = (error) => {
  if (!isDatabaseConnectionError(error)) return;
  const now = Date.now();
  dbFailureTimestamps = dbFailureTimestamps.filter((ts) => now - ts <= DB_BREAKER_WINDOW_MS);
  dbFailureTimestamps.push(now);
  if (dbFailureTimestamps.length >= DB_BREAKER_THRESHOLD) {
    dbBreakerUntil = now + DB_BREAKER_COOLDOWN_MS;
  }
};

const isDbBreakerOpen = () => Date.now() < dbBreakerUntil;

/** @param {string} ip */
const checkFallbackRateLimit = (ip) => {
  const now = Date.now();
  const entry = fallbackRateLimits.get(ip);
  if (!entry || now > entry.expiresAt) {
    const expiresAt = now + FALLBACK_RATE_LIMIT_WINDOW_MS;
    fallbackRateLimits.set(ip, { count: 1, expiresAt });
    return { allowed: true, remaining: API.RATE_LIMIT_PER_HOUR - 1 };
  }
  if (entry.count >= API.RATE_LIMIT_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: API.RATE_LIMIT_PER_HOUR - entry.count };
};

/**
 * @param {number} gameDuration
 * @returns {{valid: boolean, reason?: string}}
 */
const checkPlausibility = (gameDuration) => {
  if (gameDuration < API.MIN_PLAUSIBLE_DURATION_MS || gameDuration > API.MAX_GAME_DURATION_MS) {
    return { valid: false, reason: 'Session duration implausible' };
  }
  return { valid: true };
};

/**
 * @param {string} ip
 * @param {any} context
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
const checkRateLimit = async (ip, context) => {
  try {
    const sql = context.sql;
    const hourKey = `${ip}-${Math.floor(Date.now() / 3600000)}`;
    const expiresAt = new Date(Date.now() + 3600000);

    await sql`DELETE FROM rate_limits WHERE expires_at < NOW()`;

    const existing = await sql`
      SELECT count FROM rate_limits WHERE key = ${hourKey}
    `;

    if (existing.length > 0) {
      const count = existing[0].count;
      if (count >= API.RATE_LIMIT_PER_HOUR) {
        return { allowed: false, remaining: 0 };
      }
      await sql`
        UPDATE rate_limits
        SET count = count + 1
        WHERE key = ${hourKey}
      `;
      return { allowed: true, remaining: API.RATE_LIMIT_PER_HOUR - count - 1 };
    } else {
      await sql`
        INSERT INTO rate_limits (key, count, expires_at)
        VALUES (${hourKey}, 1, ${expiresAt})
      `;
      return { allowed: true, remaining: API.RATE_LIMIT_PER_HOUR - 1 };
    }
  } catch (e) {
    recordDbFailure(e);
    if (process.env.NODE_ENV === 'development') {
      const error = /** @type {Error & {code?: string}} */ (e);
      logger.error('Rate limit error:', error.message, error.code);
    }
    // Fallback to in-memory limiter when DB is unavailable
    return checkFallbackRateLimit(ip);
  }
};

/**
 * Validate submitted rounds against session targets.
 * @param {any[]} rounds - Submitted rounds
 * @param {any[]} sessionTargets - Session targets (capitals, countries, stadiums, or civilizations)
 * @param {string} gameType - Game mode identifier
 * @returns {{valid: boolean, error?: string}}
 */
const validateRounds = (rounds, sessionTargets, gameType) => {
  if (!Array.isArray(rounds) || rounds.length !== GAME.ROUNDS) {
    return { valid: false, error: 'Invalid rounds count' };
  }

  const isCountryMode = gameType === 'country' || gameType === 'country_daily';
  const isCivilizationMode = gameType === 'civilization' || gameType === 'civilization_daily';
  const isStadiumMode = gameType === 'stadium' || gameType === 'stadium_daily';

  for (let i = 0; i < GAME.ROUNDS; i++) {
    const round = rounds[i];
    const expected = sessionTargets[i];

    const targetField = isCountryMode
      ? round.country
      : isCivilizationMode
        ? round.civilization
        : isStadiumMode
          ? round.stadium
          : round.capital;

    if (!round || !targetField) {
      return { valid: false, error: `Missing round ${i + 1}` };
    }

    const expectedName =
      typeof expected === 'object' && expected !== null && 'name' in expected
        ? expected.name
        : expected;
    if (targetField !== expectedName) {
      return {
        valid: false,
        error: `${isCountryMode ? 'Country' : isCivilizationMode ? 'Civilization' : isStadiumMode ? 'Stadium' : 'Capital'} mismatch at round ${i + 1}`,
      };
    }

    // Per-round time validation - detect suspiciously fast submissions
    if (round.timeElapsed !== undefined && round.timeElapsed !== null) {
      if (typeof round.timeElapsed !== 'number' || !Number.isFinite(round.timeElapsed)) {
        return { valid: false, error: `Invalid time at round ${i + 1}` };
      }
      if (round.timeElapsed < API.MIN_ROUND_TIME_MS) {
        return {
          valid: false,
          error: `Round ${i + 1} completed too fast (${round.timeElapsed}ms)`,
        };
      }
      if (round.timeElapsed > GAME.TIMER_MS + GAME.GRACE_PERIOD_MS + 1000) {
        return {
          valid: false,
          error: `Round ${i + 1} time exceeds maximum (${round.timeElapsed}ms)`,
        };
      }
    }

    if (round.click) {
      const { lat, lng } = round.click;

      // Type and finiteness validation
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { valid: false, error: `Invalid click coordinates at round ${i + 1}` };
      }

      // Check for NaN, Infinity, -Infinity
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { valid: false, error: `Invalid coordinate values at round ${i + 1}` };
      }

      // Geographic bounds validation
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: `Click out of bounds at round ${i + 1}` };
      }
    }
  }

  return { valid: true };
};

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

    if (isDbBreakerOpen()) {
      const retryAfterSeconds = Math.ceil((dbBreakerUntil - Date.now()) / 1000);
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

    // Wrap rate limit check in try-catch
    let rateLimit;
    try {
      rateLimit = await checkRateLimit(ip, context);
    } catch (rateLimitError) {
      // If rate limiting fails, log but allow request to proceed
      logger.error('Rate limit check failed:', rateLimitError);
      rateLimit = checkFallbackRateLimit(ip);
    }

    if (!rateLimit.allowed) {
      return errorJson('rate_limited', 'Rate limit exceeded. Try again later.', 429);
    }
    logger.info('[submit] rate limit ok, remaining:', rateLimit.remaining);

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

    if (gameDuration < API.MIN_GAME_DURATION_MS) {
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

    const plausibility = checkPlausibility(gameDuration);
    if (!plausibility.valid) {
      return errorJson(
        'implausible_duration',
        plausibility.reason || 'Session duration implausible',
        400
      );
    }

    /**
     * @param {any} round
     * @param {number} i
     * @returns {any}
     */
    const validateRound = (round, i) => {
      const isCountryMode = session.gameType === 'country' || session.gameType === 'country_daily';
      const isCivilizationMode =
        session.gameType === 'civilization' || session.gameType === 'civilization_daily';
      const serverTarget = /** @type {any} */ (session.targets[i]); // Generic session targets (semantically correct)

      // Country mode: server-side GeoJSON validation
      if (isCountryMode) {
        if (!round.click) {
          return {
            country: round.country,
            countryId: round.countryId,
            click: null,
            distance: null,
            score: 0,
            status: 'timeout',
          };
        }

        const targetCountryId = serverTarget?.countryId ?? '';
        const targetFeature = targetCountryId
          ? /** @type {any} */ (getCountryFeature(targetCountryId))
          : undefined;
        let serverScore;
        let distance;

        if (targetFeature) {
          const isInside = pointInPolygon(
            { coordinates: [round.click.lng, round.click.lat] },
            targetFeature.geometry
          );
          distance = isInside
            ? 0
            : distanceToPolygonBorder([round.click.lat, round.click.lng], targetFeature.geometry);
          serverScore = calculateCountryScore(distance);

          // Apply time bonus if enabled for this mode
          const modeKey = session.gameType ?? 'classic';
          const modeConfig = getTimeBonusConfig(modeKey);
          if (
            round.timeElapsed &&
            modeConfig?.enabled &&
            modeConfig.distanceThreshold !== null &&
            modeConfig.distanceThreshold !== undefined &&
            modeConfig.maxBonusPercent !== null &&
            modeConfig.maxBonusPercent !== undefined &&
            modeConfig.maxBonus !== null &&
            modeConfig.maxBonus !== undefined
          ) {
            const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
            const timeRemaining = totalTimeAllowed - round.timeElapsed;
            if (distance < modeConfig.distanceThreshold && timeRemaining > 0) {
              const timeRatio = timeRemaining / totalTimeAllowed;
              const bonusPercent = timeRatio * modeConfig.maxBonusPercent;
              serverScore += Math.min(Math.round(serverScore * bonusPercent), modeConfig.maxBonus);
            }
          }

          if (round.score && Math.abs(round.score - serverScore) > 100) {
            logger.warn(
              `[submit] Country score mismatch: client=${round.score}, server=${serverScore}`
            );
          }
        } else {
          // If server cannot validate, do NOT trust client score.
          logger.error('[submit] Missing country GeoJSON feature:', targetCountryId);
          distance = null;
          serverScore = 0;
        }

        const safeDistance =
          typeof distance === 'number' && Number.isFinite(distance) ? Math.round(distance) : null;
        return {
          country: round.country,
          countryId: round.countryId,
          correctCountryId: serverTarget.countryId,
          clickedCountryId: round.clickedCountryId,
          click: round.click,
          distance: safeDistance,
          score: serverScore,
          status: targetFeature ? 'completed' : 'invalid',
        };
      }

      // Civilization mode: server-side GeoJSON validation
      if (isCivilizationMode) {
        if (!round.click) {
          return {
            civilization: round.civilization,
            civilizationId: round.civilizationId,
            click: null,
            distance: null,
            score: 0,
            status: 'timeout',
          };
        }

        const targetCivilizationId = serverTarget?.id ?? '';
        const targetFeature = targetCivilizationId
          ? /** @type {any} */ (getCivilizationFeature(targetCivilizationId))
          : undefined;
        let serverScore;
        let distance;

        if (targetFeature) {
          const isInside = pointInPolygon(
            { coordinates: [round.click.lng, round.click.lat] },
            targetFeature.geometry
          );
          distance = isInside
            ? 0
            : distanceToPolygonBorder([round.click.lat, round.click.lng], targetFeature.geometry);
          serverScore = calculateCountryScore(distance);

          // Apply time bonus if enabled for this mode
          const modeKey = session.gameType ?? 'classic';
          const modeConfig = getTimeBonusConfig(modeKey);
          if (
            round.timeElapsed &&
            modeConfig?.enabled &&
            modeConfig.distanceThreshold !== null &&
            modeConfig.distanceThreshold !== undefined &&
            modeConfig.maxBonusPercent !== null &&
            modeConfig.maxBonusPercent !== undefined &&
            modeConfig.maxBonus !== null &&
            modeConfig.maxBonus !== undefined
          ) {
            const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
            const timeRemaining = totalTimeAllowed - round.timeElapsed;
            if (distance < modeConfig.distanceThreshold && timeRemaining > 0) {
              const timeRatio = timeRemaining / totalTimeAllowed;
              const bonusPercent = timeRatio * modeConfig.maxBonusPercent;
              serverScore += Math.min(Math.round(serverScore * bonusPercent), modeConfig.maxBonus);
            }
          }

          if (round.score && Math.abs(round.score - serverScore) > 100) {
            logger.warn(
              `[submit] Civilization score mismatch: client=${round.score}, server=${serverScore}`
            );
          }
        } else {
          // If server cannot validate, do NOT trust client score.
          logger.error('[submit] Missing civilization GeoJSON feature:', targetCivilizationId);
          distance = null;
          serverScore = 0;
        }

        const safeDistance =
          typeof distance === 'number' && Number.isFinite(distance) ? Math.round(distance) : null;
        return {
          civilization: round.civilization,
          civilizationId: round.civilizationId,
          correctCivilizationId: serverTarget.id,
          clickedCivilizationId: round.clickedCivilizationId,
          click: round.click,
          distance: safeDistance,
          score: serverScore,
          status: targetFeature ? 'completed' : 'invalid',
        };
      }

      // Stadium mode: server-side validation (has lat/lng like capitals)
      if (session.gameType === 'stadium' || session.gameType === 'stadium_daily') {
        const stadiumCoords = /** @type {[number, number]} */ ([
          serverTarget.lat ?? 0,
          serverTarget.lng ?? 0,
        ]);

        if (!round.click) {
          return {
            stadium: round.stadium,
            click: null,
            distance: null,
            score: 0,
            status: 'timeout',
          };
        }

        const clickCoords = /** @type {[number, number]} */ ([round.click.lat, round.click.lng]);
        const distance = haversine(clickCoords, stadiumCoords);

        if (distance > API.MAX_DISTANCE_KM) {
          return {
            stadium: round.stadium,
            click: round.click,
            distance: API.MAX_DISTANCE_KM,
            score: 0,
            status: 'invalid',
          };
        }

        const score = calculateScore(distance);
        if (round.score && Math.abs(round.score - score) > 1) {
          logger.warn(
            `[submit] Stadium score mismatch: client=${round.score}, server=${Math.round(score)}`
          );
        }

        return {
          stadium: round.stadium,
          click: round.click,
          distance: Math.round(distance),
          score: Math.round(score),
          status: 'completed',
        };
      }

      // Capital mode: validate server-side
      const capitalCoords = /** @type {[number, number]} */ ([serverTarget.lat, serverTarget.lng]);

      if (!round.click) {
        return {
          capital: round.capital,
          click: null,
          distance: null,
          score: 0,
          status: 'timeout',
        };
      }

      const clickCoords = /** @type {[number, number]} */ ([round.click.lat, round.click.lng]);
      const distance = haversine(clickCoords, capitalCoords);

      if (distance > API.MAX_DISTANCE_KM) {
        return {
          capital: round.capital,
          click: round.click,
          distance: API.MAX_DISTANCE_KM,
          score: 0,
          status: 'invalid',
        };
      }

      const baseScore = calculateScore(distance);

      // Calculate time bonus (if applicable for this game mode)
      let timeBonus = 0;
      const modeKey = session.gameType ?? 'classic';
      const timeBonusConfig = getTimeBonusConfig(modeKey);
      if (
        round.timeElapsed &&
        timeBonusConfig?.enabled &&
        timeBonusConfig.distanceThreshold !== null &&
        timeBonusConfig.distanceThreshold !== undefined &&
        timeBonusConfig.maxBonusPercent !== null &&
        timeBonusConfig.maxBonusPercent !== undefined &&
        timeBonusConfig.maxBonus !== null &&
        timeBonusConfig.maxBonus !== undefined
      ) {
        const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
        const timeRemaining = totalTimeAllowed - round.timeElapsed;
        const config = timeBonusConfig;

        if (config.enabled && distance < config.distanceThreshold && timeRemaining > 0) {
          const timeRatio = timeRemaining / totalTimeAllowed;
          const bonusPercent = timeRatio * config.maxBonusPercent;
          timeBonus = Math.min(Math.round(baseScore * bonusPercent), config.maxBonus);
        }
      }

      const totalScore = baseScore + timeBonus;

      // Validate client score matches server calculation (±1 point tolerance for rounding)
      if (round.score && Math.abs(round.score - totalScore) > 1) {
        logger.warn(
          `[submit] Score mismatch: client=${round.score}, server=${totalScore} (base=${Math.round(baseScore)}, bonus=${timeBonus})`
        );
        // Use server score for anti-cheat
      }

      return {
        capital: round.capital,
        click: round.click,
        distance: Math.round(distance),
        score: Math.round(totalScore),
        status: 'completed',
      };
    };

    const validatedRounds = rounds.map(validateRound);

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
        INSERT INTO scores (pseudo, score, time, rounds, timestamp, game_type, ip, player_id)
        VALUES (${trimmedPseudo}, ${totalScore}, ${gameDuration}, ${JSON.stringify(validatedRounds)}::jsonb, ${now}, ${gameType}, ${clientIp}, ${session.playerId})
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
