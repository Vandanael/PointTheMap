/**
 * PointTheMap - Comprehensive World Capitals Database
 * =====================================================
 * 197 capitales mondiales (États membres ONU + observateurs)
 *
 * Structure:
 * - name: Nom de la capitale
 * - country: Nom du pays
 * - lat: Latitude (format décimal, précision 4 décimales)
 * - lng: Longitude (format décimal, précision 4 décimales)
 * - popular: true = capitale majeure connue mondialement (50 villes)
 *            false = capitale moins connue (147 villes)
 *
 * Coordonnées GPS: Centre-ville administratif ou monument emblématique
 * Source: OpenStreetMap, GeoNames
 */

export const capitals = [
  // ========================================
  // CAPITALES POPULAIRES (popular: true)
  // 50 capitales majeures connues mondialement
  // ========================================

  // Europe Occidentale
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, popular: true },
  { name: "Londres", country: "Royaume-Uni", lat: 51.5074, lng: -0.1278, popular: true },
  { name: "Berlin", country: "Allemagne", lat: 52.52, lng: 13.405, popular: true },
  { name: "Rome", country: "Italie", lat: 41.9028, lng: 12.4964, popular: true },
  { name: "Madrid", country: "Espagne", lat: 40.4168, lng: -3.7038, popular: true },
  { name: "Amsterdam", country: "Pays-Bas", lat: 52.3676, lng: 4.9041, popular: true },
  { name: "Bruxelles", country: "Belgique", lat: 50.8503, lng: 4.3517, popular: true },
  { name: "Vienne", country: "Autriche", lat: 48.2082, lng: 16.3738, popular: true },
  { name: "Lisbonne", country: "Portugal", lat: 38.7223, lng: -9.1393, popular: true },
  { name: "Athènes", country: "Grèce", lat: 37.9838, lng: 23.7275, popular: true },

  // Europe du Nord
  { name: "Stockholm", country: "Suède", lat: 59.3293, lng: 18.0686, popular: true },
  { name: "Oslo", country: "Norvège", lat: 59.9139, lng: 10.7522, popular: true },
  { name: "Copenhague", country: "Danemark", lat: 55.6761, lng: 12.5683, popular: true },
  { name: "Helsinki", country: "Finlande", lat: 60.1695, lng: 24.9354, popular: true },

  // Europe de l'Est
  { name: "Moscou", country: "Russie", lat: 55.7558, lng: 37.6173, popular: true },
  { name: "Varsovie", country: "Pologne", lat: 52.2297, lng: 21.0122, popular: true },
  { name: "Prague", country: "Tchéquie", lat: 50.0755, lng: 14.4378, popular: true },
  { name: "Budapest", country: "Hongrie", lat: 47.4979, lng: 19.0402, popular: true },
  { name: "Bucarest", country: "Roumanie", lat: 44.4268, lng: 26.1025, popular: true },

  // Amériques
  { name: "Washington D.C.", country: "États-Unis", lat: 38.9072, lng: -77.0369, popular: true },
  { name: "Ottawa", country: "Canada", lat: 45.4215, lng: -75.6972, popular: true },
  { name: "Mexico", country: "Mexique", lat: 19.4326, lng: -99.1332, popular: true },
  { name: "Brasilia", country: "Brésil", lat: -15.8267, lng: -47.9218, popular: true },
  { name: "Buenos Aires", country: "Argentine", lat: -34.6037, lng: -58.3816, popular: true },
  { name: "Lima", country: "Pérou", lat: -12.0464, lng: -77.0428, popular: true },
  { name: "Bogota", country: "Colombie", lat: 4.711, lng: -74.0721, popular: true },
  { name: "Santiago", country: "Chili", lat: -33.4489, lng: -70.6693, popular: true },
  { name: "Caracas", country: "Venezuela", lat: 10.4806, lng: -66.9036, popular: true },

  // Asie
  { name: "Tokyo", country: "Japon", lat: 35.6762, lng: 139.6503, popular: true },
  { name: "Pékin", country: "Chine", lat: 39.9042, lng: 116.4074, popular: true },
  { name: "Séoul", country: "Corée du Sud", lat: 37.5665, lng: 126.978, popular: true },
  { name: "New Delhi", country: "Inde", lat: 28.6139, lng: 77.209, popular: true },
  { name: "Bangkok", country: "Thaïlande", lat: 13.7563, lng: 100.5018, popular: true },
  { name: "Singapour", country: "Singapour", lat: 1.3521, lng: 103.8198, popular: true },
  { name: "Kuala Lumpur", country: "Malaisie", lat: 3.139, lng: 101.6869, popular: true },
  { name: "Jakarta", country: "Indonésie", lat: -6.2088, lng: 106.8456, popular: true },
  { name: "Manille", country: "Philippines", lat: 14.5995, lng: 120.9842, popular: true },
  { name: "Hanoï", country: "Vietnam", lat: 21.0285, lng: 105.8542, popular: true },
  { name: "Téhéran", country: "Iran", lat: 35.6892, lng: 51.389, popular: true },
  { name: "Tel Aviv", country: "Israël", lat: 32.0853, lng: 34.7818, popular: true },

  // Moyen-Orient
  { name: "Riyad", country: "Arabie Saoudite", lat: 24.7136, lng: 46.6753, popular: true },
  { name: "Dubaï", country: "Émirats Arabes Unis", lat: 25.2048, lng: 55.2708, popular: true },
  { name: "Doha", country: "Qatar", lat: 25.2854, lng: 51.531, popular: true },
  { name: "Ankara", country: "Turquie", lat: 39.9334, lng: 32.8597, popular: true },

  // Afrique
  { name: "Le Caire", country: "Égypte", lat: 30.0444, lng: 31.2357, popular: true },
  { name: "Nairobi", country: "Kenya", lat: -1.2864, lng: 36.8172, popular: true },
  { name: "Le Cap", country: "Afrique du Sud", lat: -33.9249, lng: 18.4241, popular: true },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792, popular: true },

  // Océanie
  { name: "Canberra", country: "Australie", lat: -35.2809, lng: 149.13, popular: true },
  { name: "Wellington", country: "Nouvelle-Zélande", lat: -41.2865, lng: 174.7762, popular: true },

  // ========================================
  // CAPITALES NON-POPULAIRES (popular: false)
  // 147 capitales moins connues
  // ========================================

  // Europe
  { name: "Reykjavik", country: "Islande", lat: 64.1466, lng: -21.9426, popular: false },
  { name: "Dublin", country: "Irlande", lat: 53.3498, lng: -6.2603, popular: false },
  { name: "Berne", country: "Suisse", lat: 46.9481, lng: 7.4474, popular: false },
  { name: "Luxembourg", country: "Luxembourg", lat: 49.6116, lng: 6.1319, popular: false },
  { name: "Monaco", country: "Monaco", lat: 43.7384, lng: 7.4246, popular: false },
  { name: "Vaduz", country: "Liechtenstein", lat: 47.141, lng: 9.5209, popular: false },
  { name: "Andorre-la-Vieille", country: "Andorre", lat: 42.5063, lng: 1.5218, popular: false },
  { name: "Saint-Marin", country: "Saint-Marin", lat: 43.9424, lng: 12.4578, popular: false },
  { name: "Cité du Vatican", country: "Vatican", lat: 41.9029, lng: 12.4534, popular: false },
  { name: "Valletta", country: "Malte", lat: 35.8989, lng: 14.5146, popular: false },
  { name: "Nicosie", country: "Chypre", lat: 35.1856, lng: 33.3823, popular: false },
  { name: "Zagreb", country: "Croatie", lat: 45.815, lng: 15.9819, popular: false },
  { name: "Ljubljana", country: "Slovénie", lat: 46.0569, lng: 14.5058, popular: false },
  { name: "Bratislava", country: "Slovaquie", lat: 48.1486, lng: 17.1077, popular: false },
  { name: "Sofia", country: "Bulgarie", lat: 42.6977, lng: 23.3219, popular: false },
  { name: "Belgrade", country: "Serbie", lat: 44.7866, lng: 20.4489, popular: false },
  { name: "Sarajevo", country: "Bosnie-Herzégovine", lat: 43.8563, lng: 18.4131, popular: false },
  { name: "Podgorica", country: "Monténégro", lat: 42.4304, lng: 19.2594, popular: false },
  { name: "Skopje", country: "Macédoine du Nord", lat: 41.9973, lng: 21.428, popular: false },
  { name: "Tirana", country: "Albanie", lat: 41.3275, lng: 19.8187, popular: false },
  { name: "Pristina", country: "Kosovo", lat: 42.6629, lng: 21.1655, popular: false },
  { name: "Chisinau", country: "Moldavie", lat: 47.0105, lng: 28.8638, popular: false },
  { name: "Kiev", country: "Ukraine", lat: 50.4501, lng: 30.5234, popular: false },
  { name: "Minsk", country: "Biélorussie", lat: 53.9045, lng: 27.5615, popular: false },
  { name: "Vilnius", country: "Lituanie", lat: 54.6872, lng: 25.2797, popular: false },
  { name: "Riga", country: "Lettonie", lat: 56.9496, lng: 24.1052, popular: false },
  { name: "Tallinn", country: "Estonie", lat: 59.437, lng: 24.7536, popular: false },

  // Asie Centrale & Caucase
  { name: "Astana", country: "Kazakhstan", lat: 51.1694, lng: 71.4491, popular: false },
  { name: "Tachkent", country: "Ouzbékistan", lat: 41.2995, lng: 69.2401, popular: false },
  { name: "Bichkek", country: "Kirghizistan", lat: 42.8746, lng: 74.5698, popular: false },
  { name: "Douchanbé", country: "Tadjikistan", lat: 38.5598, lng: 68.7738, popular: false },
  { name: "Achgabat", country: "Turkménistan", lat: 37.9601, lng: 58.3261, popular: false },
  { name: "Tbilissi", country: "Géorgie", lat: 41.7151, lng: 44.8271, popular: false },
  { name: "Erevan", country: "Arménie", lat: 40.1792, lng: 44.4991, popular: false },
  { name: "Bakou", country: "Azerbaïdjan", lat: 40.4093, lng: 49.8671, popular: false },

  // Asie du Sud & Sud-Est
  { name: "Kaboul", country: "Afghanistan", lat: 34.5553, lng: 69.2075, popular: false },
  { name: "Islamabad", country: "Pakistan", lat: 33.6844, lng: 73.0479, popular: false },
  { name: "Dacca", country: "Bangladesh", lat: 23.8103, lng: 90.4125, popular: false },
  { name: "Katmandou", country: "Népal", lat: 27.7172, lng: 85.324, popular: false },
  { name: "Thimphou", country: "Bhoutan", lat: 27.4728, lng: 89.6393, popular: false },
  { name: "Colombo", country: "Sri Lanka", lat: 6.9271, lng: 79.8612, popular: false },
  { name: "Malé", country: "Maldives", lat: 4.1755, lng: 73.5093, popular: false },
  { name: "Naypyidaw", country: "Myanmar", lat: 19.7633, lng: 96.0785, popular: false },
  { name: "Vientiane", country: "Laos", lat: 17.9757, lng: 102.6331, popular: false },
  { name: "Phnom Penh", country: "Cambodge", lat: 11.5564, lng: 104.9282, popular: false },
  { name: "Bandar Seri Begawan", country: "Brunei", lat: 4.9031, lng: 114.9398, popular: false },
  { name: "Dili", country: "Timor Oriental", lat: -8.5569, lng: 125.5603, popular: false },

  // Asie de l'Est
  { name: "Pyongyang", country: "Corée du Nord", lat: 39.0392, lng: 125.7625, popular: false },
  { name: "Oulan-Bator", country: "Mongolie", lat: 47.8864, lng: 106.9057, popular: false },
  { name: "Taipei", country: "Taïwan", lat: 25.033, lng: 121.5654, popular: false },

  // Moyen-Orient
  { name: "Bagdad", country: "Irak", lat: 33.3152, lng: 44.3661, popular: false },
  { name: "Damas", country: "Syrie", lat: 33.5138, lng: 36.2765, popular: false },
  { name: "Beyrouth", country: "Liban", lat: 33.8886, lng: 35.4955, popular: false },
  { name: "Amman", country: "Jordanie", lat: 31.9454, lng: 35.9284, popular: false },
  { name: "Jérusalem", country: "Palestine", lat: 31.7683, lng: 35.2137, popular: false },
  { name: "Sanaa", country: "Yémen", lat: 15.3694, lng: 44.191, popular: false },
  { name: "Mascate", country: "Oman", lat: 23.588, lng: 58.3829, popular: false },
  { name: "Manama", country: "Bahreïn", lat: 26.2285, lng: 50.586, popular: false },
  { name: "Koweït", country: "Koweït", lat: 29.3759, lng: 47.9774, popular: false },

  // Afrique du Nord
  { name: "Rabat", country: "Maroc", lat: 34.0209, lng: -6.8416, popular: false },
  { name: "Alger", country: "Algérie", lat: 36.7538, lng: 3.0588, popular: false },
  { name: "Tunis", country: "Tunisie", lat: 36.8065, lng: 10.1815, popular: false },
  { name: "Tripoli", country: "Libye", lat: 32.8872, lng: 13.1913, popular: false },
  { name: "Khartoum", country: "Soudan", lat: 15.5007, lng: 32.5599, popular: false },
  { name: "Djouba", country: "Soudan du Sud", lat: 4.8517, lng: 31.5825, popular: false },

  // Afrique de l'Ouest
  { name: "Dakar", country: "Sénégal", lat: 14.7167, lng: -17.4677, popular: false },
  { name: "Bamako", country: "Mali", lat: 12.6392, lng: -8.0029, popular: false },
  { name: "Ouagadougou", country: "Burkina Faso", lat: 12.3714, lng: -1.5197, popular: false },
  { name: "Niamey", country: "Niger", lat: 13.5127, lng: 2.1128, popular: false },
  { name: "Abuja", country: "Nigeria", lat: 9.0765, lng: 7.3986, popular: false },
  { name: "Ndjamena", country: "Tchad", lat: 12.1348, lng: 15.0557, popular: false },
  { name: "Conakry", country: "Guinée", lat: 9.6412, lng: -13.5784, popular: false },
  { name: "Freetown", country: "Sierra Leone", lat: 8.4657, lng: -13.2317, popular: false },
  { name: "Monrovia", country: "Liberia", lat: 6.3156, lng: -10.8074, popular: false },
  { name: "Yamoussoukro", country: "Côte d'Ivoire", lat: 6.8276, lng: -5.2893, popular: false },
  { name: "Accra", country: "Ghana", lat: 5.6037, lng: -0.187, popular: false },
  { name: "Lomé", country: "Togo", lat: 6.1256, lng: 1.2223, popular: false },
  { name: "Porto-Novo", country: "Bénin", lat: 6.4969, lng: 2.6289, popular: false },
  { name: "Banjul", country: "Gambie", lat: 13.4549, lng: -16.579, popular: false },
  { name: "Bissau", country: "Guinée-Bissau", lat: 11.8636, lng: -15.5989, popular: false },
  { name: "Praia", country: "Cap-Vert", lat: 14.933, lng: -23.5133, popular: false },
  { name: "Nouakchott", country: "Mauritanie", lat: 18.0735, lng: -15.9582, popular: false },

  // Afrique Centrale
  { name: "Yaoundé", country: "Cameroun", lat: 3.848, lng: 11.5021, popular: false },
  { name: "Bangui", country: "Centrafrique", lat: 4.3947, lng: 18.5582, popular: false },
  { name: "Libreville", country: "Gabon", lat: 0.4162, lng: 9.4673, popular: false },
  { name: "Malabo", country: "Guinée équatoriale", lat: 3.7504, lng: 8.7371, popular: false },
  { name: "Brazzaville", country: "Congo", lat: -4.2634, lng: 15.2429, popular: false },
  { name: "Kinshasa", country: "RD Congo", lat: -4.4419, lng: 15.2663, popular: false },
  { name: "Sao Tomé", country: "Sao Tomé-et-Principe", lat: 0.3365, lng: 6.7273, popular: false },

  // Afrique de l'Est
  { name: "Addis-Abeba", country: "Éthiopie", lat: 9.032, lng: 38.7469, popular: false },
  { name: "Asmara", country: "Érythrée", lat: 15.3229, lng: 38.9251, popular: false },
  { name: "Djibouti", country: "Djibouti", lat: 11.8251, lng: 42.5903, popular: false },
  { name: "Mogadiscio", country: "Somalie", lat: 2.0469, lng: 45.3182, popular: false },
  { name: "Kampala", country: "Ouganda", lat: 0.3476, lng: 32.5825, popular: false },
  { name: "Kigali", country: "Rwanda", lat: -1.9441, lng: 30.0619, popular: false },
  { name: "Bujumbura", country: "Burundi", lat: -3.3614, lng: 29.3599, popular: false },
  { name: "Dodoma", country: "Tanzanie", lat: -6.163, lng: 35.7516, popular: false },
  { name: "Moroni", country: "Comores", lat: -11.7172, lng: 43.2473, popular: false },
  { name: "Antananarivo", country: "Madagascar", lat: -18.8792, lng: 47.5079, popular: false },
  { name: "Port-Louis", country: "Maurice", lat: -20.1609, lng: 57.5012, popular: false },
  { name: "Victoria", country: "Seychelles", lat: -4.6191, lng: 55.4513, popular: false },

  // Afrique Australe
  { name: "Luanda", country: "Angola", lat: -8.8383, lng: 13.2344, popular: false },
  { name: "Lusaka", country: "Zambie", lat: -15.3875, lng: 28.3228, popular: false },
  { name: "Harare", country: "Zimbabwe", lat: -17.8252, lng: 31.0335, popular: false },
  { name: "Maputo", country: "Mozambique", lat: -25.9655, lng: 32.5832, popular: false },
  { name: "Gaborone", country: "Botswana", lat: -24.6282, lng: 25.9231, popular: false },
  { name: "Windhoek", country: "Namibie", lat: -22.5597, lng: 17.0832, popular: false },
  { name: "Pretoria", country: "Afrique du Sud", lat: -25.7479, lng: 28.2293, popular: false },
  { name: "Mbabane", country: "Eswatini", lat: -26.3054, lng: 31.1367, popular: false },
  { name: "Maseru", country: "Lesotho", lat: -29.3167, lng: 27.4833, popular: false },

  // Amériques Centrale & Caraïbes
  { name: "Belmopan", country: "Belize", lat: 17.251, lng: -88.759, popular: false },
  { name: "Guatemala", country: "Guatemala", lat: 14.6349, lng: -90.5069, popular: false },
  { name: "Tegucigalpa", country: "Honduras", lat: 14.0723, lng: -87.1921, popular: false },
  { name: "Managua", country: "Nicaragua", lat: 12.115, lng: -86.2362, popular: false },
  { name: "San José", country: "Costa Rica", lat: 9.9281, lng: -84.0907, popular: false },
  { name: "Panama", country: "Panama", lat: 8.9824, lng: -79.5199, popular: false },
  { name: "San Salvador", country: "Salvador", lat: 13.6929, lng: -89.2182, popular: false },
  { name: "La Havane", country: "Cuba", lat: 23.1136, lng: -82.3666, popular: false },
  { name: "Kingston", country: "Jamaïque", lat: 17.9714, lng: -76.7931, popular: false },
  { name: "Port-au-Prince", country: "Haïti", lat: 18.5944, lng: -72.3074, popular: false },
  {
    name: "Saint-Domingue",
    country: "Rép. Dominicaine",
    lat: 18.4861,
    lng: -69.9312,
    popular: false,
  },
  { name: "Nassau", country: "Bahamas", lat: 25.0443, lng: -77.3504, popular: false },
  { name: "Bridgetown", country: "Barbade", lat: 13.0969, lng: -59.6145, popular: false },
  {
    name: "Port-d'Espagne",
    country: "Trinité-et-Tobago",
    lat: 10.6918,
    lng: -61.2225,
    popular: false,
  },
  { name: "Saint-Georges", country: "Grenade", lat: 12.0565, lng: -61.7488, popular: false },
  { name: "Castries", country: "Sainte-Lucie", lat: 14.0101, lng: -60.9875, popular: false },
  { name: "Kingstown", country: "Saint-Vincent", lat: 13.1579, lng: -61.2248, popular: false },
  {
    name: "Saint John's",
    country: "Antigua-et-Barbuda",
    lat: 17.1274,
    lng: -61.8468,
    popular: false,
  },
  { name: "Roseau", country: "Dominique", lat: 15.301, lng: -61.387, popular: false },
  { name: "Basseterre", country: "Saint-Christophe", lat: 17.3026, lng: -62.7177, popular: false },

  // Amérique du Sud
  { name: "Quito", country: "Équateur", lat: -0.1807, lng: -78.4678, popular: false },
  { name: "La Paz", country: "Bolivie", lat: -16.5, lng: -68.15, popular: false },
  { name: "Asunción", country: "Paraguay", lat: -25.2637, lng: -57.5759, popular: false },
  { name: "Montevideo", country: "Uruguay", lat: -34.9011, lng: -56.1645, popular: false },
  { name: "Georgetown", country: "Guyana", lat: 6.8013, lng: -58.1551, popular: false },
  { name: "Paramaribo", country: "Suriname", lat: 5.852, lng: -55.2038, popular: false },
  { name: "Cayenne", country: "Guyane", lat: 4.9333, lng: -52.3333, popular: false },

  // Océanie & Pacifique
  {
    name: "Port Moresby",
    country: "Papouasie-Nouvelle-Guinée",
    lat: -9.4438,
    lng: 147.1803,
    popular: false,
  },
  { name: "Suva", country: "Fidji", lat: -18.1416, lng: 178.4419, popular: false },
  { name: "Port-Vila", country: "Vanuatu", lat: -17.7333, lng: 168.3273, popular: false },
  { name: "Honiara", country: "Îles Salomon", lat: -9.4456, lng: 159.9729, popular: false },
  { name: "Apia", country: "Samoa", lat: -13.8333, lng: -171.7667, popular: false },
  { name: "Nuku'alofa", country: "Tonga", lat: -21.139, lng: -175.2018, popular: false },
  { name: "Funafuti", country: "Tuvalu", lat: -8.5211, lng: 179.1962, popular: false },
  { name: "Tarawa", country: "Kiribati", lat: 1.3382, lng: 173.0176, popular: false },
  { name: "Majuro", country: "Îles Marshall", lat: 7.1315, lng: 171.1845, popular: false },
  { name: "Palikir", country: "Micronésie", lat: 6.9177, lng: 158.161, popular: false },
  { name: "Ngerulmud", country: "Palaos", lat: 7.5006, lng: 134.6242, popular: false },
  { name: "Yaren", country: "Nauru", lat: -0.5477, lng: 166.9209, popular: false },
];

