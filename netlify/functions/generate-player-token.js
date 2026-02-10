import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getDatabase } from './db.js';
import { errorResponse, successResponse, createLogger } from './_utils.js';

const logger = createLogger('generate-player-token');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const TOKEN_EXPIRY = '1y'; // Token valide 1 an

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
    return errorResponse('Method not allowed', 405);
  }

  try {
    const sql = getDatabase(context);

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

    return successResponse({
      token,
      player_id,
      expires_in: TOKEN_EXPIRY,
    });
  } catch (error) {
    logger.error('Error generating player token:', error);
    return errorResponse('Internal server error', 500);
  }
};
