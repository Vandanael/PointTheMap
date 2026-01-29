// POST /.netlify/functions/submit

import { getDatabase } from "./db.js";
// Import shared game logic from lib (same functions used by client)
import { haversine, calculateScore } from "../../lib/game-math/index.js";
import { GAME, SCORING } from "../../src/config.js";

const MAX_SCORE_PER_ROUND = 5000;
const ROUNDS = 5;
const SESSION_EXPIRY_MS = 10 * 60 * 1000;
const RATE_LIMIT_PER_HOUR = 50;
const MIN_GAME_DURATION_MS = 5000;
const MAX_GAME_DURATION_MS = 10 * 60 * 1000;
const MAX_DISTANCE_KM = 20015;

/**
 * @param {any} data
 * @param {number} [status=200]
 * @returns {Response}
 */
const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const MIN_PLAUSIBLE_DURATION_MS = 15000;

/**
 * @param {number} gameDuration
 * @returns {{valid: boolean, reason?: string}}
 */
const checkPlausibility = (gameDuration) => {
  if (gameDuration < MIN_PLAUSIBLE_DURATION_MS || gameDuration > MAX_GAME_DURATION_MS) {
    return { valid: false, reason: "Session duration implausible" };
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
    const sql = getDatabase(context);
    const hourKey = `${ip}-${Math.floor(Date.now() / 3600000)}`;
    const expiresAt = new Date(Date.now() + 3600000);
    
    await sql`DELETE FROM rate_limits WHERE expires_at < NOW()`;
    
    const existing = await sql`
      SELECT count FROM rate_limits WHERE key = ${hourKey}
    `;
    
    if (existing.length > 0) {
      const count = existing[0].count;
      if (count >= RATE_LIMIT_PER_HOUR) {
        return { allowed: false, remaining: 0 };
      }
      await sql`
        UPDATE rate_limits 
        SET count = count + 1 
        WHERE key = ${hourKey}
      `;
      return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - count - 1 };
    } else {
      await sql`
        INSERT INTO rate_limits (key, count, expires_at)
        VALUES (${hourKey}, 1, ${expiresAt})
      `;
      return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - 1 };
    }
  } catch (e) {
    // On database errors, allow the request but log the error
    // This prevents rate limiting from blocking legitimate requests when DB is down
    if (process.env.NODE_ENV === "development") {
      const error = /** @type {Error & {code?: string}} */ (e);
      console.error("Rate limit error:", error.message, error.code);
    }
    // Allow request to proceed if rate limiting fails (fail open)
    return { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
  }
};

/**
 * @param {any[]} rounds
 * @param {any[]} sessionCapitals
 * @returns {{valid: boolean, error?: string}}
 */
