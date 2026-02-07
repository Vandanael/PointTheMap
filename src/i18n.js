// Point The Map - Internationalisation (i18n)
// Support FR / EN

const LANG_STORAGE_KEY = 'ptm_lang';
const PUBLIC_URL = import.meta.env?.VITE_PUBLIC_URL || 'https://pointthemap.net';

/**
 * Minimal localStorage access to avoid core/services dependency from i18n.
 * Uses the same key prefix + JSON encoding as StorageManager.
 */
const readStoredLang = () => {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** @param {string} lang */
const writeStoredLang = (lang) => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify(lang));
    return true;
  } catch {
    return false;
  }
};

const translations = {
  fr: {
    // Start screen
    challenge: '5s Challenge',
    capitalsInfo: '5 capitales · 5 secondes par ville',
    clickToWin: 'Clique sur la carte, gagne des points',
    comingSoon: 'Bientôt disponible',
    start: 'COMMENCER',
    madeBy: 'Par',
    resumePrompt: 'Reprendre votre partie en cours ?',
    resumePromptTitle: 'Reprendre la partie ?',
    resumePromptMessage: 'Une partie en cours a été trouvée.',
    resumePromptResume: 'Reprendre',
    resumePromptDiscard: 'Ignorer',

    // Game Lobby
    selectCategory: 'Choisissez une catégorie',
    capitals: 'Capitales',
    civilizations: 'Civilisations',
    stadiums: 'Stades',
    selectMode: 'Choisissez un mode',
    play: 'JOUER',
    startGame: 'COMMENCER LA PARTIE',

    // Category info
    countriesInfo: '5 pays · 5 secondes par pays',
    civilizationsInfo: '5 civilisations · 5 secondes par civilisation',
    stadiumsInfo: '5 stades · 5 secondes par stade',

    // Share
    share: 'Partager',
    shareCopied: 'Lien copié',
    shareFailed: 'Impossible de partager',
    shareOnAchievement: 'Partager cette réussite',
    shareGameMessage: `Point The Map — Devine les capitales ! ${PUBLIC_URL}`,
    tapToContinue: 'Touchez pour continuer',
    mapLockedHint: 'Carte verrouillée',

    // Stats
    myStats: 'Mes Statistiques',
    stats: {
      gamesPlayed: 'Parties jouées',
      bestClassic: 'Meilleur (Classique)',
      bestDaily: 'Meilleur (Quotidien)',
      avgDistance: 'Distance moyenne',
      perfectRounds: 'Rounds parfaits',
      dailyStreak: 'Série quotidienne',
    },

    // Achievements
    achievement: {
      perfectRound: 'Premier Parfait',
      perfectRoundDesc: 'Moins de 1 km sur un round',
      perfectGame: 'Jeu Parfait',
      perfectGameDesc: '5 rounds parfaits en une partie',
      avgUnder10: 'Expert',
      avgUnder10Desc: 'Moyenne < 10 km',
      avgUnder50: 'Pro',
      avgUnder50Desc: 'Moyenne < 50 km',
      top1pct: 'Élite',
      top1pctDesc: 'Top 1% du classement',
      streak3: 'En Feu',
      streak3Desc: "3 jours d'affilée",
      play10: 'Joueur',
      play10Desc: '10 parties jouées',
      play50: 'Vétéran',
      play50Desc: '50 parties jouées',
      unlocked: 'Succès débloqué !',
    },

    // Game
    round: 'Round',
    score: 'Score',
    find: 'Trouvez',
    getReady: 'Prêt ?',
    clickOnMap: '📍 Cliquez sur la carte',
    nextRoundPreparing: 'Prochain round...',

    // Civilization names (FR)
    civilization: {
      roman_empire: 'Empire romain',
      ancient_egypt: 'Égypte antique',
      ancient_greece: 'Grèce antique',
      maya: 'Mayas',
      aztec: 'Empire aztèque',
      ancient_china: 'Chine antique',
      ming_dynasty: 'Dynastie Ming',
      tang_dynasty: 'Dynastie Tang',
      mughal_empire: 'Empire moghol',
      holy_roman_empire: 'Saint-Empire romain germanique',
      franks: 'Francs (carolingiens)',
      viking_age: 'Âge viking',
      khmer_empire: 'Empire khmer',
      mali_empire: 'Empire du Mali',
      ghana_empire: 'Empire du Ghana',
      abbasid_caliphate: 'Califat abbasside',
      umayyad_caliphate: 'Califat omeyyade',
      macedonia: 'Macédoine (Alexandre)',
      carthage: 'Carthage',
      assyria: 'Assyrie',
      maurya_empire: 'Empire maurya',
      gupta_empire: 'Empire Gupta',
      ancient_rome: 'Rome antique',
      ancient_india: 'Inde antique',
      venetian_republic: 'République de Venise',
      inca: 'Empire inca',
      persian_empire: 'Empire perse',
      ottoman_empire: 'Empire ottoman',
      mongol_empire: 'Empire mongol',
      byzantine_empire: 'Empire byzantin',
      mesopotamia: 'Mésopotamie',
      indus_valley: "Civilisation de l'Indus",
      phoenicia: 'Phénicie',
      ptolemaic_egypt: 'Égypte ptolémaïque',
      seljuk_empire: 'Empire seldjoukide',
      safavid_empire: 'Empire safavide',
      teotihuacan: 'Teotihuacan',
      nubia: 'Nubie',
      axum: "Royaume d'Aksoum",
      songhai_empire: 'Empire songhaï',
      great_zimbabwe: 'Grand Zimbabwe',
      benin_empire: 'Empire du Bénin',
      olmec: 'Olmèques',
      qin_dynasty: 'Dynastie Qin',
      hittites: 'Hittites',
      tiwanaku: 'Tiwanaku',
      toltec: 'Empire toltèque',
      srivijaya: 'Srivijaya',
      tibetan_empire: 'Empire tibétain',
      chimu: 'Empire Chimú',
      moche: 'Moche',
      wari: 'Empire Wari',
      chavin: 'Chavín',
      nazca: 'Nazca',
      silla: 'Silla',
      goryeo: 'Goryeo',
      song_dynasty: 'Dynastie Song',
      yuan_dynasty: 'Dynastie Yuan',
      timurid_empire: 'Empire timouride',
      kievan_rus: "Rus' de Kiev",
      mamluk_sultanate: 'Sultanat mamelouk',
      fatimid_caliphate: 'Califat fatimide',
      chola_dynasty: 'Dynastie Chola',
    },

    // Results
    distance: 'Distance',
    distanceUnknown: 'Distance inconnue',
    pointsEarned: 'Points gagnés',
    base: 'Base',
    speedBonus: 'Bonus vitesse',
    continue: 'CONTINUER',
    seeResults: 'VOIR RÉSULTATS',
    timeUp: 'Temps écoulé',
    tooSlow: 'Trop lent !',
    category: {
      perfect: 'Parfait',
      excellent: 'Excellent',
      good: 'Bien',
      fair: 'Correct',
      poor: "Continue d'essayer",
      unknown: 'Inconnu',
    },

    // Game over
    gameOver: 'Game Over',
    finalScore: 'Score final',
    yourPseudo: 'Votre pseudo (3-5 lettres)',
    pseudoHint: 'Lettres uniquement, 3-5 caractères',
    pseudoError: '3 à 5 lettres uniquement (A-Z)',
    save: 'ENREGISTRER',
    saving: 'ENREGISTREMENT...',
    replayNoSave: 'REJOUER SANS SAUVEGARDER',
    replay: 'REJOUER',
    waitSeconds: 'Attendez {{seconds}}s',
    loadingMap: 'OUVERTURE DE LA CARTE...',

    // Final
    top50: '🏆 Top 50 !',
    scoreSaved: 'Score enregistré !',
    newPersonalBest: 'NOUVEAU RECORD PERSONNEL',
    rank: 'Rang',

    // Leaderboard
    leaderboardTitle: '🏆 Classement',
    noScores: 'Aucun score enregistré',
    close: 'FERMER',
    classic: 'Classique',
    daily: 'Quotidien',
    countries: 'Pays',

    // Leaderboard empty state
    leaderboard: {
      empty: {
        title: 'Aucun score',
        description: 'Soyez le premier à jouer !',
      },
    },

    // Pseudo locked dialog
    pseudoLocked: {
      title: 'Déjà enregistré !',
      message: 'Cette machine joue sous le nom {{pseudo}}.',
      rule: 'Règle du leaderboard : un pseudo par joueur.',
    },
    ok: 'OK',

    // Offline/Online status
    offline: {
      message: 'Vous êtes hors ligne. Certaines fonctionnalités peuvent ne pas fonctionner.',
    },
    online: {
      message: 'Vous êtes de retour en ligne !',
    },

    // Help modal
    help: {
      title: 'Comment jouer',
      howToPlay: {
        title: 'Comment jouer',
        description:
          'Localisez les capitales sur la carte en 5 secondes. Plus vous êtes précis, plus vous gagnez de points !',
      },
      scoring: {
        title: 'Système de points',
        description: 'Vos points dépendent de la distance entre votre clic et la vraie position :',
        perfect: '< 0,1 km = 5000 pts',
        excellent: '< 50 km = 4000-5000 pts',
        good: '< 200 km = 2000-4000 pts',
        fair: '< 1000 km = 500-2000 pts',
      },
      modes: {
        title: 'Modes de jeu',
        classic: 'Jouez quand vous voulez avec des capitales aléatoires',
        daily: 'Un défi quotidien identique pour tous avec bonus de vitesse',
        countries: 'Placez des pays entiers au lieu de capitales',
        civilizations: 'Trouvez les zones des civilisations sur la carte',
        stadiums: 'Localisez les stades sur la carte',
      },
      tips: {
        title: 'Astuces',
        tip1: 'Le bonus de vitesse peut doubler vos points en mode Quotidien',
        tip2: 'Zoomez sur la carte pour plus de précision',
        tip3: 'Les capitales populaires apparaissent plus souvent',
      },
    },

    // Errors
    error: {
      title: 'Erreur',
      tooFast: '⏳ Veuillez attendre avant de soumettre à nouveau',
      network: '❌ Erreur réseau. Réessayez.',
      timeout: "⏰ Délai d'attente dépassé",
      generic: '❌ Une erreur est survenue',
      rateLimit: 'Trop de requêtes. Veuillez patienter quelques instants avant de réessayer.',
      forbidden: 'Accès refusé. Veuillez recommencer une partie.',
      sessionExpired: 'Session expirée. Veuillez recommencer une partie.',
      pseudoTaken: 'Ce pseudo est déjà utilisé depuis cette adresse IP.',
      serverError:
        'Le serveur rencontre des difficultés. Veuillez réessayer dans quelques instants.',
      connectionFailed: 'Impossible de contacter le serveur. Vérifiez votre connexion internet.',
      networkError: 'Erreur de connexion. Vérifiez que vous êtes bien connecté à internet.',
      loadTimeout: 'Le chargement a pris trop de temps. Veuillez réessayer.',
      leaderboardUnavailable:
        'Le classement est temporairement indisponible. Réessayez dans quelques instants.',
      submitFailed:
        "Impossible d'enregistrer votre score pour le moment. Il sera envoyé automatiquement plus tard.",
      startFailed: 'Impossible de démarrer la partie. Veuillez réessayer.',
      retry: 'Réessayer',
      leaderboardRetry: 'Le classement est temporairement indisponible.',
      countriesLoadFailed: 'Impossible de charger les données des pays. Veuillez réessayer.',
      civilizationsLoadFailed:
        'Impossible de charger les données des civilisations. Veuillez réessayer.',
      mapLoadFailed: "Impossible d'initialiser la carte. Veuillez réessayer.",
      targetNotFoundCapital: 'Erreur: capitale introuvable',
      targetNotFoundCountry: 'Erreur: pays introuvable',
      targetNotFoundStadium: 'Erreur: stade introuvable',
      targetNotFoundCivilization: 'Erreur: civilisation introuvable',
      submitError: 'Erreur lors de la soumission',
      noTargetsCapitals: 'Aucune capitale disponible',
      noTargetsCountries: 'Aucun pays disponible',
      noTargetsStadiums: 'Aucun stade disponible',
      noTargetsCivilizations: 'Aucune civilisation disponible',
    },
  },

  en: {
    // Start screen
    challenge: '5s Challenge',
    capitalsInfo: '5 capitals · 5 seconds per city',
    clickToWin: 'Click on the map, earn points',
    comingSoon: 'Coming soon',
    start: 'START',
    madeBy: 'Made by',
    resumePrompt: 'Resume your in-progress game?',
    resumePromptTitle: 'Resume game?',
    resumePromptMessage: 'We found an in-progress game.',
    resumePromptResume: 'Resume',
    resumePromptDiscard: 'Discard',

    // Game Lobby
    selectCategory: 'Select a category',
    capitals: 'Capitals',
    civilizations: 'Civilizations',
    stadiums: 'Stadiums',
    selectMode: 'Select a mode',
    play: 'PLAY',
    startGame: 'START GAME',

    // Category info
    countriesInfo: '5 countries · 5 seconds per country',
    civilizationsInfo: '5 civilizations · 5 seconds per civilization',
    stadiumsInfo: '5 stadiums · 5 seconds per stadium',

    // Share
    share: 'Share',
    shareCopied: 'Link copied',
    shareFailed: 'Unable to share',
    shareOnAchievement: 'Share this achievement',
    shareGameMessage: `Point The Map — Try to guess the capitals! ${PUBLIC_URL}`,
    tapToContinue: 'Tap to continue',
    mapLockedHint: 'Map locked',

    // Stats
    myStats: 'My Stats',
    stats: {
      gamesPlayed: 'Games played',
      bestClassic: 'Best (Classic)',
      bestDaily: 'Best (Daily)',
      avgDistance: 'Average distance',
      perfectRounds: 'Perfect rounds',
      dailyStreak: 'Daily streak',
    },

    // Achievements
    achievement: {
      perfectRound: 'First Perfect',
      perfectRoundDesc: 'Less than 1 km on a round',
      perfectGame: 'Perfect Game',
      perfectGameDesc: '5 perfect rounds in one game',
      avgUnder10: 'Expert',
      avgUnder10Desc: 'Average < 10 km',
      avgUnder50: 'Pro',
      avgUnder50Desc: 'Average < 50 km',
      top1pct: 'Elite',
      top1pctDesc: 'Top 1% of leaderboard',
      streak3: 'On Fire',
      streak3Desc: '3 days in a row',
      play10: 'Player',
      play10Desc: '10 games played',
      play50: 'Veteran',
      play50Desc: '50 games played',
      unlocked: 'Achievement unlocked!',
    },

    // Game
    round: 'Round',
    score: 'Score',
    find: 'Find',
    getReady: 'Get Ready!',
    clickOnMap: '📍 Click on the map',
    nextRoundPreparing: 'Next round...',

    // Civilization names (EN)
    civilization: {
      roman_empire: 'Roman Empire',
      ancient_egypt: 'Ancient Egypt',
      ancient_greece: 'Ancient Greece',
      maya: 'Maya',
      aztec: 'Aztec Empire',
      ancient_china: 'Ancient China',
      ming_dynasty: 'Ming Dynasty',
      tang_dynasty: 'Tang Dynasty',
      mughal_empire: 'Mughal Empire',
      holy_roman_empire: 'Holy Roman Empire',
      franks: 'Franks (Carolingian)',
      viking_age: 'Viking Age',
      khmer_empire: 'Khmer Empire',
      mali_empire: 'Mali Empire',
      ghana_empire: 'Ghana Empire',
      abbasid_caliphate: 'Abbasid Caliphate',
      umayyad_caliphate: 'Umayyad Caliphate',
      macedonia: 'Macedonia (Alexander)',
      carthage: 'Carthage',
      assyria: 'Assyria',
      maurya_empire: 'Maurya Empire',
      gupta_empire: 'Gupta Empire',
      ancient_rome: 'Ancient Rome',
      ancient_india: 'Ancient India',
      venetian_republic: 'Venetian Republic',
      inca: 'Inca Empire',
      persian_empire: 'Persian Empire',
      ottoman_empire: 'Ottoman Empire',
      mongol_empire: 'Mongol Empire',
      byzantine_empire: 'Byzantine Empire',
      mesopotamia: 'Mesopotamia',
      indus_valley: 'Indus Valley',
      phoenicia: 'Phoenicia',
      ptolemaic_egypt: 'Ptolemaic Egypt',
      seljuk_empire: 'Seljuk Empire',
      safavid_empire: 'Safavid Empire',
      teotihuacan: 'Teotihuacan',
      nubia: 'Nubia',
      axum: 'Kingdom of Axum',
      songhai_empire: 'Songhai Empire',
      great_zimbabwe: 'Great Zimbabwe',
      benin_empire: 'Benin Empire',
      olmec: 'Olmec',
      qin_dynasty: 'Qin Dynasty',
      hittites: 'Hittites',
      tiwanaku: 'Tiwanaku',
      toltec: 'Toltec Empire',
      srivijaya: 'Srivijaya',
      tibetan_empire: 'Tibetan Empire',
      chimu: 'Chimú Empire',
      moche: 'Moche',
      wari: 'Wari Empire',
      chavin: 'Chavin',
      nazca: 'Nazca',
      silla: 'Silla',
      goryeo: 'Goryeo',
      song_dynasty: 'Song Dynasty',
      yuan_dynasty: 'Yuan Dynasty',
      timurid_empire: 'Timurid Empire',
      kievan_rus: 'Kievan Rus',
      mamluk_sultanate: 'Mamluk Sultanate',
      fatimid_caliphate: 'Fatimid Caliphate',
      chola_dynasty: 'Chola Dynasty',
    },

    // Results
    distance: 'Distance',
    distanceUnknown: 'Unknown distance',
    pointsEarned: 'Points earned',
    base: 'Base',
    speedBonus: 'Speed bonus',
    continue: 'CONTINUE',
    seeResults: 'SEE RESULTS',
    timeUp: "Time's up",
    tooSlow: 'Too slow!',
    category: {
      perfect: 'Perfect',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Keep trying',
      unknown: 'Unknown',
    },

    // Game over
    gameOver: 'Game Over',
    finalScore: 'Final score',
    yourPseudo: 'Your pseudo (3-5 letters)',
    pseudoHint: 'Letters only, 3-5 characters',
    pseudoError: '3 to 5 letters only (A-Z)',
    save: 'SAVE',
    saving: 'SAVING...',
    replayNoSave: 'REPLAY WITHOUT SAVING',
    replay: 'REPLAY',
    waitSeconds: 'Wait {{seconds}}s',
    loadingMap: 'UNFOLDING THE MAP...',

    // Final
    top50: '🏆 Top 50!',
    scoreSaved: 'Score saved!',
    newPersonalBest: 'NEW PERSONAL BEST',
    rank: 'Rank',

    // Leaderboard
    leaderboardTitle: '🏆 Leaderboard',
    noScores: 'No scores recorded',
    close: 'CLOSE',
    classic: 'Classic',
    daily: 'Daily',
    countries: 'Countries',

    // Leaderboard empty state
    leaderboard: {
      empty: {
        title: 'No scores yet',
        description: 'Be the first to play!',
      },
    },

    // Pseudo locked dialog
    pseudoLocked: {
      title: 'Already registered!',
      message: 'This machine plays under the name {{pseudo}}.',
      rule: 'Leaderboard rule: one nickname per player.',
    },
    ok: 'OK',

    // Offline/Online status
    offline: {
      message: 'You are offline. Some features may not work.',
    },
    online: {
      message: 'You are back online!',
    },

    // Help modal
    help: {
      title: 'How to Play',
      howToPlay: {
        title: 'How to Play',
        description:
          'Locate capitals on the map in 5 seconds. The more accurate you are, the more points you earn!',
      },
      scoring: {
        title: 'Scoring System',
        description:
          'Your points depend on the distance between your click and the actual location:',
        perfect: '< 0.1 km = 5000 pts',
        excellent: '< 50 km = 4000-5000 pts',
        good: '< 200 km = 2000-4000 pts',
        fair: '< 1000 km = 500-2000 pts',
      },
      modes: {
        title: 'Game Modes',
        classic: 'Play anytime with random capitals',
        daily: 'Daily challenge identical for everyone with speed bonus',
        countries: 'Place entire countries instead of capitals',
        civilizations: 'Find civilization zones on the map',
        stadiums: 'Locate stadiums on the map',
      },
      tips: {
        title: 'Tips',
        tip1: 'Speed bonus can double your points in Daily mode',
        tip2: 'Zoom on the map for better accuracy',
        tip3: 'Popular capitals appear more often',
      },
    },

    // Errors
    error: {
      title: 'Error',
      tooFast: '⏳ Please wait before submitting again',
      network: '❌ Network error. Please retry.',
      timeout: '⏰ Request timeout',
      generic: '❌ An error occurred',
      rateLimit: 'Too many requests. Please wait a few moments before trying again.',
      forbidden: 'Access denied. Please start a new game.',
      sessionExpired: 'Session expired. Please start a new game.',
      pseudoTaken: 'This nickname is already in use from this IP address.',
      serverError: 'The server is experiencing difficulties. Please try again in a few moments.',
      connectionFailed: 'Unable to contact the server. Check your internet connection.',
      networkError: 'Connection error. Check that you are connected to the internet.',
      loadTimeout: 'Loading took too long. Please try again.',
      leaderboardUnavailable:
        'The leaderboard is temporarily unavailable. Try again in a few moments.',
      submitFailed: 'Unable to save your score at the moment. It will be sent automatically later.',
      startFailed: 'Unable to start the game. Please try again.',
      retry: 'Retry',
      leaderboardRetry: 'The leaderboard is temporarily unavailable.',
      countriesLoadFailed: 'Failed to load countries data. Please try again.',
      civilizationsLoadFailed: 'Failed to load civilizations data. Please try again.',
      mapLoadFailed: 'Failed to initialize map. Please try again.',
      targetNotFoundCapital: 'Error: capital not found',
      targetNotFoundCountry: 'Error: country not found',
      targetNotFoundStadium: 'Error: stadium not found',
      targetNotFoundCivilization: 'Error: civilization not found',
      submitError: 'Error while submitting',
      noTargetsCapitals: 'No capitals available',
      noTargetsCountries: 'No countries available',
      noTargetsStadiums: 'No stadiums available',
      noTargetsCivilizations: 'No civilizations available',
    },
  },
};

