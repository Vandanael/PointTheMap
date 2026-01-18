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
  },
};

let currentLang = storage.get("lang") || "fr";

export const t = (key) => translations[currentLang][key] || key;

export const getLang = () => currentLang;

export const setLang = (lang) => {
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
