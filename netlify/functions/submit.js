// POST /.netlify/functions/submit
// Valide la partie + calcule le score côté serveur + anti-triche

import { getDatabase } from "./db.js";

// Constantes
const MAX_SCORE_PER_ROUND = 5000;
const ROUNDS = 5;
const SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_PER_HOUR = 50; // 50 parties par heure
const MIN_GAME_DURATION_MS = 5000; // 5 secondes minimum (impossible de jouer plus vite)
const MAX_GAME_DURATION_MS = 10 * 60 * 1000; // 10 minutes max
const MAX_DISTANCE_KM = 20015; // Demi-circonférence de la Terre
const toRad = (deg) => (deg * Math.PI) / 180;

const haversine = ([lat1, lon1], [lat2, lon2]) => {
  const [dLat, dLon] = [lat2 - lat1, lon2 - lon1].map(toRad);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

// Calcul du score (formule exponentielle lissée, identique au client)
const calculateScore = (distanceKm) => {
  if (distanceKm < 1) {
    return MAX_SCORE_PER_ROUND;
  }
  
  if (distanceKm < 100) {
    // Décroissance exponentielle : 5000 * e^(-distance/280)
    return Math.round(5000 * Math.exp(-distanceKm / 280));
  } 
  else if (distanceKm < 500) {
    // Interpolation linéaire entre 100km et 500km
    const scoreAt100 = 5000 * Math.exp(-100 / 280);
    const scoreAt500 = 1000;
    const progress = (distanceKm - 100) / 400;
    return Math.round(scoreAt100 + (scoreAt500 - scoreAt100) * progress);
  } 
  else {
    // Décroissance exponentielle depuis 500km
    const excess = distanceKm - 500;
    return Math.max(0, Math.round(1000 * Math.exp(-excess / 800)));
  }
};

const validatePseudo = (pseudo) => /^[A-Z]{3,5}$/.test(pseudo);

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Plausibility check
const checkPlausibility = (rounds, gameDuration) => {
  // Durée totale : minimum 15s (même en allant très vite), maximum = SESSION_EXPIRY_MS
  const MIN_PLAUSIBLE_DURATION = 15000; // 15 secondes
  if (gameDuration < MIN_PLAUSIBLE_DURATION || gameDuration > MAX_GAME_DURATION_MS) {
    return { valid: false, reason: "Session duration implausible" };
  }

  // Note: les distances sont recalculées côté serveur, pas besoin de les vérifier ici
  // Les coordonnées sont déjà validées dans validateRounds()

  return { valid: true };
};

// Rate limiting
const checkRateLimit = async (ip, context) => {
  // Utiliser PostgreSQL pour le rate limiting (plus fiable)
  try {
    const sql = getDatabase(context);
    const hourKey = `${ip}-${Math.floor(Date.now() / 3600000)}`;
    const expiresAt = new Date(Date.now() + 3600000); // 1 heure
    
    // Nettoyer les anciennes entrées
    await sql`DELETE FROM rate_limits WHERE expires_at < NOW()`;
    
    // Récupérer ou créer l'entrée
    const existing = await sql`
      SELECT count FROM rate_limits WHERE key = ${hourKey}
    `;
    
    if (existing.length > 0) {
      const count = existing[0].count;
      if (count >= RATE_LIMIT_PER_HOUR) {
        return { allowed: false, remaining: 0 };
      }
      // Incrémenter
      await sql`
        UPDATE rate_limits 
        SET count = count + 1 
        WHERE key = ${hourKey}
      `;
      return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - count - 1 };
    } else {
      // Créer nouvelle entrée
      await sql`
        INSERT INTO rate_limits (key, count, expires_at)
        VALUES (${hourKey}, 1, ${expiresAt})
      `;
      return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - 1 };
    }
  } catch (e) {
    // Fail-closed: bloquer si le rate limiting échoue (sécurité > UX)
    console.error("Rate limit error:", e);
    return { allowed: false, remaining: 0 };
  }
};

// Validation
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

    // Vérifier que le clic est valide (ou null si timeout)
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
  // Seulement POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Récupérer IP pour rate limiting
  const ip = context.ip || req.headers.get("x-forwarded-for") || "unknown";

  // Vérifier rate limit
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

    if (!pseudo || !validatePseudo(pseudo)) {
      return jsonResponse(
        { error: "Invalid pseudo (3-5 uppercase letters required)" },
        400
      );
    }

    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "Invalid token" }, 400      );
    }

    const sql = getDatabase(context);
    
    const sessionResult = await sql`
      SELECT token, capitals, start_time, used, game_type, expires_at
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
    };

    if (session.used) {
      return jsonResponse({ error: "Session already used" }, 401);
    }

    if (session.gameType && session.gameType !== gameType) {
      return jsonResponse({ error: "Game type mismatch" }, 400);
    }

    const now = Date.now();
    
    // Vérification des timestamps: le timestamp de session ne doit pas être dans le futur
    if (session.startTime > now) {
      return jsonResponse({ error: "Invalid session timestamp" }, 400);
    }
    
    const gameDuration = now - session.startTime;
    
    // Vérifier que la durée n'est pas négative (double vérification)
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

    const plausibility = checkPlausibility(rounds, gameDuration);
    if (!plausibility.valid) {
      return jsonResponse({ error: plausibility.reason }, 400);
    }

    const validatedRounds = rounds.map((round, i) => {
      const serverCapital = session.capitals[i];
      const capitalCoords = [serverCapital.lat, serverCapital.lng];

      if (!round.click) {
        // Timeout
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

    // Rejeter si IP est "unknown" (sécurité : éviter que tous les utilisateurs sans IP partagent le même pseudo)
    if (clientIp === "unknown") {
      return jsonResponse(
        { error: "Unable to verify player identity" },
        400
      );
    }

    // Vérifier si cette IP est déjà associée à un pseudo différent
    // Note: Cette vérification se fait AVANT la transaction pour performance,
    // mais la vérification est répétée dans la transaction pour éviter les race conditions
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

    // Utiliser une transaction pour garantir l'atomicité des opérations
    // Note: @netlify/neon utilise le driver neon-js qui supporte les transactions
    let rank = 1;
    let isTopFifty = false;
    
    try {
      if (sql.begin) {
        await sql.begin(async (tx) => {
          // Double vérification dans la transaction pour éviter race condition
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
        // Fallback sans transaction (déjà vérifié plus haut)
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
      console.error("Database error:", dbError);
      console.error("Error details:", {
        message: dbError.message,
        stack: dbError.stack,
        name: dbError.name,
        env: {
          hasContextEnv: !!context?.env,
          hasNetlifyDbUrl: !!(context?.env?.NETLIFY_DATABASE_URL || process.env.NETLIFY_DATABASE_URL),
          contextKeys: context?.env ? Object.keys(context.env) : []
        }
      });
      return jsonResponse({ 
        error: "Database error. Please try again later.",
        score: totalScore,
        rank: 0,
        isTopFifty: false,
        rounds: validatedRounds,
      }, 500);
    }
  } catch (error) {
    console.error("Submit error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
