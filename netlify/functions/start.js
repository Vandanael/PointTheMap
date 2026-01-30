// POST /.netlify/functions/start

import { getDatabase } from "./db.js";
import { randomUUID } from "crypto";
import { capitals, selectBalancedCapitals } from "../../capitals.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

class SeededRandom {
  /**
   * @param {number} seed
   */
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * @param {Array<{name: string, country: string, lat: number, lng: number, popular: boolean}>} allCapitals
 * @param {number} seed
 * @returns {Array<{name: string, country: string, lat: number, lng: number, popular: boolean}>}
 */
const selectBalancedCapitalsDeterministic = (allCapitals, seed) => {
  const rng = new SeededRandom(seed);
  
  const popularCities = allCapitals.filter((/** @type {{popular: boolean}} */ city) => city.popular === true);
  const obscureCities = allCapitals.filter((/** @type {{popular: boolean}} */ city) => city.popular === false);

  if (popularCities.length < 2 || obscureCities.length < 3) {
    const shuffled = [...allCapitals];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 5);
  }

  const selectedPopular = [];
  const tempPopular = [...popularCities];
  for (let i = 0; i < 2 && tempPopular.length > 0; i++) {
    const randomIndex = Math.floor(rng.next() * tempPopular.length);
    selectedPopular.push(tempPopular[randomIndex]);
    tempPopular.splice(randomIndex, 1);
  }

  const selectedObscure = [];
  const tempObscure = [...obscureCities];
  for (let i = 0; i < 3 && tempObscure.length > 0; i++) {
    const randomIndex = Math.floor(rng.next() * tempObscure.length);
    selectedObscure.push(tempObscure[randomIndex]);
    tempObscure.splice(randomIndex, 1);
  }

  const sessionCapitals = [...selectedPopular, ...selectedObscure];
  for (let i = sessionCapitals.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [sessionCapitals[i], sessionCapitals[j]] = [sessionCapitals[j], sessionCapitals[i]];
  }

  return sessionCapitals;
};

/**
 * @param {Request} req
 * @param {any} context
 * @returns {Promise<Response>}
 */
export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Early database connection check
  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
    console.error("Database connection failed:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Database connection failed. Please try again later." }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const gameType = body.gameType || "classic";
    const token = randomUUID();
    const csrfToken = randomUUID(); // CSRF protection token

    // Extract and validate player token
    let player_id = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const playerToken = authHeader.substring(7);
      try {
        const decoded = jwt.verify(playerToken, JWT_SECRET);
        player_id = decoded.player_id;

        // Update last_seen for this player
        await sql`
          UPDATE players
          SET last_seen = NOW()
          WHERE player_id = ${player_id}
        `;
      } catch (jwtError) {
        // Invalid token - log but continue without player_id
        console.warn('Invalid player token:', jwtError.message);
      }
    }

    let selectedCapitals;
    if (gameType === "daily") {
      const today = new Date();
      const dateString = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const dailySeed = parseInt(dateString, 10);
      selectedCapitals = selectBalancedCapitalsDeterministic(capitals, dailySeed);
    } else {
      selectedCapitals = selectBalancedCapitals(capitals);
    }
    
    const startTime = Date.now();
    const expiresAt = new Date(startTime + 10 * 60 * 1000);
    await sql`
      INSERT INTO sessions (token, capitals, start_time, used, game_type, expires_at, csrf_token, player_id)
      VALUES (${token}, ${JSON.stringify(selectedCapitals)}::jsonb, ${startTime}, false, ${gameType}, ${expiresAt}, ${csrfToken}, ${player_id})
    `;

    const clientCapitals = selectedCapitals.map((c) => ({
      name: c.name,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
    }));

    return new Response(
      JSON.stringify({
        token,
        capitals: clientCapitals,
        startTime,
        csrfToken, // CSRF token for subsequent requests
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Handle database connection errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = /** @type {any} */ (error)?.code;
    if (errorMessage?.includes("Failed to connect") || 
        errorMessage?.includes("connection") ||
        errorCode === "ECONNREFUSED" ||
        errorCode === "ETIMEDOUT") {
      console.error("Database connection error:", errorMessage);
      return new Response(
        JSON.stringify({ error: "Database connection error. Please try again later." }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    const errorStack = /** @type {any} */ (error)?.stack;
    const isMissingColumnError = errorCode === '42703' && 
                                  errorMessage?.includes('does not exist');
    
    if (process.env.NODE_ENV === "development") {
      console.error("Start error:", errorMessage, errorCode, errorStack);
    } else {
      console.error("Start error occurred");
    }
    
    return new Response(JSON.stringify({ 
      error: isMissingColumnError 
        ? "Database schema error: missing column. Please run the migration script."
        : "Internal server error",
      details: process.env.NODE_ENV === "development" ? errorMessage : undefined
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
