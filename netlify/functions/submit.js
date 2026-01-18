// POST /.netlify/functions/submit
// Valide la partie + calcule le score côté serveur + anti-triche

import { getStore } from "@netlify/blobs";

// ============================================
// CONSTANTES
// ============================================
const MAX_SCORE_PER_ROUND = 5000;
const ROUNDS = 5;
const SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_PER_HOUR = 10;
const MIN_GAME_DURATION_MS = 5000; // 5 secondes minimum (impossible de jouer plus vite)
const MAX_GAME_DURATION_MS = 10 * 60 * 1000; // 10 minutes max
const MAX_DISTANCE_KM = 20015; // Demi-circonférence de la Terre

// ============================================
// HELPERS
// ============================================
const toRad = (deg) => (deg * Math.PI) / 180;

const haversine = ([lat1, lon1], [lat2, lon2]) => {
  const [dLat, dLon] = [lat2 - lat1, lon2 - lon1].map(toRad);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

// Calcul du score (formule exponentielle lissée, identique au client)
const calculateScore = (distanceKm) => {
  // Score parfait pour très proche (< 1km)
  if (distanceKm < 1) {
    return MAX_SCORE_PER_ROUND;
  }
  
  // Formule exponentielle continue et lisse
  // Zone excellente (< 100km) : 5000 à 3500 points
  if (distanceKm < 100) {
    // Décroissance douce : 5000 * e^(-distance/280)
    // À 100km : 5000 * e^(-100/280) = 5000 * e^(-0.357) ≈ 3500 points
    return Math.round(5000 * Math.exp(-distanceKm / 280));
  } 
  // Zone bonne (100-500km) : 3500 à 1000 points
  else if (distanceKm < 500) {
    // Formule continue depuis 100km (lissée, sans discontinuité)
    // Utiliser la même formule que la zone < 100km pour continuité parfaite
    const scoreAt100 = 5000 * Math.exp(-100 / 280); // ~3498 (cohérent avec zone < 100km)
    const scoreAt500 = 1000; // Seuil visuel jaune
    const progress = (distanceKm - 100) / 400; // 0 à 1
    // Interpolation linéaire entre 3498 et 1000
    return Math.round(scoreAt100 + (scoreAt500 - scoreAt100) * progress);
  } 
  // Zone faible (> 500km) : 1000 à 0 points
  else {
    // Décroissance exponentielle depuis 500km
    const excess = distanceKm - 500;
    // 1000 * e^(-excess/800) - décroissance douce
    return Math.max(0, Math.round(1000 * Math.exp(-excess / 800)));
  }
};

const validatePseudo = (pseudo) => /^[A-Z]{3,5}$/.test(pseudo);

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ============================================
// PLAUSIBILITY CHECK
// ============================================
const checkPlausibility = (rounds, gameDuration) => {
  // Durée totale : 20-60s (5 rounds × ~4-8s chacun + latences)
  if (gameDuration < 20000 || gameDuration > 60000) {
    return { valid: false, reason: "Session duration implausible" };
  }

  // Vérifier timing de chaque round (2-8s par round)
  const timingValid = rounds.every((r) => {
    if (!r.roundTime) return true; // Can be missing
    return r.roundTime >= 2000 && r.roundTime <= 8000;
  });

  if (!timingValid) {
    return { valid: false, reason: "Round timing implausible" };
  }

  // Distances : 0-20000km max
  const distancesValid = rounds.every((r) => {
    if (!r.click || !r.distance) return true; // Timeout is OK
    return r.distance >= 0 && r.distance <= 20000;
  });

  if (!distancesValid) {
    return { valid: false, reason: "Distance implausible" };
  }

  return { valid: true };
};

// ============================================
// RATE LIMITING
// ============================================
const checkRateLimit = async (ip) => {
  const store = getStore("rate-limits");
  const hourKey = `${ip}-${Math.floor(Date.now() / 3600000)}`;

  try {
    const current = await store.get(hourKey);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= RATE_LIMIT_PER_HOUR) {
      return { allowed: false, remaining: 0 };
    }

    await store.set(hourKey, String(count + 1));
    return { allowed: true, remaining: RATE_LIMIT_PER_HOUR - count - 1 };
  } catch (e) {
    // En cas d'erreur, on laisse passer (fail open pour UX)
    console.error("Rate limit error:", e);
    return { allowed: true, remaining: RATE_LIMIT_PER_HOUR };
  }
};

