import { capitals } from '../../lib/data/capitals.js';
import { logger } from '../utils/logger.js';

/**
 * Selects 5 capitals for a session: 2 popular + 3 less-known, then shuffles.
 *
 * @param {Array<{ popular: boolean }>} allCapitals
 * @returns {Array<any>}
 */
export function selectBalancedCapitals(allCapitals) {
  const isDev =
    typeof import.meta !== 'undefined' &&
    import.meta &&
    typeof import.meta.env !== 'undefined' &&
    import.meta.env &&
    import.meta.env.DEV;
  const logInsufficient = (message) => {
    if (isDev) logger.warn(message);
  };

  const popularCities = allCapitals.filter((city) => city.popular === true);
  const obscureCities = allCapitals.filter((city) => city.popular === false);

  if (popularCities.length < 2) {
    logInsufficient(`Insufficient popular cities (need 2, have ${popularCities.length})`);
    return shuffleArray(allCapitals.slice(0, 5));
  }
  if (obscureCities.length < 3) {
    logInsufficient(`Insufficient obscure cities (need 3, have ${obscureCities.length})`);
    return shuffleArray(allCapitals.slice(0, 5));
  }

  const selectedPopular = getRandomItems(popularCities, 2);
  const selectedObscure = getRandomItems(obscureCities, 3);

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

  for (let i = 0; i < n && tempArray.length > 0; i += 1) {
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
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export { capitals };
