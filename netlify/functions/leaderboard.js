// GET /.netlify/functions/leaderboard
// Flat handler (no compose) to avoid "w is not a function" after esbuild minification

import { getDatabase } from "./db.js";
import { successResponse, errorResponse, handleDatabaseError } from "./_utils.js";

const LEADERBOARD_TOP_LIMIT = 50;

export default async function leaderboardHandler(req, context) {
  try {
    if (req.method !== 'GET') {
      return errorResponse("Method not allowed", 405);
    }

    let sql;
    try {
      sql = getDatabase(context);
    } catch (dbError) {
      console.error("Database connection failed:", dbError?.message);
      return errorResponse("Database connection failed. Please try again later.", 503);
    }

    const url = new URL(req.url, `http://${req.headers.get("host") || "localhost"}`);
    const type = url.searchParams.get("type") || "classic";

    const validDailyTypes = ["daily", "country_daily", "stadium_daily", "civilization_daily"];
    const validClassicTypes = ["classic", "country", "stadium", "civilization"];
    let query;
    if (validDailyTypes.includes(type)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
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
      const gameType = validClassicTypes.includes(type) ? type : "classic";
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
    const err = /** @type {Error & { code?: string }} */ (error);
    if (err?.code || (err?.message && err.message.includes('database'))) {
      return handleDatabaseError(err, 'leaderboard');
    }
    console.error("[leaderboard] Uncaught error:", err?.message, err?.stack);
    return errorResponse("An error occurred. Please try again later.", 500);
  }
}
