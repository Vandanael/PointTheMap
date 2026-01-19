// POST /.netlify/functions/start
// Génère un token unique + sélectionne 5 capitales avec l'algorithme Balanced Challenge
// Pour le mode "daily", utilise un seed déterministe basé sur la date

import { getDatabase } from "./db.js";
import { randomUUID } from "crypto";
import { capitals, selectBalancedCapitals } from "../../capitals.js";

// Générateur pseudo-aléatoire déterministe (seed-based)
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

// Sélection déterministe basée sur un seed pour le mode daily
// Utilise l'algorithme Balanced Challenge (2 populaires + 3 non-populaires)
const selectBalancedCapitalsDeterministic = (allCapitals, seed) => {
  const rng = new SeededRandom(seed);
  
  // Séparer les capitales par popularité
  const popularCities = allCapitals.filter((city) => city.popular === true);
  const obscureCities = allCapitals.filter((city) => city.popular === false);

  // Validation
  if (popularCities.length < 2 || obscureCities.length < 3) {
    // Fallback: sélection simple
    const shuffled = [...allCapitals];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 5);
  }

  // Sélectionner 2 populaires avec seed
  const selectedPopular = [];
  const tempPopular = [...popularCities];
  for (let i = 0; i < 2 && tempPopular.length > 0; i++) {
    const randomIndex = Math.floor(rng.next() * tempPopular.length);
    selectedPopular.push(tempPopular[randomIndex]);
    tempPopular.splice(randomIndex, 1);
  }

  // Sélectionner 3 non-populaires avec seed
  const selectedObscure = [];
  const tempObscure = [...obscureCities];
  for (let i = 0; i < 3 && tempObscure.length > 0; i++) {
    const randomIndex = Math.floor(rng.next() * tempObscure.length);
    selectedObscure.push(tempObscure[randomIndex]);
    tempObscure.splice(randomIndex, 1);
  }

  // Combiner et mélanger avec seed
  const sessionCapitals = [...selectedPopular, ...selectedObscure];
  for (let i = sessionCapitals.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [sessionCapitals[i], sessionCapitals[j]] = [sessionCapitals[j], sessionCapitals[i]];
  }

  return sessionCapitals;
};

export default async (req, context) => {
  // Seulement POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Récupérer le gameType depuis le body
    const body = await req.json().catch(() => ({}));
    const gameType = body.gameType || "classic";
    
    const token = randomUUID();
    
    // Pour le mode daily, utiliser un seed déterministe basé sur la date
    // Pour le mode classic, sélection aléatoire avec Balanced Challenge
    let selectedCapitals;
    if (gameType === "daily") {
      const today = new Date();
      const dateString = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const dailySeed = parseInt(dateString, 10);
      selectedCapitals = selectBalancedCapitalsDeterministic(capitals, dailySeed);
    } else {
      selectedCapitals = selectBalancedCapitals(capitals);
    }
    
    const startTime = Date.now();
    const expiresAt = new Date(startTime + 10 * 60 * 1000); // 10 minutes

    // Stocker la session dans PostgreSQL
    const sql = getDatabase(context);
    await sql`
      INSERT INTO sessions (token, capitals, start_time, used, game_type, expires_at)
      VALUES (${token}, ${JSON.stringify(selectedCapitals)}::jsonb, ${startTime}, false, ${gameType}, ${expiresAt})
    `;

    // Retourner au client (coordonnées nécessaires pour l'affichage)
    // La protection anti-triche est assurée par le recalcul côté serveur
    const clientCapitals = selectedCapitals.map((c) => ({
      name: c.name,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
    }));

    return new Response(
      JSON.stringify({
        token,
        capitals: clientCapitals,
        startTime,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Start error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
