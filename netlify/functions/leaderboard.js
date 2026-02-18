// GET /.netlify/functions/leaderboard
// Flat handler (no compose) to avoid "w is not a function" after esbuild minification

import { LeaderboardQuerySchema } from '../../lib/schemas/leaderboard.js';
import { getDatabase } from './db.js';
import { successEnvelope, errorEnvelope, handleDatabaseError, createLogger } from './_utils.js';

const logger = createLogger('leaderboard');

const LEADERBOARD_TOP_LIMIT = 50;

/**
 * @param {Request} req
 * @param {any} context
 */
export default async function leaderboardHandler(req, context) {
  try {
    if (req.method !== 'GET') {
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

    const url = new URL(req.url, `http://${req.headers.get('host') || 'localhost'}`);
    const parsed = LeaderboardQuerySchema.safeParse({
      type: url.searchParams.get('type') ?? undefined,
    });
    if (!parsed.success) {
      return errorEnvelope(
        'invalid_leaderboard_type',
        'Invalid leaderboard type',
        400,
        parsed.error.flatten()
      );
    }
    const { type } = parsed.data;

    const dailyTypes = new Set(['daily', 'country_daily', 'stadium_daily', 'civilization_daily']);
    let query;
    if (dailyTypes.has(type)) {
      const now = new Date();
      const todayTimestamp = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const tomorrowTimestamp = todayTimestamp + 86400000;

      query = sql`
        WITH ranked_scores AS (
          SELECT
            pseudo,
            score,
            time,
            timestamp,
            ROW_NUMBER() OVER (
              PARTITION BY pseudo
              ORDER BY score DESC, time ASC
            ) as rank
          FROM scores
          WHERE game_type = ${type}
            AND timestamp >= ${todayTimestamp}
            AND timestamp < ${tomorrowTimestamp}
        )
        SELECT pseudo, score, time, timestamp
        FROM ranked_scores
        WHERE rank = 1
        ORDER BY score DESC, time ASC
        LIMIT ${LEADERBOARD_TOP_LIMIT}
      `;
    } else {
      query = sql`
        WITH ranked_scores AS (
          SELECT
            pseudo,
            score,
            time,
            timestamp,
            ROW_NUMBER() OVER (
              PARTITION BY pseudo
              ORDER BY score DESC, time ASC
            ) as rank
          FROM scores
          WHERE game_type = ${type}
        )
        SELECT pseudo, score, time, timestamp
        FROM ranked_scores
        WHERE rank = 1
        ORDER BY score DESC, time ASC
        LIMIT ${LEADERBOARD_TOP_LIMIT}
      `;
    }

    const scores = await query;

    const topScores = scores.map((s, i) => ({
      rank: i + 1,
      pseudo: s.pseudo ?? 'UNKNOWN',
      score: s.score ?? 0,
      time: s.time ?? 0,
    }));

    return successEnvelope(topScores, {
      'Cache-Control': 'public, max-age=30, s-maxage=30',
    });
  } catch (error) {
    const err = /** @type {Error & { code?: string }} */ (error);
    if (err?.code || (err?.message && err.message.includes('database'))) {
      return handleDatabaseError(err, 'leaderboard');
    }
    logger.error('Uncaught error:', err?.message, err?.stack);
    return errorEnvelope('internal_error', 'An error occurred. Please try again later.', 500);
  }
}
