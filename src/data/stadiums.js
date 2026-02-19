import { stadiums } from '../../lib/data/stadiums.js';
import { logger } from '../utils/logger.js';

/**
 * Selects 5 stadiums for a session: 2 popular + 3 less-known, then shuffles.
 *
 * @param {Array<{ popular: boolean }>} allStadiums
 * @returns {Array<any>}
 */
export function selectBalancedStadiums(allStadiums) {
  const isDev =
    typeof import.meta !== 'undefined' &&
    import.meta &&
    typeof import.meta.env !== 'undefined' &&
    import.meta.env &&
    import.meta.env.DEV;
  const logInsufficient = (message) => {
    if (isDev) logger.warn(message);
  };

  const popularStadiums = allStadiums.filter((s) => s.popular === true);
  const obscureStadiums = allStadiums.filter((s) => s.popular === false);

  if (popularStadiums.length < 2) {
    logInsufficient(`Insufficient popular stadiums (need 2, have ${popularStadiums.length})`);
    return shuffleArray(allStadiums.slice(0, 5));
  }
  if (obscureStadiums.length < 3) {
    logInsufficient(`Insufficient obscure stadiums (need 3, have ${obscureStadiums.length})`);
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

export { stadiums };
