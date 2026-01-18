// GET /.netlify/functions/leaderboard
// Retourne le Top 50 avec cache

import { getStore } from "@netlify/blobs";

const TOP_LIMIT = 50;

// ============================================
// DEDUPLICATION (Keep best score per pseudo)
// ============================================
const deduplicateScores = (scores) => {
  const pseudoMap = new Map();

  // Garder seulement le meilleur score par pseudo
  scores.forEach((entry) => {
    const existing = pseudoMap.get(entry.pseudo);

    if (!existing) {
      pseudoMap.set(entry.pseudo, entry);
    } else {
      // Comparer : meilleur score, puis meilleur temps en cas d'égalité
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

  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const type = url.searchParams.get("type") || "classic";
    
    const store = getStore("leaderboard");
    const allEntries = await store.list();

    // Récupérer tous les scores
    const scores = await Promise.all(
      allEntries.blobs.map(async (b) => {
        try {
          const data = await store.getJSON(b.key);
          return data;
        } catch (e) {
          return null;
        }
      })
    );

    // Filtrer les entrées invalides
    let validScores = scores.filter((s) => s && typeof s.score === "number");

    // Filtrer par type de jeu
    if (type === "daily") {
      // Daily : scores du jour uniquement (basé sur timestamp)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      
      validScores = validScores.filter((s) => {
        if (!s.timestamp) return false;
        const scoreDate = new Date(s.timestamp);
        scoreDate.setHours(0, 0, 0, 0);
        return scoreDate.getTime() === todayTimestamp;
      });
    } else {
      // Classic : tous les scores (pas de filtre par date)
      // On peut aussi filtrer par gameType si présent pour une séparation plus claire
      // Pour compatibilité, on garde tous les scores sans gameType ou avec gameType="classic"
      validScores = validScores.filter((s) => {
        // Si gameType existe, ne garder que "classic", sinon garder (anciennes entrées)
        return !s.gameType || s.gameType === "classic";
      });
    }

    // Trier
    validScores.sort((a, b) => b.score - a.score || a.time - b.time);

    // Dédupliquer et Top 50
    const top50 = deduplicateScores(validScores).map((s, i) => ({
      rank: i + 1,
      pseudo: s.pseudo,
      score: s.score,
      time: s.time,
    }));

    return new Response(JSON.stringify(top50), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Cache 30 secondes côté CDN
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
