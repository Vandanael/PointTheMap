// POST /.netlify/functions/start
// Flat handler (no compose) to avoid "w is not a function" after esbuild minification

import { randomUUID } from 'crypto';
import { capitals } from '../../src/data/capitals.js';
import { civilizations } from '../../src/data/civilizations.js';
import { stadiums } from '../../src/data/stadiums.js';
import {
  selectCapitals,
  selectCountries,
  selectCivilizations,
  selectStadiums,
} from '../../lib/capital-selection/index.js';
import { getGameMode, isValidMode } from '../../lib/config/game-modes.js';
import { API } from '../../lib/config/index.js';
import { getDatabase } from './db.js';
import {
  errorResponse,
  successResponse,
  parseJsonBody,
  handleDatabaseError,
  createLogger,
} from './_utils.js';
import jwt from 'jsonwebtoken';

const logger = createLogger('start');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

// Derive countries list from capitals (unique countries with valid countryId)
const countryMap = new Map();
capitals.forEach((cap) => {
  if (cap.countryId && cap.countryId !== 'UNK' && !countryMap.has(cap.countryId)) {
    countryMap.set(cap.countryId, {
      name: cap.country,
      countryId: cap.countryId,
      popular: cap.popular,
    });
  }
});
const countries = Array.from(countryMap.values());

/**
 * @param {Request} req
 * @param {any} context
 */
export default async function startHandler(req, context) {
  try {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    let sql;
    try {
      sql = getDatabase(context);
    } catch (dbError) {
      const error = /** @type {Error} */ (dbError);
      logger.error('Database connection failed:', error.message);
      return errorResponse('Database connection failed. Please try again later.', 503);
    }
    context.sql = sql;

    /** @type {{ gameType?: string }} */
    const body = await parseJsonBody(req);
    const gameType = body.gameType || 'classic';

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
        const error = /** @type {Error} */ (jwtError);
        logger.warn('Invalid player token:', error.message);
      }
    }

    const mode = getGameMode(gameType);
    const isCountryMode = gameType === 'country' || gameType === 'country_daily';
    const isCivilizationMode = gameType === 'civilization' || gameType === 'civilization_daily';
    const isStadiumMode = gameType === 'stadium' || gameType === 'stadium_daily';

    let selectedTargets;
    let clientData;

    if (isCountryMode) {
      selectedTargets = selectCountries(
        /** @type {{ countrySelection: any }} */ (mode),
        countries,
        new Date()
      );
      clientData = {
        countries: selectedTargets.map((c) => ({
          name: c.name,
          countryId: c.countryId,
          popular: c.popular,
        })),
      };
    } else if (isCivilizationMode) {
      selectedTargets = selectCivilizations(
        /** @type {{ civilizationSelection: any }} */ (mode),
        civilizations,
        new Date()
      );
      clientData = {
        civilizations: selectedTargets.map((c) => ({
          id: c.id,
          name: c.name,
          popular: c.popular,
        })),
      };
    } else if (isStadiumMode) {
      selectedTargets = selectStadiums(
        /** @type {{ stadiumSelection: any }} */ (mode),
        stadiums,
        new Date()
      );
      clientData = {
        stadiums: selectedTargets.map((s) => ({
          name: s.name,
          city: s.city,
          country: s.country,
          lat: s.lat,
          lng: s.lng,
        })),
      };
    } else {
      selectedTargets = selectCapitals(mode, capitals, new Date());
      clientData = {
        capitals: selectedTargets.map((c) => ({
          name: c.name,
          country: c.country,
          lat: c.lat,
          lng: c.lng,
        })),
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
    logger.error('Uncaught error:', err?.message, err?.stack);
    return errorResponse('An error occurred. Please try again later.', 500);
  }
}
