import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getDatabase } from './db.js';
import {
  errorEnvelope,
  successEnvelope,
  createLogger,
  getClientIp,
  isDatabaseConnectionError,
} from './_utils.js';
import { createFallbackRateLimiter, checkDbRateLimit } from './_rate-limit.js';

const logger = createLogger('generate-player-token');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const TOKEN_EXPIRY = '1y'; // Token valide 1 an
const RATE_LIMIT_MAX = 10;

const fallbackLimiter = createFallbackRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: RATE_LIMIT_MAX,
});

/**
 * @param {Request} req
 * @param {any} context
 */
export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return errorEnvelope('method_not_allowed', 'Method not allowed', 405);
  }

  try {
    const sql = getDatabase(context);
    const ip = getClientIp(req, context);

    const rateLimit = await checkDbRateLimit({
      ip,
      sql,
      keyPrefix: 'player-token-',
      maxRequests: RATE_LIMIT_MAX,
      fallback: fallbackLimiter,
      logger,
    });

    if (!rateLimit.allowed) {
      return errorEnvelope(
        'rate_limited',
        'Rate limit exceeded. Try again later.',
        429,
        undefined,
        {
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
          'X-RateLimit-Remaining': '0',
        }
      );
    }

    // Generate new player_id
    const player_id = randomUUID();
    const created_at = Math.floor(Date.now() / 1000);

    // Insert player in database
    await sql`
      INSERT INTO players (player_id, created_at, last_seen)
      VALUES (${player_id}, to_timestamp(${created_at}), to_timestamp(${created_at}))
      ON CONFLICT (player_id) DO NOTHING
    `;

    // Generate JWT token
    const token = jwt.sign(
      {
        player_id,
        created_at,
        version: 1, // For future token format changes
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return successEnvelope(
      {
        token,
        player_id,
        expires_in: TOKEN_EXPIRY,
      },
      {
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': String(Math.max(0, rateLimit.remaining)),
      }
    );
  } catch (error) {
    logger.error('Error generating player token:', error);
    return errorEnvelope(
      isDatabaseConnectionError(error) ? 'db_connection_error' : 'internal_error',
      isDatabaseConnectionError(error)
        ? 'Database connection error. Please try again later.'
        : 'Internal server error',
      isDatabaseConnectionError(error) ? 503 : 500
    );
  }
};
