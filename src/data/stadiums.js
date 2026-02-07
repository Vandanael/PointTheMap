/**
 * PointTheMap - World Stadiums Database
 * ======================================
 * ~45 stades mondiaux emblématiques
 *
 * Structure:
 * - name: Nom du stade
 * - city: Ville où se trouve le stade
 * - country: Nom du pays
 * - lat: Latitude (format décimal)
 * - lng: Longitude (format décimal)
 * - popular: true = stade très connu mondialement
 *            false = stade moins connu
 *
 * @typedef {{ name: string, city: string, country: string, lat: number, lng: number, popular: boolean }} StadiumEntry
 */

import { logger } from '../utils/logger.js';

export const stadiums = [
  // ── Popular : club icons ──
  {
    name: 'Santiago Bernabéu',
    city: 'Madrid',
    country: 'Espagne',
    lat: 40.4531,
    lng: -3.6883,
    popular: true,
  },
  {
    name: 'Camp Nou',
    city: 'Barcelona',
    country: 'Espagne',
    lat: 41.3851,
    lng: 2.1734,
    popular: true,
  },
  {
    name: 'Allianz Arena',
    city: 'München',
    country: 'Allemagne',
    lat: 48.2081,
    lng: 11.5752,
    popular: true,
  },
  { name: 'San Siro', city: 'Milano', country: 'Italie', lat: 45.4773, lng: 9.1357, popular: true },
  {
    name: 'Wembley Stadium',
    city: 'London',
    country: 'Royaume-Uni',
    lat: 51.5555,
    lng: -0.3088,
    popular: true,
  },
  {
    name: 'Old Trafford',
    city: 'Manchester',
    country: 'Royaume-Uni',
    lat: 53.4631,
    lng: -2.2496,
    popular: true,
  },
  {
    name: 'Anfield',
    city: 'Liverpool',
    country: 'Royaume-Uni',
    lat: 53.4508,
    lng: -2.9604,
    popular: true,
  },
  {
    name: 'Olympiastadion',
    city: 'Berlin',
    country: 'Allemagne',
    lat: 52.5147,
    lng: 13.2406,
    popular: true,
  },
  {
    name: 'Maracanã',
    city: 'Rio de Janeiro',
    country: 'Brésil',
    lat: -22.9068,
    lng: -43.1729,
    popular: true,
  },
  {
    name: 'Azteca',
    city: 'México',
    country: 'Mexique',
    lat: 19.3032,
    lng: -99.1505,
    popular: true,
  },
  {
    name: 'Emirates Stadium',
    city: 'London',
    country: 'Royaume-Uni',
    lat: 51.6063,
    lng: -0.0458,
    popular: true,
  },
  {
    name: 'Etihad Stadium',
    city: 'Manchester',
    country: 'Royaume-Uni',
    lat: 53.4723,
    lng: -2.2345,
    popular: true,
  },
  {
    name: 'Allianz Stadium',
    city: 'Turin',
    country: 'Italie',
    lat: 45.0703,
    lng: 7.794,
    popular: true,
  },
  {
    name: 'Signal Iduna Park',
    city: 'Dortmund',
    country: 'Allemagne',
    lat: 51.4657,
    lng: 7.4623,
    popular: true,
  },
  {
    name: 'Tottenham Hotspur Stadium',
    city: 'London',
    country: 'Royaume-Uni',
    lat: 51.6134,
    lng: -0.1169,
    popular: true,
  },
  {
    name: 'Stamford Bridge',
    city: 'London',
    country: 'Royaume-Uni',
    lat: 51.4816,
    lng: -0.1909,
    popular: true,
  },
  {
    name: 'Parc des Princes',
    city: 'Paris',
    country: 'France',
    lat: 48.8384,
    lng: 2.2536,
    popular: true,
  },
  {
    name: 'Vélodrome',
    city: 'Marseille',
    country: 'France',
    lat: 43.2965,
    lng: 5.3698,
    popular: true,
  },
  {
    name: 'Estádio da Luz',
    city: 'Lisboa',
    country: 'Portugal',
    lat: 38.7254,
    lng: -9.1584,
    popular: true,
  },
  {
    name: 'Stadio Olimpico',
    city: 'Rome',
    country: 'Italie',
    lat: 41.9028,
    lng: 12.4534,
    popular: true,
  },
  {
    name: "St James' Park",
    city: 'Newcastle',
    country: 'Royaume-Uni',
    lat: 54.9591,
    lng: -1.6959,
    popular: true,
  },
  {
    name: 'Celtic Park',
    city: 'Glasgow',
    country: 'Royaume-Uni',
    lat: 55.8553,
    lng: -4.289,
    popular: true,
  },
  {
    name: 'Johan Cruyff Arena',
    city: 'Amsterdam',
    country: 'Pays-Bas',
    lat: 52.374,
    lng: 4.914,
    popular: true,
  },
  {
    name: 'La Bombonera',
    city: 'Buenos Aires',
    country: 'Argentine',
    lat: -34.6036,
    lng: -58.3741,
    popular: true,
  },
  {
    name: 'Estadio Monumental',
    city: 'Buenos Aires',
    country: 'Argentine',
    lat: -34.5535,
    lng: -58.3819,
    popular: true,
  },
  // ── Popular : national stadiums ──
  {
    name: 'Stade de France',
    city: 'Saint-Denis',
    country: 'France',
    lat: 48.9244,
    lng: 2.3601,
    popular: true,
  },
  {
    name: 'Hampden Park',
    city: 'Glasgow',
    country: 'Royaume-Uni',
    lat: 55.8226,
    lng: -4.2519,
    popular: true,
  },
  {
    name: 'Puskás Arena',
    city: 'Budapest',
    country: 'Hongrie',
    lat: 47.5012,
    lng: 19.0339,
    popular: true,
  },
  {
    name: 'King Baudouin Stadium',
    city: 'Brussels',
    country: 'Belgique',
    lat: 50.8458,
    lng: 4.3944,
    popular: true,
  },
  {
    name: 'Croke Park',
    city: 'Dublin',
    country: 'Irlande',
    lat: 53.3498,
    lng: -6.2603,
    popular: true,
  },
  // ── Popular : World Cup & Olympic finals ──
  {
    name: 'Luzhniki Stadium',
    city: 'Moscow',
    country: 'Russie',
    lat: 55.7306,
    lng: 37.6151,
    popular: true,
  },
  {
    name: 'Lusail Stadium',
    city: 'Lusail',
    country: 'Qatar',
    lat: 26.3506,
    lng: 51.5074,
    popular: true,
  },
  {
    name: 'FNB Stadium',
    city: 'Johannesburg',
    country: 'Afrique du Sud',
    lat: -26.238,
    lng: 27.8855,
    popular: true,
  },
  {
    name: 'Rose Bowl',
    city: 'Pasadena',
    country: 'États-Unis',
    lat: 34.1613,
    lng: -118.1513,
    popular: true,
  },
  {
    name: 'MetLife Stadium',
    city: 'East Rutherford',
    country: 'États-Unis',
    lat: 40.8135,
    lng: -74.0745,
    popular: true,
  },
  {
    name: 'SoFi Stadium',
    city: 'Inglewood',
    country: 'États-Unis',
    lat: 33.9535,
    lng: -118.3392,
    popular: true,
  },
  {
    name: 'Nissan Stadium',
    city: 'Yokohama',
    country: 'Japon',
    lat: 35.3067,
    lng: 139.6433,
    popular: true,
  },
  {
    name: 'Seoul World Cup Stadium',
    city: 'Seoul',
    country: 'Corée du Sud',
    lat: 37.5665,
    lng: 126.978,
    popular: true,
  },
  {
    name: 'National Stadium',
    city: 'Tokyo',
    country: 'Japon',
    lat: 35.6762,
    lng: 139.71,
    popular: true,
  },
  {
    name: 'Green Point Stadium',
    city: 'Cape Town',
    country: 'Afrique du Sud',
    lat: -33.9042,
    lng: 18.4242,
    popular: true,
  },
  {
    name: 'Loftus Versfeld',
    city: 'Pretoria',
    country: 'Afrique du Sud',
    lat: -25.7479,
    lng: 28.2293,
    popular: true,
  },
  {
    name: 'Al Bayt Stadium',
    city: 'Al Khor',
    country: 'Qatar',
    lat: 25.6827,
    lng: 51.3217,
    popular: true,
  },
  {
    name: 'Estadio Centenario',
    city: 'Montevideo',
    country: 'Uruguay',
    lat: -34.9028,
    lng: -56.1856,
    popular: true,
  },

  // ── Obscure (well-known in their league / region, less so globally) ──
  // --- Espagne ---
  {
    name: 'San Mamés',
    city: 'Bilbao',
    country: 'Espagne',
    lat: 43.2644,
    lng: -1.5011,
    popular: false,
  },
  {
    name: 'Mestalla',
    city: 'Valencia',
    country: 'Espagne',
    lat: 39.4746,
    lng: -0.3764,
    popular: false,
  },
  {
    name: 'La Romareda',
    city: 'Zaragoza',
    country: 'Espagne',
    lat: 40.4636,
    lng: -0.8118,
    popular: false,
  },
  {
    name: 'Anoeta',
    city: 'San Sebastián',
    country: 'Espagne',
    lat: 43.37,
    lng: -1.8494,
    popular: false,
  },
  {
    name: 'Estadio La Cartuja',
    city: 'Sevilla',
    country: 'Espagne',
    lat: 37.3776,
    lng: -5.9612,
    popular: false,
  },
  // --- Portugal ---
  {
    name: 'José Alvalade',
    city: 'Lisboa',
    country: 'Portugal',
    lat: 38.7356,
    lng: -9.1618,
    popular: false,
  },
  {
    name: 'Estádio do Dragão',
    city: 'Porto',
    country: 'Portugal',
    lat: 41.1725,
    lng: -8.6653,
    popular: false,
  },
  {
    name: 'Algarve Estádio',
    city: 'Faro',
    country: 'Portugal',
    lat: 37.0168,
    lng: -7.9724,
    popular: false,
  },
  // --- Allemagne ---
  {
    name: 'Deutsche Bank Park',
    city: 'Frankfurt',
    country: 'Allemagne',
    lat: 50.07,
    lng: 8.6387,
    popular: false,
  },
  {
    name: 'Merkur Spiel-Arena',
    city: 'Düsseldorf',
    country: 'Allemagne',
    lat: 51.2267,
    lng: 6.7806,
    popular: false,
  },
  {
    name: 'Weserstadion',
    city: 'Bremen',
    country: 'Allemagne',
    lat: 53.0833,
    lng: 8.8,
    popular: false,
  },
  {
    name: 'Dreisamstadion',
    city: 'Freiburg',
    country: 'Allemagne',
    lat: 48.0081,
    lng: 7.8853,
    popular: false,
  },
  { name: 'Tivoli', city: 'Köln', country: 'Allemagne', lat: 50.9375, lng: 6.9603, popular: false },
  {
    name: 'Kessler Wood',
    city: 'Villingen',
    country: 'Allemagne',
    lat: 48.07,
    lng: 8.46,
    popular: false,
  },
  {
    name: 'Bernstedt Arena',
    city: 'Halle',
    country: 'Allemagne',
    lat: 51.48,
    lng: 11.975,
    popular: false,
  },
  // --- Italie ---
  {
    name: 'Stadio Diego Armando Maradona',
    city: 'Napoli',
    country: 'Italie',
    lat: 40.8518,
    lng: 14.2681,
    popular: false,
  },
  {
    name: 'Gewiss Stadium',
    city: 'Bergamo',
    country: 'Italie',
    lat: 45.6869,
    lng: 9.6774,
    popular: false,
  },
  {
    name: 'Stadio Artemio Franchi',
    city: 'Firenze',
    country: 'Italie',
    lat: 43.7489,
    lng: 11.2525,
    popular: false,
  },
  // --- France ---
  {
    name: 'Groupama Stadium',
    city: 'Lyon',
    country: 'France',
    lat: 45.764,
    lng: 4.9811,
    popular: false,
  },
  {
    name: 'Stade de la Mosson',
    city: 'Montpellier',
    country: 'France',
    lat: 43.6117,
    lng: 3.8964,
    popular: false,
  },
  {
    name: 'Stade Pierre-Mauroy',
    city: 'Lille',
    country: 'France',
    lat: 50.6292,
    lng: 3.1292,
    popular: false,
  },
  {
    name: 'Allianz Riviera',
    city: 'Nice',
    country: 'France',
    lat: 43.7059,
    lng: 7.1939,
    popular: false,
  },
  {
    name: 'Stade de la Beaujoire',
    city: 'Nantes',
    country: 'France',
    lat: 47.2186,
    lng: -1.5544,
    popular: false,
  },
  {
    name: 'Stade Geoffroy-Guichard',
    city: 'Saint-Étienne',
    country: 'France',
    lat: 45.4006,
    lng: 4.3181,
    popular: false,
  },
  {
    name: 'Matmut Atlantique',
    city: 'Bordeaux',
    country: 'France',
    lat: 44.8275,
    lng: -0.5694,
    popular: false,
  },
  {
    name: 'Stade Bollaert-Delelis',
    city: 'Lens',
    country: 'France',
    lat: 50.4333,
    lng: 2.6167,
    popular: false,
  },
  {
    name: 'Stade de Strasbourg',
    city: 'Strasbourg',
    country: 'France',
    lat: 48.5934,
    lng: 7.7522,
    popular: false,
  },
  {
    name: 'Stade Oceane',
    city: 'Le Havre',
    country: 'France',
    lat: 49.6117,
    lng: 0.1097,
    popular: false,
  },
  {
    name: 'Stade Saint-Symphorien',
    city: 'Metz',
    country: 'France',
    lat: 49.1222,
    lng: 6.1794,
    popular: false,
  },
  {
    name: 'Stade de Toulouse',
    city: 'Toulouse',
    country: 'France',
    lat: 43.6047,
    lng: 1.2442,
    popular: false,
  },
  {
    name: 'Stade de Caen',
    city: 'Caen',
    country: 'France',
    lat: 49.1708,
    lng: -0.3719,
    popular: false,
  },
  {
    name: 'Stade Jean-Bouin',
    city: 'Paris',
    country: 'France',
    lat: 48.8459,
    lng: 2.3256,
    popular: false,
  },
  {
    name: 'Stade Auguste Delaune',
    city: 'Reims',
    country: 'France',
    lat: 49.2433,
    lng: 3.9186,
    popular: false,
  },
  {
    name: 'Stade de Rennes',
    city: 'Rennes',
    country: 'France',
    lat: 48.1122,
    lng: -1.6833,
    popular: false,
  },
  {
    name: 'Stade Gaston Bourgogne',
    city: 'Dijon',
    country: 'France',
    lat: 47.3117,
    lng: 4.8328,
    popular: false,
  },
  {
    name: 'Stade de Nancy',
    city: 'Nancy',
    country: 'France',
    lat: 48.5806,
    lng: 6.1611,
    popular: false,
  },
  {
    name: 'Stade de Lorient',
    city: 'Lorient',
    country: 'France',
    lat: 47.7475,
    lng: -3.365,
    popular: false,
  },
  {
    name: 'Stade Francis Le Blond',
    city: 'Brest',
    country: 'France',
    lat: 48.5734,
    lng: -4.478,
    popular: false,
  },
  {
    name: 'Stade de Guingamp',
    city: 'Guingamp',
    country: 'France',
    lat: 48.5486,
    lng: -3.1455,
    popular: false,
  },
  {
    name: "Stade d'Angers",
    city: 'Angers',
    country: 'France',
    lat: 47.3811,
    lng: -0.5497,
    popular: false,
  },
  {
    name: 'Stade de Rouen',
    city: 'Rouen',
    country: 'France',
    lat: 49.12,
    lng: 0.955,
    popular: false,
  },
  {
    name: 'Stade de la Picardie',
    city: 'Amiens',
    country: 'France',
    lat: 49.8908,
    lng: 2.2844,
    popular: false,
  },
  {
    name: 'Stade de Tours',
    city: 'Tours',
    country: 'France',
    lat: 47.388,
    lng: 0.688,
    popular: false,
  },
  {
    name: 'Stade du Mans',
    city: 'Le Mans',
    country: 'France',
    lat: 47.985,
    lng: 0.22,
    popular: false,
  },
  {
    name: 'Stade de Troyes',
    city: 'Troyes',
    country: 'France',
    lat: 48.2825,
    lng: 4.0733,
    popular: false,
  },
  // --- France : DOM-TOM ---
  {
    name: 'Stade Félix Éboué',
    city: 'Fort-de-France',
    country: 'France',
    lat: 14.6152,
    lng: -61.0536,
    popular: false,
  },
  {
    name: 'Stade Nelson Mandela',
    city: 'Saint-Denis',
    country: 'France',
    lat: -20.8881,
    lng: 55.45,
    popular: false,
  },
  {
    name: 'Stade Sylvain',
    city: 'Cayenne',
    country: 'France',
    lat: 4.9425,
    lng: -52.3292,
    popular: false,
  },
  {
    name: 'Stade de Guadeloupe',
    city: 'Basse-Terre',
    country: 'France',
    lat: 16.2302,
    lng: -61.7524,
    popular: false,
  },
  {
    name: 'Stade Mahalé',
    city: 'Mamoudzou',
    country: 'France',
    lat: -12.8275,
    lng: 45.1669,
    popular: false,
  },
  // --- Royaume-Uni ---
  {
    name: 'Elland Road',
    city: 'Leeds',
    country: 'Royaume-Uni',
    lat: 53.8404,
    lng: -1.5728,
    popular: false,
  },
  {
    name: 'Goodison Park',
    city: 'Liverpool',
    country: 'Royaume-Uni',
    lat: 53.4676,
    lng: -2.9401,
    popular: false,
  },
  {
    name: 'Craven Cottage',
    city: 'London',
    country: 'Royaume-Uni',
    lat: 51.4737,
    lng: -0.2215,
    popular: false,
  },
  {
    name: 'Ibrox Stadium',
    city: 'Glasgow',
    country: 'Royaume-Uni',
    lat: 55.851,
    lng: -4.309,
    popular: false,
  },
  // --- Pays-Bas ---
  {
    name: 'De Kuip',
    city: 'Rotterdam',
    country: 'Pays-Bas',
    lat: 51.9225,
    lng: 4.4792,
    popular: false,
  },
  {
    name: 'Philips Stadion',
    city: 'Eindhoven',
    country: 'Pays-Bas',
    lat: 51.4412,
    lng: 5.657,
    popular: false,
  },
  {
    name: 'Grolsch Veste',
    city: 'Enschede',
    country: 'Pays-Bas',
    lat: 52.1167,
    lng: 6.8333,
    popular: false,
  },
  // --- Tchéquie ---
  { name: 'Letná', city: 'Praha', country: 'Tchéquie', lat: 50.0955, lng: 14.4126, popular: false },
  {
    name: 'Eden Arena',
    city: 'Praha',
    country: 'Tchéquie',
    lat: 50.0836,
    lng: 14.4514,
    popular: false,
  },
  // --- Europe de l'Est ---
  {
    name: 'Arena Națională',
    city: 'București',
    country: 'Roumanie',
    lat: 44.4095,
    lng: 26.0561,
    popular: false,
  },
  {
    name: 'Stadion Rajko Mitić',
    city: 'Belgrade',
    country: 'Serbie',
    lat: 44.8112,
    lng: 20.4567,
    popular: false,
  },
  {
    name: 'Legia Warsaw Stadium',
    city: 'Warszawa',
    country: 'Pologne',
    lat: 52.2297,
    lng: 21.0082,
    popular: false,
  },
  // --- Scandinav. / Baltique ---
  {
    name: 'Parken',
    city: 'København',
    country: 'Danemark',
    lat: 55.6761,
    lng: 12.5634,
    popular: false,
  },
  {
    name: 'Ullevaal Stadion',
    city: 'Oslo',
    country: 'Norvège',
    lat: 59.9127,
    lng: 10.7523,
    popular: false,
  },
  {
    name: 'Friends Arena',
    city: 'Solna',
    country: 'Suède',
    lat: 59.2706,
    lng: 18.0117,
    popular: false,
  },
  {
    name: 'Helsinki Olympiastadion',
    city: 'Helsinki',
    country: 'Finlande',
    lat: 60.1699,
    lng: 24.9384,
    popular: false,
  },
  // --- Irlande ---
  {
    name: 'Aviva Stadium',
    city: 'Dublin',
    country: 'Irlande',
    lat: 53.3489,
    lng: -6.2375,
    popular: false,
  },
  // --- Amériques ---
  {
    name: 'Estádio Mineirão',
    city: 'Belo Horizonte',
    country: 'Brésil',
    lat: -19.9206,
    lng: -43.9383,
    popular: false,
  },
  {
    name: 'Estádio da Fonte Nova',
    city: 'Salvador',
    country: 'Brésil',
    lat: -13.0045,
    lng: -38.4203,
    popular: false,
  },
  {
    name: 'Arena da Amazônia',
    city: 'Manaus',
    country: 'Brésil',
    lat: -3.089,
    lng: -60.0198,
    popular: false,
  },
  {
    name: 'Estadio Omnilife',
    city: 'Guadalajara',
    country: 'Mexique',
    lat: 20.6597,
    lng: -103.3496,
    popular: false,
  },
  // --- Asie / Moyen-Orient ---
  {
    name: 'Rajamangala Stadium',
    city: 'Bangkok',
    country: 'Thaïlande',
    lat: 13.637,
    lng: 100.865,
    popular: false,
  },
  {
    name: 'Gelora Bung Karno',
    city: 'Jakarta',
    country: 'Indonésie',
    lat: -6.2181,
    lng: 106.8245,
    popular: false,
  },
  {
    name: 'Bukit Jalil',
    city: 'Kuala Lumpur',
    country: 'Malaisie',
    lat: 3.1474,
    lng: 101.7838,
    popular: false,
  },
  {
    name: 'Narasimha Puram',
    city: 'Chennai',
    country: 'Inde',
    lat: 13.0827,
    lng: 80.2707,
    popular: false,
  },
  {
    name: 'Etihad Airways Arena',
    city: 'Dubai',
    country: 'Émirats Arabes Unis',
    lat: 25.2048,
    lng: 55.2708,
    popular: false,
  },
];

