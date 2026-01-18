// Point The Map - Utilitaires
// Fonctions pures et helpers

import { VALIDATION } from "./config.js";

// Conversion degrés → radians
const toRad = (deg) => (deg * Math.PI) / 180;

// Calcul distance Haversine entre deux coordonnées (km)
export const haversine = ([lat1, lon1], [lat2, lon2]) => {
  const [dLat, dLon] = [lat2 - lat1, lon2 - lon1].map(toRad);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

// Validation pseudo (3-5 lettres capitales)
export const validatePseudo = (pseudo) => VALIDATION.PSEUDO_REGEX.test(pseudo);

// Clamp une valeur entre min et max
export const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// Sélection aléatoire de n éléments d'un array
export const randomSelect = (array, n) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
};

// Formater le temps en secondes avec décimale
export const formatTime = (ms) => (ms / 1000).toFixed(1);

// Formater le score avec séparateur de milliers
export const formatScore = (score) => Math.round(score).toLocaleString("fr-FR");

// Générer un ID unique simple
export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);
