// POST /.netlify/functions/start
// Flat handler (no compose) to avoid "w is not a function" after esbuild minification

import { randomUUID } from 'crypto';
import { capitals } from '../../lib/data/capitals.js';
import { civilizations } from '../../lib/data/civilizations.js';
import { stadiums } from '../../lib/data/stadiums.js';
import {
  selectCapitals,
  selectCountries,
  selectCivilizations,
  selectStadiums,
} from '../../lib/capital-selection/index.js';
import { getGameMode } from '../../lib/config/game-modes.js';
import { API } from '../../lib/config/index.js';
import { StartBodySchema } from '../../lib/schemas/start.js';
import { getDatabase } from './db.js';
import {
  errorEnvelope,
  successEnvelope,
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
      return errorEnvelope('method_not_allowed', 'Method not allowed', 405);
    }

    let sql;
    try {
      sql = getDatabase(context);
    } catch (dbError) {
      const error = /** @type {Error} */ (dbError);
      logger.error('Database connection failed:', error.message);
      return errorEnvelope(
        'db_connection_failed',
        'Database connection failed. Please try again later.',
        503
      );
    }
    context.sql = sql;
    // Best-effort TTL cleanup for stale sessions.
    try {
      await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
    } catch (cleanupError) {
      logger.warn('Session cleanup skipped:', /** @type {Error} */ (cleanupError).message);
    }

    const body = await parseJsonBody(req);
    const parsed = StartBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorEnvelope('invalid_game_mode', 'Invalid game mode', 400, parsed.error.flatten());
    }
    const { gameType } = parsed.data;

    const token = randomUUID();
    const csrfToken = randomUUID();

    let player_id = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const playerToken = authHeader.substring(7);
      try {
        const decoded = jwt.verify(playerToken, JWT_SECRET);
        if (
          typeof decoded !== 'string' &&
          decoded.player_id !== null &&
          decoded.player_id !== undefined
        ) {
          player_id = decoded.player_id;
          const playerRows = await sql`
            UPDATE players
            SET last_seen = NOW()
            WHERE player_id = ${player_id}
            RETURNING player_id
          `;
          if (!Array.isArray(playerRows) || playerRows.length === 0) {
            logger.warn('Player token references unknown player; ignoring player_id');
            player_id = null;
          }
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
        targets: selectedTargets.map((c) => ({
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
        targets: selectedTargets.map((c) => ({
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
        targets: selectedTargets.map((s) => ({
          name: s.name,
          city: s.city,
          country: s.country,
          lat: s.lat,
          lng: s.lng,
        })),
      };
    } else {
      if (!mode.capitalSelection) {
        return errorEnvelope('capital_mode_missing', 'Capital mode configuration missing', 500);
      }
      selectedTargets = selectCapitals(
        /** @type {{ capitalSelection: any }} */ (mode),
        capitals,
        new Date()
      );
      clientData = {
        targets: selectedTargets.map((c) => ({
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
      INSERT INTO sessions (token, targets, start_time, used, game_type, expires_at, csrf_token, player_id)
      VALUES (${token}, ${JSON.stringify(selectedTargets)}::jsonb, ${startTime}, false, ${gameType}, ${expiresAt}, ${csrfToken}, ${player_id})
    `;

    return successEnvelope({
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
    return errorEnvelope('internal_error', 'An error occurred. Please try again later.', 500);
  }
}