/**
 * Algorithme de sélection 'Balanced Challenge'
 * Sélectionne 5 capitales pour une session : 2 populaires + 3 non-populaires, puis mélange
 *
 * @param {Array} allCapitals - Liste complète des capitales
 * @returns {Array} - 5 capitales mélangées pour la session
 */
export function selectBalancedCapitals(allCapitals) {
  // Séparer les capitales par popularité
  const popularCities = allCapitals.filter((city) => city.popular === true);
  const obscureCities = allCapitals.filter((city) => city.popular === false);

  // Validation de la base de données
  if (popularCities.length < 2) {
    console.error(`❌ Insufficient popular cities (need 2, have ${popularCities.length})`);
    return shuffleArray(allCapitals.slice(0, 5)); // Fallback
  }
  if (obscureCities.length < 3) {
    console.error(`❌ Insufficient obscure cities (need 3, have ${obscureCities.length})`);
    return shuffleArray(allCapitals.slice(0, 5)); // Fallback
  }

  // Sélection aléatoire : 2 populaires + 3 difficiles
  const selectedPopular = getRandomItems(popularCities, 2);
  const selectedObscure = getRandomItems(obscureCities, 3);

  // Combiner et mélanger pour imprévisibilité
  const sessionCapitals = [...selectedPopular, ...selectedObscure];

  return shuffleArray(sessionCapitals);
}

/**
 * Sélectionne N éléments aléatoires d'un array sans doublons
 *
 * @param {Array} array - Array source
 * @param {number} n - Nombre d'éléments à sélectionner
 * @returns {Array} - N éléments aléatoires
 */
function getRandomItems(array, n) {
  const result = [];
  const tempArray = [...array]; // Clone pour ne pas modifier l'original

  for (let i = 0; i < n && tempArray.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * tempArray.length);
    result.push(tempArray[randomIndex]);
    tempArray.splice(randomIndex, 1); // Retirer pour éviter doublons
  }

  return result;
}

/**
 * Algorithme de mélange Fisher-Yates (optimal O(n))
 * Garantit une distribution uniforme
 *
 * @param {Array} array - Array à mélanger
 * @returns {Array} - Array mélangé
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