let currentLang = null;

const initLang = () => {
  if (currentLang === null) {
    currentLang = readStoredLang() || 'fr';
    // Set HTML lang attribute on init
    document.documentElement.lang = currentLang;
  }
};

export const t = (key, vars = {}) => {
  initLang();

  // Handle nested keys (e.g., "stats.gamesPlayed")
  let value;
  if (key.includes('.')) {
    const parts = key.split('.');
    value = translations[currentLang];
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return key;
    }
  } else {
    value = translations[currentLang][key] || key;
  }

  // Replace {{variable}} with vars
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return vars[varName] !== undefined ? vars[varName] : match;
    });
  }

  return value;
};

export const getLang = () => {
  initLang();
  return currentLang;
};

const setLang = (lang) => {
  if (translations[lang]) {
    currentLang = lang;
    writeStoredLang(lang);
    // Update HTML lang attribute for accessibility/SEO
    document.documentElement.lang = lang;
  }
};

export const toggleLang = () => {
  initLang(); // Initialize currentLang before using it
  const newLang = currentLang === 'fr' ? 'en' : 'fr';
  setLang(newLang);
  return newLang;
};

/**
 * Get localized civilization name (EN/FR). Falls back to fallback if key missing.
 * @param {string} id - Civilization id (e.g. 'roman_empire')
 * @param {string} [fallback=''] - Fallback when no translation
 * @returns {string}
 */
export const getCivilizationName = (id, fallback = '') => {
  const key = 'civilization.' + id;
  const out = t(key);
  return out === key ? fallback : out;
};
