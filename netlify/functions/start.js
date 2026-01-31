// POST /.netlify/functions/start

import { randomUUID } from "crypto";
import { capitals } from "../../capitals.js";
import { selectCapitals, selectCountries } from "../../lib/capital-selection/index.js";
import { getGameMode, isValidMode } from "../../src/config/game-modes.js";
import { API } from "../../src/config.js";
import { withDatabase, withMethod, compose } from "./_middleware.js";
import { errorResponse, successResponse, parseJsonBody, handleDatabaseError } from "./_utils.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Derive countries list from capitals (unique countries with valid countryId)
const countryMap = new Map();
capitals.forEach(cap => {
  if (cap.countryId && cap.countryId !== 'UNK' && !countryMap.has(cap.countryId)) {
    countryMap.set(cap.countryId, {
      name: cap.country,
      countryId: cap.countryId,
      popular: cap.popular
    });
  }
});
const countries = Array.from(countryMap.values());

/**
 * Start a new game session
 * @param {Request} req
 * @param {any} context - Context with sql attached by middleware
 * @returns {Promise<Response>}
 */
const handler = async (req, context) => {
  const sql = context.sql; // Database connection from middleware

  try {
    const body = await parseJsonBody(req);
    const gameType = body.gameType || "classic";

    // Validate game mode
    if (!isValidMode(gameType)) {
      return errorResponse(`Invalid game mode: ${gameType}`, 400);
    }

    const token = randomUUID();
    const csrfToken = randomUUID();

    // Extract and validate player token
    let player_id = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const playerToken = authHeader.substring(7);
      try {
        const decoded = jwt.verify(playerToken, JWT_SECRET);
        // Type guard: jwt.verify returns string | JwtPayload
        if (typeof decoded !== 'string' && decoded.player_id) {
          player_id = decoded.player_id;

          // Update last_seen for this player
          await sql`
            UPDATE players
            SET last_seen = NOW()
            WHERE player_id = ${player_id}
          `;
        }
      } catch (jwtError) {
        // Invalid token - log but continue without player_id
        const errorMessage = jwtError instanceof Error ? jwtError.message : String(jwtError);
        console.warn('Invalid player token:', errorMessage);
      }
    }

    // Get mode configuration and select targets
    const mode = getGameMode(gameType);
    const isCountryMode = gameType === 'country';

    let selectedTargets;
    let clientData;

    if (isCountryMode) {
      selectedTargets = selectCountries(mode, countries, new Date());
      clientData = {
        countries: selectedTargets.map(c => ({
          name: c.name,
          countryId: c.countryId,
          popular: c.popular
        }))
      };
    } else {
      selectedTargets = selectCapitals(mode, capitals, new Date());
      clientData = {
        capitals: selectedTargets.map((c) => ({
          name: c.name,
          country: c.country,
          lat: c.lat,
          lng: c.lng,
        }))
      };
    }

    const startTime = Date.now();
    const expiresAt = new Date(startTime + API.SESSION_EXPIRY_MS);

    // Store targets in appropriate column (reuse 'capitals' column for both types)
    await sql`
      INSERT INTO sessions (token, capitals, start_time, used, game_type, expires_at, csrf_token, player_id)
      VALUES (${token}, ${JSON.stringify(selectedTargets)}::jsonb, ${startTime}, false, ${gameType}, ${expiresAt}, ${csrfToken}, ${player_id})
    `;

    return successResponse({
      token,
      ...clientData,
      startTime,
      csrfToken,
    });
  } catch (error) {
    return handleDatabaseError(error, 'start');
  }
};

// Apply middleware: POST method validation + database connection
export default compose(
  withMethod('POST'),
  withDatabase
)(handler);
