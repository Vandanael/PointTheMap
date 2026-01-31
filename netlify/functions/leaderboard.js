// GET /.netlify/functions/leaderboard

import { API } from "../../src/config.js";
import { withDatabase, withMethod, compose } from "./_middleware.js";
import { successResponse, handleDatabaseError } from "./_utils.js";

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
        LIMIT ${API.LEADERBOARD_TOP_LIMIT}
      `;
    } else {
      // Classic mode: same window function approach
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
          WHERE game_type = 'classic'
        )
        SELECT pseudo, score, time, timestamp
        FROM ranked_scores
        WHERE rank = 1
        ORDER BY score DESC, time ASC
        LIMIT ${API.LEADERBOARD_TOP_LIMIT}
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
export default compose(
  withMethod('GET'),
  withDatabase
)(handler);
