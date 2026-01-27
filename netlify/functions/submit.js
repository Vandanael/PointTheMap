// POST /.netlify/functions/submit

import { getDatabase } from "./db.js";
// Import shared game logic from lib (same functions used by client)
import { haversine, calculateScore } from "../../lib/game-math/index.js";

const MAX_SCORE_PER_ROUND = 5000;
const ROUNDS = 5;
const SESSION_EXPIRY_MS = 10 * 60 * 1000;
const RATE_LIMIT_PER_HOUR = 50;
const MIN_GAME_DURATION_MS = 5000;
const MAX_GAME_DURATION_MS = 10 * 60 * 1000;
const MAX_DISTANCE_KM = 20015;

const validatePseudo = (pseudo) => /^[A-Z]{3,5}$/.test(pseudo);

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const MIN_PLAUSIBLE_DURATION_MS = 15000;

const checkPlausibility = (gameDuration) => {
  if (gameDuration < MIN_PLAUSIBLE_DURATION_MS || gameDuration > MAX_GAME_DURATION_MS) {
    return { valid: false, reason: "Session duration implausible" };
  }
  return { valid: true };
};

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
    if (process.env.NODE_ENV === "development") {
      console.error("Rate limit error:", e.message);
    }
    return { allowed: false, remaining: 0 };
  }
};

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

export default async (req, context) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = context.ip || req.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = await checkRateLimit(ip, context);
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Rate limit exceeded. Try again later." },
      429
    );
  }

  try {
    const body = await req.json();
    const { token, rounds, pseudo, gameType = "classic" } = body;
    const csrfToken = req.headers.get("x-csrf-token");

    if (!pseudo || !validatePseudo(pseudo)) {
      return jsonResponse(
        { error: "Invalid pseudo (3-5 uppercase letters required)" },
        400
      );
    }

    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "Invalid token" }, 400);
    }

    const sql = getDatabase(context);

    const sessionResult = await sql`
      SELECT token, capitals, start_time, used, game_type, expires_at, csrf_token
      FROM sessions
      WHERE token = ${token}
        AND expires_at > NOW()
    `;

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
    if (session.csrfToken && session.csrfToken !== csrfToken) {
      return jsonResponse({ error: "Invalid CSRF token" }, 403);
    }

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

    const validatedRounds = rounds.map((round, i) => {
      const serverCapital = session.capitals[i];
      const capitalCoords = [serverCapital.lat, serverCapital.lng];

      if (!round.click) {
        return {
          capital: round.capital,
          click: null,
          distance: null,
          score: 0,
          status: "timeout",
        };
      }

      const clickCoords = [round.click.lat, round.click.lng];
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

      const score = calculateScore(distance);

      return {
        capital: round.capital,
        click: round.click,
        distance: Math.round(distance),
        score: Math.round(score),
        status: "completed",
      };
    });

    const totalScore = validatedRounds.reduce((sum, r) => sum + r.score, 0);
    const clientIp = ip.split(",")[0].trim();

    if (clientIp === "unknown") {
      return jsonResponse(
        { error: "Unable to verify player identity" },
        400
      );
    }

    const existingPseudoResult = await sql`
      SELECT pseudo
      FROM scores
      WHERE ip = ${clientIp}
      ORDER BY timestamp DESC
      LIMIT 1
    `;

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
      if (sql.begin) {
        await sql.begin(async (tx) => {
          const doubleCheckResult = await tx`
            SELECT pseudo
            FROM scores
            WHERE ip = ${clientIp}
            ORDER BY timestamp DESC
            LIMIT 1
          `;

          if (doubleCheckResult.length > 0 && doubleCheckResult[0].pseudo !== pseudo) {
            throw new Error(`PSEUDO_MISMATCH:${doubleCheckResult[0].pseudo}`);
          }

          await tx`UPDATE sessions SET used = true WHERE token = ${token}`;
          
          await tx`
            INSERT INTO scores (pseudo, score, time, rounds, timestamp, game_type, ip)
            VALUES (${pseudo}, ${totalScore}, ${gameDuration}, ${JSON.stringify(validatedRounds)}::jsonb, ${now}, ${gameType}, ${clientIp})
          `;
          
          await tx`DELETE FROM sessions WHERE token = ${token}`;
        });
      } else {
        await sql`UPDATE sessions SET used = true WHERE token = ${token}`;
        await sql`
          INSERT INTO scores (pseudo, score, time, rounds, timestamp, game_type, ip)
          VALUES (${pseudo}, ${totalScore}, ${gameDuration}, ${JSON.stringify(validatedRounds)}::jsonb, ${now}, ${gameType}, ${clientIp})
        `;
        await sql`DELETE FROM sessions WHERE token = ${token}`;
      }

      const rankResult = await sql`
        SELECT COUNT(*) + 1 as rank
        FROM scores
        WHERE game_type = ${gameType}
          AND (score > ${totalScore} OR (score = ${totalScore} AND time < ${gameDuration}))
      `;
      
      rank = parseInt(rankResult[0]?.rank || "1", 10);
      isTopFifty = rank <= 50;

      return jsonResponse({
        score: totalScore,
        rank,
        isTopFifty,
        rounds: validatedRounds,
      });
    } catch (dbError) {
      // Gérer l'erreur de pseudo mismatch dans la transaction
      if (dbError.message?.startsWith("PSEUDO_MISMATCH:")) {
        const mismatchPseudo = dbError.message.split(":")[1];
        return jsonResponse(
          {
            error: "pseudo_already_set_for_this_ip",
            pseudo: mismatchPseudo,
          },
          409
        );
      }
      if (process.env.NODE_ENV === "development") {
        console.error("Database error:", dbError.message);
      } else {
        console.error("Database error occurred");
      }
      return jsonResponse({ 
        error: "Database error. Please try again later.",
        score: totalScore,
        rank: 0,
        isTopFifty: false,
        rounds: validatedRounds,
      }, 500);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Submit error:", error.message);
    } else {
      console.error("Submit error occurred");
    }
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
