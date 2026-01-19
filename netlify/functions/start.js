// POST /.netlify/functions/start

import { getDatabase } from "./db.js";
import { randomUUID } from "crypto";
import { capitals, selectBalancedCapitals } from "../../capitals.js";

class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

const selectBalancedCapitalsDeterministic = (allCapitals, seed) => {
  const rng = new SeededRandom(seed);
  
  const popularCities = allCapitals.filter((city) => city.popular === true);
  const obscureCities = allCapitals.filter((city) => city.popular === false);

  if (popularCities.length < 2 || obscureCities.length < 3) {
    const shuffled = [...allCapitals];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 5);
  }

  const selectedPopular = [];
  const tempPopular = [...popularCities];
  for (let i = 0; i < 2 && tempPopular.length > 0; i++) {
    const randomIndex = Math.floor(rng.next() * tempPopular.length);
    selectedPopular.push(tempPopular[randomIndex]);
    tempPopular.splice(randomIndex, 1);
  }

  const selectedObscure = [];
  const tempObscure = [...obscureCities];
  for (let i = 0; i < 3 && tempObscure.length > 0; i++) {
    const randomIndex = Math.floor(rng.next() * tempObscure.length);
    selectedObscure.push(tempObscure[randomIndex]);
    tempObscure.splice(randomIndex, 1);
  }

  const sessionCapitals = [...selectedPopular, ...selectedObscure];
  for (let i = sessionCapitals.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [sessionCapitals[i], sessionCapitals[j]] = [sessionCapitals[j], sessionCapitals[i]];
  }

  return sessionCapitals;
};

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const gameType = body.gameType || "classic";
    const token = randomUUID();
    
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
    const expiresAt = new Date(startTime + 10 * 60 * 1000);
    const sql = getDatabase(context);
    await sql`
      INSERT INTO sessions (token, capitals, start_time, used, game_type, expires_at)
      VALUES (${token}, ${JSON.stringify(selectedCapitals)}::jsonb, ${startTime}, false, ${gameType}, ${expiresAt})
    `;

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
    if (process.env.NODE_ENV === "development") {
      console.error("Start error:", error.message, error.code);
    } else {
      console.error("Start error occurred");
    }
    
    const isMissingColumnError = error.code === '42703' && 
                                  error.message?.includes('does not exist');
    
    return new Response(JSON.stringify({ 
      error: isMissingColumnError 
        ? "Database schema error: missing column. Please run the migration script."
        : "Internal server error",
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
