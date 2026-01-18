// POST /.netlify/functions/start
// Génère un token unique + sélectionne 5 capitales aléatoires

import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";

// Import des capitales (chemin relatif depuis functions)
const CAPITALS = [
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522 },
  { name: "Londres", country: "Royaume-Uni", lat: 51.5074, lng: -0.1278 },
  { name: "Berlin", country: "Allemagne", lat: 52.52, lng: 13.405 },
  { name: "Rome", country: "Italie", lat: 41.9028, lng: 12.4964 },
  { name: "Madrid", country: "Espagne", lat: 40.4168, lng: -3.7038 },
  { name: "Amsterdam", country: "Pays-Bas", lat: 52.3676, lng: 4.9041 },
  { name: "Bruxelles", country: "Belgique", lat: 50.8503, lng: 4.3517 },
  { name: "Vienne", country: "Autriche", lat: 48.2082, lng: 16.3738 },
  { name: "Lisbonne", country: "Portugal", lat: 38.7223, lng: -9.1393 },
  { name: "Athènes", country: "Grèce", lat: 37.9838, lng: 23.7275 },
  { name: "Stockholm", country: "Suède", lat: 59.3293, lng: 18.0686 },
  { name: "Oslo", country: "Norvège", lat: 59.9139, lng: 10.7522 },
  { name: "Copenhague", country: "Danemark", lat: 55.6761, lng: 12.5683 },
  { name: "Helsinki", country: "Finlande", lat: 60.1695, lng: 24.9354 },
  { name: "Moscou", country: "Russie", lat: 55.7558, lng: 37.6173 },
  { name: "Varsovie", country: "Pologne", lat: 52.2297, lng: 21.0122 },
  { name: "Prague", country: "Tchéquie", lat: 50.0755, lng: 14.4378 },
  { name: "Budapest", country: "Hongrie", lat: 47.4979, lng: 19.0402 },
  { name: "Bucarest", country: "Roumanie", lat: 44.4268, lng: 26.1025 },
  { name: "Washington D.C.", country: "États-Unis", lat: 38.9072, lng: -77.0369 },
  { name: "Ottawa", country: "Canada", lat: 45.4215, lng: -75.6972 },
  { name: "Mexico", country: "Mexique", lat: 19.4326, lng: -99.1332 },
  { name: "Brasilia", country: "Brésil", lat: -15.8267, lng: -47.9218 },
  { name: "Buenos Aires", country: "Argentine", lat: -34.6037, lng: -58.3816 },
  { name: "Lima", country: "Pérou", lat: -12.0464, lng: -77.0428 },
  { name: "Bogota", country: "Colombie", lat: 4.711, lng: -74.0721 },
  { name: "Santiago", country: "Chili", lat: -33.4489, lng: -70.6693 },
  { name: "Tokyo", country: "Japon", lat: 35.6762, lng: 139.6503 },
  { name: "Pékin", country: "Chine", lat: 39.9042, lng: 116.4074 },
  { name: "Séoul", country: "Corée du Sud", lat: 37.5665, lng: 126.978 },
  { name: "New Delhi", country: "Inde", lat: 28.6139, lng: 77.209 },
  { name: "Bangkok", country: "Thaïlande", lat: 13.7563, lng: 100.5018 },
  { name: "Singapour", country: "Singapour", lat: 1.3521, lng: 103.8198 },
  { name: "Jakarta", country: "Indonésie", lat: -6.2088, lng: 106.8456 },
  { name: "Hanoï", country: "Vietnam", lat: 21.0285, lng: 105.8542 },
  { name: "Le Caire", country: "Égypte", lat: 30.0444, lng: 31.2357 },
  { name: "Nairobi", country: "Kenya", lat: -1.2864, lng: 36.8172 },
  { name: "Canberra", country: "Australie", lat: -35.2809, lng: 149.13 },
  { name: "Wellington", country: "Nouvelle-Zélande", lat: -41.2865, lng: 174.7762 },
  { name: "Dublin", country: "Irlande", lat: 53.3498, lng: -6.2603 },
  { name: "Berne", country: "Suisse", lat: 46.9481, lng: 7.4474 },
  { name: "Ankara", country: "Turquie", lat: 39.9334, lng: 32.8597 },
  { name: "Téhéran", country: "Iran", lat: 35.6892, lng: 51.389 },
  { name: "Riyad", country: "Arabie Saoudite", lat: 24.7136, lng: 46.6753 },
  { name: "Doha", country: "Qatar", lat: 25.2854, lng: 51.531 },
  { name: "Kyiv", country: "Ukraine", lat: 50.4501, lng: 30.5234 },
  { name: "Belgrade", country: "Serbie", lat: 44.7866, lng: 20.4489 },
  { name: "Zagreb", country: "Croatie", lat: 45.815, lng: 15.9819 },
  { name: "Ljubljana", country: "Slovénie", lat: 46.0569, lng: 14.5058 },
  { name: "Bratislava", country: "Slovaquie", lat: 48.1486, lng: 17.1077 },
];

const selectCapitals = (n = 5) => {
  const shuffled = [...CAPITALS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
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
    const token = randomUUID();
    const capitals = selectCapitals(5);
    const startTime = Date.now();

    // Stocker la session (avec coordonnées secrètes)
    const session = {
      token,
      capitals, // Coordonnées incluses (secrètes côté serveur)
      startTime,
      used: false,
    };

    const store = getStore("sessions");
    await store.setJSON(token, session);

    // Retourner au client (SANS les coordonnées exactes pour anti-triche)
    const clientCapitals = capitals.map((c) => ({
      name: c.name,
      country: c.country,
      // On envoie quand même lat/lng car le client en a besoin pour l'affichage
      // La vraie protection est le recalcul côté serveur
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
