// POST /.netlify/functions/start
// Flat handler (no compose) to avoid "w is not a function" after esbuild minification

import { randomUUID } from "crypto";
import { capitals } from "../../src/data/capitals.js";
import { civilizations } from "../../src/data/civilizations.js";
import { selectCapitals, selectCountries, selectCivilizations } from "../../lib/capital-selection/index.js";
import { getGameMode, isValidMode } from "../../src/config/game-modes.js";
import { API } from "../../src/config.js";
import { getDatabase } from "./db.js";
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

export default async function startHandler(req, context) {
  try {
    if (req.method !== 'POST') {
      return errorResponse("Method not allowed", 405);
    }

    let sql;
    try {
      sql = getDatabase(context);
    } catch (dbError) {
      console.error("Database connection failed:", dbError?.message);
      return errorResponse("Database connection failed. Please try again later.", 503);
    }
    context.sql = sql;

    const body = await parseJsonBody(req);
    const gameType = body.gameType || "classic";

    if (!isValidMode(gameType)) {
      return errorResponse(`Invalid game mode: ${gameType}`, 400);
    }

    const token = randomUUID();
    const csrfToken = randomUUID();

    let player_id = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const playerToken = authHeader.substring(7);
      try {
        const decoded = jwt.verify(playerToken, JWT_SECRET);
        if (typeof decoded !== 'string' && decoded.player_id) {
          player_id = decoded.player_id;
          await sql`
            UPDATE players
            SET last_seen = NOW()
            WHERE player_id = ${player_id}
          `;
        }
      } catch (jwtError) {
        console.warn('Invalid player token:', jwtError?.message);
      }
    }

    const mode = getGameMode(gameType);
    const isCountryMode = gameType === 'country';
    const isCivilizationMode = gameType === 'civilization';

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
    } else if (isCivilizationMode) {
      selectedTargets = selectCivilizations(mode, civilizations, new Date());
      clientData = {
        civilizations: selectedTargets.map(c => ({
          id: c.id,
          name: c.name,
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
    const err = /** @type {Error & { code?: string }} */ (error);
    if (err?.code || (err?.message && err.message.includes('database'))) {
      return handleDatabaseError(err, 'start');
    }
    console.error("[start] Uncaught error:", err?.message, err?.stack);
    return errorResponse("An error occurred. Please try again later.", 500);
  }
}
