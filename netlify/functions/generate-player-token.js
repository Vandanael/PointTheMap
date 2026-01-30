import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getDatabase } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '1y'; // Token valide 1 an

export default async (req, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
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

    return new Response(
      JSON.stringify({
        token,
        player_id,
        expires_in: TOKEN_EXPIRY,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Error generating player token:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      }),
      { status: 500, headers }
    );
  }
};
