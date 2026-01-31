// GET /.netlify/functions/leaderboard
// Self-contained: no imports outside netlify/functions/ to avoid 502 at cold start in production

import { withDatabase, withMethod, compose } from "./_middleware.js";
import { successResponse, errorResponse, handleDatabaseError } from "./_utils.js";

const LEADERBOARD_TOP_LIMIT = 50;

/**
 * Get leaderboard for a game mode
 * Uses SQL window functions for efficient server-side deduplication
 * @param {Request} req
 * @param {any} context - Context with sql attached by middleware
 * @returns {Promise<Response>}
 */
const handler = async (req, context) => {
  const sql = context.sql;

  try {
    const url = new URL(req.url, `http://${req.headers.get("host") || "localhost"}`);
    const type = url.searchParams.get("type") || "classic";

    let query;
    if (type === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      const tomorrowTimestamp = todayTimestamp + 86400000;

      // SQL window function approach for server-side deduplication
      // ROW_NUMBER() partitions by pseudo and orders by score DESC, time ASC
      // This gives us the best score for each player
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
          WHERE game_type = 'daily'
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
      // Classic or country mode: same window function approach
      const gameType = type === "country" ? "country" : "classic";
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
          WHERE game_type = ${gameType}
        )
        SELECT pseudo, score, time, timestamp
        FROM ranked_scores
        WHERE rank = 1
        ORDER BY score DESC, time ASC
        LIMIT ${LEADERBOARD_TOP_LIMIT}
      `;
    }

    const scores = await query;

    // Map to final format with rank
    const topScores = scores.map((s, i) => ({
      rank: i + 1,
      pseudo: s.pseudo,
      score: s.score,
      time: s.time,
    }));

    return successResponse(topScores, {
      "Cache-Control": "public, max-age=30, s-maxage=30",
    });
  } catch (error) {
    return handleDatabaseError(error, 'leaderboard');
  }
};

// Apply middleware: GET method validation + database connection
const composedHandler = compose(
  withMethod('GET'),
  withDatabase
)(handler);

// Safety wrapper: never leave request without response (avoids 502 from uncaught errors)
export default async (req, context) => {
  try {
    return await composedHandler(req, context);
  } catch (err) {
    console.error("[leaderboard] Uncaught error:", err?.message, err?.stack);
    return errorResponse("An error occurred. Please try again later.", 500);
  }
};
