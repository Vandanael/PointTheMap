// GET /.netlify/functions/leaderboard

import { getDatabase } from "./db.js";

const TOP_LIMIT = 50;

const deduplicateScores = (scores) => {
  const pseudoMap = new Map();

  scores.forEach((entry) => {
    const existing = pseudoMap.get(entry.pseudo);

    if (!existing) {
      pseudoMap.set(entry.pseudo, entry);
    } else {
      const isBetter =
        entry.score > existing.score ||
        (entry.score === existing.score && entry.time < existing.time);

      if (isBetter) {
        pseudoMap.set(entry.pseudo, entry);
      }
    }
  });

  return Array.from(pseudoMap.values())
    .sort((a, b) => b.score - a.score || a.time - b.time)
    .slice(0, TOP_LIMIT);
};

export default async (req, context) => {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Early database connection check
  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    console.error("Database connection failed:", dbError.message);
    return new Response(
      JSON.stringify({ error: "Database connection failed. Please try again later." }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const type = url.searchParams.get("type") || "classic";
    let query;
    if (type === "daily") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      const tomorrowTimestamp = todayTimestamp + 86400000;
      
      query = sql`
        SELECT pseudo, score, time, timestamp
        FROM scores
        WHERE game_type = 'daily'
          AND timestamp >= ${todayTimestamp}
          AND timestamp < ${tomorrowTimestamp}
        ORDER BY score DESC, time ASC
        LIMIT 100
      `;
    } else {
      query = sql`
        SELECT pseudo, score, time, timestamp
        FROM scores
        WHERE game_type = 'classic'
        ORDER BY score DESC, time ASC
        LIMIT 100
      `;
    }

    const scores = await query;
    const top50 = deduplicateScores(scores).slice(0, TOP_LIMIT).map((s, i) => ({
      rank: i + 1,
      pseudo: s.pseudo,
      score: s.score,
      time: s.time,
    }));

    return new Response(JSON.stringify(top50), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    });
  } catch (error) {
    // Handle database connection errors
    if (error.message?.includes("Failed to connect") || 
        error.message?.includes("connection") ||
        error.code === "ECONNREFUSED" ||
        error.code === "ETIMEDOUT") {
      console.error("Database connection error:", error.message);
      return new Response(
        JSON.stringify({ error: "Database connection error. Please try again later." }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
    
    if (process.env.NODE_ENV === "development") {
      console.error("Leaderboard error:", error.message, error.code, error.stack);
    } else {
      console.error("Leaderboard error occurred");
    }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