const validateRounds = (rounds, sessionCapitals) => {
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) {
    return { valid: false, error: "Invalid rounds count" };
  }

  for (let i = 0; i < ROUNDS; i++) {
    const round = rounds[i];
    const expected = sessionCapitals[i];

    if (!round || !round.capital) {
      return { valid: false, error: `Missing round ${i + 1}` };
    }

    if (round.capital !== expected.name) {
      return { valid: false, error: `Capital mismatch at round ${i + 1}` };
    }

    if (round.click) {
      const { lat, lng } = round.click;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return { valid: false, error: `Invalid click at round ${i + 1}` };
      }
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
export default async (req, context) => {
  // Wrap entire function in try-catch to catch any unhandled errors
  try {
    console.log("[submit] Function invoked");

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    // Early database connection check
    let sql;
    try {
      sql = getDatabase(context);
      console.log("[submit] Database connection established");
    } catch (dbError) {
      const error = /** @type {Error} */ (dbError);
      console.error("[submit] Database connection failed:", error.message, error.stack);
      return jsonResponse(
        { error: "Database connection failed. Please try again later." },
        503
      );
    }

    const ip = context.ip || req.headers.get("x-forwarded-for") || "unknown";
    
    // Wrap rate limit check in try-catch
    let rateLimit;
    try {
      rateLimit = await checkRateLimit(ip, context);
    } catch (rateLimitError) {
      // If rate limiting fails, log but allow request to proceed
      console.error("Rate limit check failed:", rateLimitError);
      rateLimit = { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
    }
    
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Try again later." },
        429
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
    const { token, rounds, pseudo, gameType = "classic" } = body;
    const csrfToken = req.headers.get("x-csrf-token");

    console.log("[submit] Request details - Token:", token?.substring(0, 8), "CSRF from header:", csrfToken?.substring(0, 8));

    // Validate pseudo: 3-5 uppercase letters
    if (!pseudo || typeof pseudo !== "string") {
      return jsonResponse(
        { error: "Invalid pseudo (3-5 uppercase letters required)" },
        400
      );
    }
    const trimmedPseudo = pseudo.trim();
    if (trimmedPseudo.length < 3 || trimmedPseudo.length > 5 || !/^[A-Z]{3,5}$/.test(trimmedPseudo)) {
      return jsonResponse(
        { error: "Invalid pseudo (3-5 uppercase letters required)" },
        400
      );
    }

    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "Invalid token" }, 400);
    }

    let sessionResult;
    try {
      sessionResult = await sql`
        SELECT token, capitals, start_time, used, game_type, expires_at, csrf_token
        FROM sessions
        WHERE token = ${token}
          AND expires_at > NOW()
      `;
    } catch (dbError) {
      const error = /** @type {Error & {code?: string}} */ (dbError);
      console.error("Database query error (session lookup):", error.message, error.code);
      // Check if it's a connection error
      if (error.message?.includes("Failed to connect") || 
          error.message?.includes("connection") ||
          error.code === "ECONNREFUSED" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ENOTFOUND") {
        return jsonResponse(
          { error: "Database connection error. Please try again later." },
          503
        );
      }
      return jsonResponse(
        { error: "Database error. Please try again later." },
        500
      );
    }

    if (sessionResult.length === 0) {
      return jsonResponse({ error: "Session not found or expired" }, 401);
    }

    const sessionRow = sessionResult[0];
    const session = {
      token: sessionRow.token,
      capitals: sessionRow.capitals,
      startTime: parseInt(sessionRow.start_time, 10),
      used: sessionRow.used,
      gameType: sessionRow.game_type,
      csrfToken: sessionRow.csrf_token,
    };

    // CSRF token validation
    console.log("[submit] CSRF validation:");
    console.log("  - Expected (from DB):", session.csrfToken?.substring(0, 16) + "...");
    console.log("  - Received (header):", csrfToken?.substring(0, 16) + "...");
    console.log("  - Match:", session.csrfToken === csrfToken);
    console.log("  - Types:", typeof session.csrfToken, typeof csrfToken);

    if (session.csrfToken && session.csrfToken !== csrfToken) {
      console.log("[submit] CSRF token mismatch! Returning 403");
      return jsonResponse({
        error: "Invalid CSRF token",
        debug: {
          expectedPrefix: session.csrfToken?.substring(0, 8),
          receivedPrefix: csrfToken?.substring(0, 8),
          receivedIsNull: csrfToken === null,
          receivedIsUndefined: csrfToken === undefined
        }
      }, 403);
    }
    console.log("[submit] CSRF token validated successfully");

    if (session.used) {
      return jsonResponse({ error: "Session already used" }, 401);
    }

    if (session.gameType && session.gameType !== gameType) {
      return jsonResponse({ error: "Game type mismatch" }, 400);
    }

    const now = Date.now();
    
    if (session.startTime > now) {
      return jsonResponse({ error: "Invalid session timestamp" }, 400);
    }
    
    const gameDuration = now - session.startTime;
    
    if (gameDuration < 0) {
      return jsonResponse({ error: "Invalid game duration" }, 400);
    }

    if (gameDuration > SESSION_EXPIRY_MS) {
      await sql`DELETE FROM sessions WHERE token = ${token}`;
      return jsonResponse({ error: "Session expired" }, 401);
    }

    if (gameDuration < MIN_GAME_DURATION_MS) {
      return jsonResponse({ error: "Suspicious activity: too fast" }, 400);
    }

    const validation = validateRounds(rounds, session.capitals);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    const plausibility = checkPlausibility(gameDuration);
    if (!plausibility.valid) {
      return jsonResponse({ error: plausibility.reason }, 400);
    }

    /**
     * @param {any} round
     * @param {number} i
     * @returns {any}
     */
    const validateRound = (round, i) => {
      const serverCapital = session.capitals[i];
      const capitalCoords = /** @type {[number, number]} */ ([serverCapital.lat, serverCapital.lng]);

      if (!round.click) {
        return {
          capital: round.capital,
          click: null,
          distance: null,
          score: 0,
          status: "timeout",
        };
      }

      const clickCoords = /** @type {[number, number]} */ ([round.click.lat, round.click.lng]);
      const distance = haversine(clickCoords, capitalCoords);

      if (distance > MAX_DISTANCE_KM) {
        return {
          capital: round.capital,
          click: round.click,
          distance: MAX_DISTANCE_KM,
          score: 0,
          status: "invalid",
        };
      }

      const baseScore = calculateScore(distance);

      // Calculate time bonus (if applicable for this game mode)
      let timeBonus = 0;
      if (round.timeElapsed && session.gameType === 'daily' && SCORING.ENABLE_TIME_BONUS) {
        const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
        const timeRemaining = totalTimeAllowed - round.timeElapsed;
        const config = SCORING.TIME_BONUS_BY_MODE.daily;

        if (config.enabled && distance < config.distanceThreshold && timeRemaining > 0) {
          const timeRatio = timeRemaining / totalTimeAllowed;
          const bonusPercent = timeRatio * config.maxBonusPercent;
          timeBonus = Math.min(
            Math.round(baseScore * bonusPercent),
            config.maxBonus
          );
        }
      }

      const totalScore = baseScore + timeBonus;

      // Validate client score matches server calculation (±1 point tolerance for rounding)
      if (round.score && Math.abs(round.score - totalScore) > 1) {
        console.warn(`[submit] Score mismatch: client=${round.score}, server=${totalScore} (base=${Math.round(baseScore)}, bonus=${timeBonus})`);
        // Use server score for anti-cheat
      }

      return {
        capital: round.capital,
        click: round.click,
        distance: Math.round(distance),
        score: Math.round(totalScore),
        status: "completed",
      };
    };

    const validatedRounds = rounds.map(validateRound);

    const totalScore = validatedRounds.reduce((/** @type {number} */ sum, /** @type {any} */ r) => sum + r.score, 0);
    const clientIp = ip.split(",")[0].trim();

    if (clientIp === "unknown") {
      return jsonResponse(
        { error: "Unable to verify player identity" },
        400
      );
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
      console.error("Database query error (pseudo check):", error.message, error.code);
      if (error.message?.includes("Failed to connect") || 
          error.message?.includes("connection") ||
          error.code === "ECONNREFUSED" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ENOTFOUND") {
        return jsonResponse(
          { error: "Database connection error. Please try again later." },
          503
        );
      }
      return jsonResponse(
        { error: "Database error. Please try again later." },
        500
      );
    }

    let existingPseudo = null;
    if (existingPseudoResult.length > 0) {
      existingPseudo = existingPseudoResult[0].pseudo;
      if (existingPseudo !== pseudo) {
        return jsonResponse(
          {
            error: "pseudo_already_set_for_this_ip",
            pseudo: existingPseudo,
          },
          409
        );
      }
    }

    let rank = 1;
    let isTopFifty = false;
    
    try {
      console.log("[submit] Starting database transaction");

      // Neon SQL doesn't support transactions, run operations sequentially
      // Mark session as used first to prevent double submission
      await sql`UPDATE sessions SET used = true WHERE token = ${token}`;
      console.log("[submit] Session marked as used");

      // Double-check pseudo hasn't changed
      const doubleCheckResult = await sql`
        SELECT pseudo
        FROM scores
        WHERE ip = ${clientIp}
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      if (doubleCheckResult.length > 0 && doubleCheckResult[0].pseudo !== pseudo) {
        console.log("[submit] Pseudo mismatch detected");
        await sql`UPDATE sessions SET used = false WHERE token = ${token}`;
        return jsonResponse(
          {
            error: "pseudo_already_set_for_this_ip",
            pseudo: doubleCheckResult[0].pseudo,
          },
          409
        );
      }

      // Insert score
      await sql`
        INSERT INTO scores (pseudo, score, time, rounds, timestamp, game_type, ip)
        VALUES (${pseudo}, ${totalScore}, ${gameDuration}, ${JSON.stringify(validatedRounds)}::jsonb, ${now}, ${gameType}, ${clientIp})
      `;
      console.log("[submit] Score inserted");

      // Clean up session
      await sql`DELETE FROM sessions WHERE token = ${token}`;
      console.log("[submit] Session deleted")

      let rankResult;
      try {
        console.log("[submit] Calculating rank");
        rankResult = await sql`
          SELECT COUNT(*) + 1 as rank
          FROM scores
          WHERE game_type = ${gameType}
            AND (score > ${totalScore} OR (score = ${totalScore} AND time < ${gameDuration}))
        `;
        rank = parseInt(rankResult[0]?.rank || "1", 10);
        isTopFifty = rank <= 50;
        console.log("[submit] Rank calculated:", rank);
      } catch (rankError) {
        // If rank query fails, we still return the score but with rank 0
        console.error("[submit] Rank query error:", rankError);
        rank = 0;
        isTopFifty = false;
      }

      console.log("[submit] Submission successful");
      return jsonResponse({
        score: totalScore,
        rank,
        isTopFifty,
        rounds: validatedRounds,
      });
    } catch (dbError) {
      const error = /** @type {Error & {code?: string}} */ (dbError);
      console.error("[submit] Database operation failed:", error.message, error.code, error.stack);

      // Handle database connection errors
      if (error.message?.includes("Failed to connect") ||
          error.message?.includes("connection") ||
          error.message?.includes("timeout") ||
          error.code === "ECONNREFUSED" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ENOTFOUND") {
        console.error("[submit] Connection error detected");
        return jsonResponse({
          error: "Database connection error. Please try again later.",
          score: totalScore,
          rank: 0,
          isTopFifty: false,
          rounds: validatedRounds,
        }, 503);
      }

      console.error("[submit] Generic database error");
      return jsonResponse({
        error: "Database error. Please try again later.",
        score: totalScore,
        rank: 0,
        isTopFifty: false,
        rounds: validatedRounds,
      }, 500);
    }
  } catch (outerError) {
    // Catch any unhandled errors that might cause 502
    const error = /** @type {Error & {code?: string}} */ (outerError);
    console.error("[submit] Unhandled error caught:", error.message, error.code, error.stack);

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      console.error("[submit] JSON parsing error");
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    // Check if it's a database connection error
    if (error.message?.includes("Failed to connect") ||
        error.message?.includes("connection") ||
        error.message?.includes("timeout") ||
        error.code === "ECONNREFUSED" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND") {
      console.error("[submit] Connection error in outer catch");
      return jsonResponse(
        { error: "Database connection error. Please try again later." },
        503
      );
    }

    // Log full error details
    console.error("[submit] Generic error - full details:", JSON.stringify({
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    }));

    // Generic error response - ALWAYS return a response to prevent 502
    return jsonResponse(
      { error: "Internal server error. Please try again later." },
      500
    );
  }
};
