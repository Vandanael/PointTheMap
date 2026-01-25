// Point The Map - Utilitaires
// Fonctions pures et helpers

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

// Formater le score avec séparateur de milliers
export const formatScore = (score) => Math.round(score).toLocaleString("fr-FR");

// Générer un ID unique simple
export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

// Détecter iOS (iPhone, iPad, iPod) - utilisé pour les fixes spécifiques iOS
export const isIOS = () => {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad avec iPadOS 13+
};