// ============================================
// VALIDATION
// ============================================
const validateRounds = (rounds, sessionCapitals) => {
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS) {
    return { valid: false, error: "Invalid rounds count" };
  }

  for (let i = 0; i < ROUNDS; i++) {
    const round = rounds[i];
    const expected = sessionCapitals[i];

    if (!round || !round.capital) {
      return { valid: false, error: `Missing round ${i + 1}` };
    }

    if (round.capital !== expected.name) {
      return { valid: false, error: `Capital mismatch at round ${i + 1}` };
    }

    // Vérifier que le clic est valide (ou null si timeout)
    if (round.click) {
      const { lat, lng } = round.click;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return { valid: false, error: `Invalid click at round ${i + 1}` };
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: `Click out of bounds at round ${i + 1}` };
      }
    }
  }

  return { valid: true };
};

// ============================================
// MAIN HANDLER
// ============================================
export default async (req, context) => {
  // Seulement POST
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Récupérer IP pour rate limiting
  const ip = context.ip || req.headers.get("x-forwarded-for") || "unknown";

  // Vérifier rate limit
  const rateLimit = await checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Rate limit exceeded. Try again later." },
      429
    );
  }

  try {
    // Parser le body
    const body = await req.json();
    const { token, rounds, pseudo, gameType = "classic" } = body;

    // Valider pseudo
    if (!pseudo || !validatePseudo(pseudo)) {
      return jsonResponse(
        { error: "Invalid pseudo (3-5 uppercase letters required)" },
        400
      );
    }

    // Valider token
    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "Invalid token" }, 400);
    }

    // Récupérer la session
    const sessionsStore = getStore("sessions");
    const session = await sessionsStore.getJSON(token);

    if (!session) {
      return jsonResponse({ error: "Session not found or expired" }, 401);
    }

    // Vérifier si déjà utilisée
    if (session.used) {
      return jsonResponse({ error: "Session already used" }, 401);
    }

    // Vérifier expiration
    const now = Date.now();
    const gameDuration = now - session.startTime;

    if (gameDuration > SESSION_EXPIRY_MS) {
      await sessionsStore.delete(token);
      return jsonResponse({ error: "Session expired" }, 401);
    }

    // Vérifier durée plausible
    if (gameDuration < MIN_GAME_DURATION_MS) {
      return jsonResponse({ error: "Suspicious activity: too fast" }, 400);
    }

    // Valider les rounds
    const validation = validateRounds(rounds, session.capitals);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    // Vérifier plausibilité timing et distances
    const plausibility = checkPlausibility(rounds, gameDuration);
    if (!plausibility.valid) {
      return jsonResponse({ error: plausibility.reason }, 400);
    }

    // Recalculer les scores côté serveur
    const validatedRounds = rounds.map((round, i) => {
      const serverCapital = session.capitals[i];
      const capitalCoords = [serverCapital.lat, serverCapital.lng];

      if (!round.click) {
        // Timeout
        return {
          capital: round.capital,
          click: null,
          distance: null,
          score: 0,
          status: "timeout",
        };
      }

      const clickCoords = [round.click.lat, round.click.lng];
      const distance = haversine(clickCoords, capitalCoords);

      // Vérifier distance plausible
      if (distance > MAX_DISTANCE_KM) {
        return {
          capital: round.capital,
          click: round.click,
          distance: MAX_DISTANCE_KM,
          score: 0,
          status: "invalid",
        };
      }

      const score = calculateScore(distance);

      return {
        capital: round.capital,
        click: round.click,
        distance: Math.round(distance),
        score: Math.round(score),
        status: "completed",
      };
    });

    const totalScore = validatedRounds.reduce((sum, r) => sum + r.score, 0);

    // Marquer la session comme utilisée
    session.used = true;
    await sessionsStore.setJSON(token, session);

    // Enregistrer le score dans le leaderboard
    const leaderboardStore = getStore("leaderboard");
    const entry = {
      pseudo,
      score: totalScore,
      time: gameDuration,
      rounds: validatedRounds,
      timestamp: now,
      gameType, // "classic" ou "daily"
      ip: ip.split(",")[0].trim(), // Première IP si plusieurs
    };

    const entryKey = `${now}-${token.slice(0, 8)}`;
    await leaderboardStore.setJSON(entryKey, entry);

    // Calculer le rang
    const allEntries = await leaderboardStore.list();
    const scores = await Promise.all(
      allEntries.blobs.map(async (b) => {
        const data = await leaderboardStore.getJSON(b.key);
        return data;
      })
    );

    // Trier par score DESC, puis temps ASC
    scores.sort((a, b) => b.score - a.score || a.time - b.time);

    const rank = scores.findIndex((s) => s.timestamp === now) + 1;
    const isTopFifty = rank <= 50;

    // Supprimer la session après succès
    await sessionsStore.delete(token);

    return jsonResponse({
      score: totalScore,
      rank,
      isTopFifty,
      rounds: validatedRounds,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
};
