/**
 * Lazy loader for stadiums data
 * Delays loading the stadiums.js file until actually needed
 */

// Cache for loaded stadiums
let stadiumsCache = null;
let selectBalancedStadiumsCache = null;

/**
 * Lazy load stadiums data
 * @returns {Promise<Array>} Stadiums array
 */
export async function loadStadiums() {
  if (stadiumsCache) {
    return stadiumsCache;
  }

  const module = await import('./stadiums.js');
  stadiumsCache = module.stadiums;

  return stadiumsCache;
}

/**
 * Lazy load selectBalancedStadiums function
 * @returns {Promise<Function>} selectBalancedStadiums function
 */
export async function loadSelectBalancedStadiums() {
  if (selectBalancedStadiumsCache) {
    return selectBalancedStadiumsCache;
  }

  const module = await import('./stadiums.js');
  selectBalancedStadiumsCache = module.selectBalancedStadiums;

  return selectBalancedStadiumsCache;
}