/**
 * Sélectionne 5 stades pour une session : 2 populaires + 3 non-populaires, puis mélange
 *
 * @param {StadiumEntry[]} allStadiums - Liste complète des stades
 * @returns {StadiumEntry[]} - 5 stades mélangés pour la session
 */
export function selectBalancedStadiums(allStadiums) {
  const isDev =
    typeof import.meta !== 'undefined' &&
    import.meta &&
    typeof import.meta.env !== 'undefined' &&
    import.meta.env &&
    import.meta.env.DEV;
  const logInsufficient = (message) => {
    if (isDev) {
      logger.warn(message);
    }
  };
  const popularStadiums = allStadiums.filter((s) => s.popular === true);
  const obscureStadiums = allStadiums.filter((s) => s.popular === false);

  if (popularStadiums.length < 2) {
    logInsufficient(`❌ Insufficient popular stadiums (need 2, have ${popularStadiums.length})`);
    return shuffleArray(allStadiums.slice(0, 5));
  }
  if (obscureStadiums.length < 3) {
    logInsufficient(`❌ Insufficient obscure stadiums (need 3, have ${obscureStadiums.length})`);
    return shuffleArray(allStadiums.slice(0, 5));
  }

  const selectedPopular = getRandomItems(popularStadiums, 2);
  const selectedObscure = getRandomItems(obscureStadiums, 3);

  return shuffleArray([...selectedPopular, ...selectedObscure]);
}

/**
 * @param {any[]} array
 * @param {number} n
 * @returns {any[]}
 */
function getRandomItems(array, n) {
  const result = [];
  const tempArray = [...array];

  for (let i = 0; i < n && tempArray.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * tempArray.length);
    result.push(tempArray[randomIndex]);
    tempArray.splice(randomIndex, 1);
  }

  return result;
}

/**
 * @param {any[]} array
 * @returns {any[]}
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
