// Point The Map - Internationalisation (i18n)
// Support FR / EN

import { storage } from "./services/storage.js";

const translations = {
  fr: {
    // Start screen
    challenge: "5s Challenge",
    capitalsInfo: "5 capitales · 5 secondes par ville",
    clickToWin: "Clique sur la carte, gagne des points",
    start: "COMMENCER",
    madeBy: "Made by",

    // Game
    round: "Round",
    score: "Score",
    find: "Trouvez",
    clickOnMap: "📍 Cliquez sur la carte",

    // Results
    distance: "Distance",
    pointsEarned: "Points gagnés",
    continue: "CONTINUER",
    seeResults: "VOIR RÉSULTATS",
    timeUp: "Temps écoulé",
    tooSlow: "Trop lent !",

    // Game over
    gameOver: "Game Over",
    finalScore: "Score final",
    yourPseudo: "Votre pseudo (3-5 lettres)",
    pseudoHint: "Lettres uniquement, 3-5 caractères",
    pseudoError: "3 à 5 lettres uniquement (A-Z)",
    save: "ENREGISTRER",
    replayNoSave: "REJOUER SANS SAUVEGARDER",
    replay: "REJOUER",

    // Final
    top50: "🏆 Top 50 !",
    scoreSaved: "Score enregistré !",
    rank: "Rang",

    // Leaderboard
    leaderboard: "🏆 Classement",
    noScores: "Aucun score enregistré",
    close: "FERMER",
    classic: "Classique",
    daily: "Quotidien",

    // Errors
    error: {
      tooFast: "⏳ Veuillez attendre avant de soumettre à nouveau",
      network: "❌ Erreur réseau. Réessayez.",
      timeout: "⏰ Délai d'attente dépassé",
      generic: "❌ Une erreur est survenue",
      rateLimit: "Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.",
      forbidden: "Accès refusé. Veuillez recommencer une partie.",
      sessionExpired: "Session expirée. Veuillez recommencer une partie.",
      pseudoTaken: "Ce pseudo est déjà utilisé depuis cette adresse IP.",
      serverError: "Le serveur rencontre des difficultés. Veuillez réessayer dans quelques instants.",
      connectionFailed: "Impossible de contacter le serveur. Vérifiez votre connexion internet.",
      networkError: "Erreur de connexion. Vérifiez que vous êtes bien connecté à internet.",
      loadTimeout: "Le chargement a pris trop de temps. Veuillez réessayer.",
      leaderboardUnavailable: "Le classement est temporairement indisponible. Réessayez dans quelques instants.",
      submitFailed: "Impossible d'enregistrer votre score pour le moment. Il sera envoyé automatiquement plus tard.",
      startFailed: "Impossible de démarrer la partie. Veuillez réessayer.",
      retry: "Réessayer",
      leaderboardRetry: "Le classement est temporairement indisponible.",
    },
  },

  en: {
    // Start screen
    challenge: "5s Challenge",
    capitalsInfo: "5 capitals · 5 seconds per city",
    clickToWin: "Click on the map, earn points",
    start: "START",
    madeBy: "Made by",

    // Game
    round: "Round",
    score: "Score",
    find: "Find",
    clickOnMap: "📍 Click on the map",

    // Results
    distance: "Distance",
    pointsEarned: "Points earned",
    continue: "CONTINUE",
    seeResults: "SEE RESULTS",
    timeUp: "Time's up",
    tooSlow: "Too slow!",

    // Game over
    gameOver: "Game Over",
    finalScore: "Final score",
    yourPseudo: "Your pseudo (3-5 letters)",
    pseudoHint: "Letters only, 3-5 characters",
    pseudoError: "3 to 5 letters only (A-Z)",
    save: "SAVE",
    replayNoSave: "REPLAY WITHOUT SAVING",
    replay: "REPLAY",

    // Final
    top50: "🏆 Top 50!",
    scoreSaved: "Score saved!",
    rank: "Rank",

    // Leaderboard
    leaderboard: "🏆 Leaderboard",
    noScores: "No scores recorded",
    close: "CLOSE",
    classic: "Classic",
    daily: "Daily",

    // Errors
    error: {
      tooFast: "⏳ Please wait before submitting again",
      network: "❌ Network error. Please retry.",
      timeout: "⏰ Request timeout",
      generic: "❌ An error occurred",
      rateLimit: "Too many requests. Please wait a few moments before trying again.",
      forbidden: "Access denied. Please start a new game.",
      sessionExpired: "Session expired. Please start a new game.",
      pseudoTaken: "This nickname is already in use from this IP address.",
      serverError: "The server is experiencing difficulties. Please try again in a few moments.",
      connectionFailed: "Unable to contact the server. Check your internet connection.",
      networkError: "Connection error. Check that you are connected to the internet.",
      loadTimeout: "Loading took too long. Please try again.",
      leaderboardUnavailable: "The leaderboard is temporarily unavailable. Try again in a few moments.",
      submitFailed: "Unable to save your score at the moment. It will be sent automatically later.",
      startFailed: "Unable to start the game. Please try again.",
      retry: "Retry",
      leaderboardRetry: "The leaderboard is temporarily unavailable.",
    },
  },
};

let currentLang = null;

const initLang = () => {
  if (currentLang === null) {
    currentLang = storage.get("lang") || "fr";
  }
};

export const t = (key) => {
  initLang();
  return translations[currentLang][key] || key;
};

export const getLang = () => {
  initLang();
  return currentLang;
};

const setLang = (lang) => {
  if (translations[lang]) {
    currentLang = lang;
    storage.set("lang", lang);
  }
};

export const toggleLang = () => {
  const newLang = currentLang === "fr" ? "en" : "fr";
  setLang(newLang);
  return newLang;
};
