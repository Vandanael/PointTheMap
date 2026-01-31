/**
 * Capital Selection Strategies
 * Shared between client and server
 *
 * This module implements the Strategy Pattern for capital selection,
 * allowing different selection algorithms (random, seeded, etc.) to be
 * used interchangeably based on game mode configuration.
 */

/**
 * Abstract selection strategy base class
 */
class SelectionStrategy {
  /**
   * Select capitals based on strategy
   * @param {Array} dataSource - Array of capitals or other geographic entities
   * @param {Object} config - Mode-specific configuration
   * @returns {Array} Selected items
   */
  select(dataSource, config) {
    throw new Error('Must implement select() method');
  }
}

/**
 * Random selection strategy (Classic mode)
 * Uses Math.random() for non-deterministic selection
 */
export class RandomSelector extends SelectionStrategy {
  /**
   * Select capitals randomly
   * @param {Array<{name: string, country: string, lat: number, lng: number, popular: boolean}>} dataSource
   * @param {Object} config - Configuration with count and balancing
   * @returns {Array} Selected capitals
   */
  select(dataSource, config) {
    const { count, balancing } = config;

    // Separate by popularity
    const popular = dataSource.filter(item => item.popular === true);
    const obscure = dataSource.filter(item => item.popular === false);

    // Validation: ensure we have enough capitals
    if (popular.length < balancing.popular || obscure.length < balancing.obscure) {
      // Fallback: shuffle and take first N
      const shuffled = this.#shuffle([...dataSource]);
      return shuffled.slice(0, count);
    }

    // Select required number from each category
    const selectedPopular = this.#randomSample(popular, balancing.popular);
    const selectedObscure = this.#randomSample(obscure, balancing.obscure);

    // Combine and shuffle for unpredictability
    return this.#shuffle([...selectedPopular, ...selectedObscure]);
  }

  /**
   * Randomly sample N items from array without duplicates
   * @private
   * @param {Array} array - Source array
   * @param {number} count - Number of items to select
   * @returns {Array} Selected items
   */
  #randomSample(array, count) {
    const result = [];
    const temp = [...array]; // Clone to avoid mutation

    for (let i = 0; i < count && temp.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * temp.length);
      result.push(temp[randomIndex]);
      temp.splice(randomIndex, 1); // Remove to prevent duplicates
    }

    return result;
  }

  /**
   * Fisher-Yates shuffle algorithm
   * @private
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  #shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Seeded Random Number Generator
 * Provides deterministic pseudo-random numbers for daily challenges
 */
class SeededRandom {
  /**
   * @param {number} seed - Integer seed value
   */
  constructor(seed) {
    this.seed = seed;
  }

  /**
   * Generate next pseudo-random number in [0, 1)
   * Uses Linear Congruential Generator (LCG) algorithm
   * @returns {number} Pseudo-random number
   */
  next() {
    // LCG parameters (same as in start.js for consistency)
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Seeded selection strategy (Daily mode)
 * Uses a seeded RNG for deterministic selection
 */
export class SeededSelector extends SelectionStrategy {
  /**
   * @param {number} seed - Seed value for deterministic selection
   */
  constructor(seed) {
    super();
    this.rng = new SeededRandom(seed);
  }

  /**
   * Select capitals using seeded randomization
   * @param {Array<{name: string, country: string, lat: number, lng: number, popular: boolean}>} dataSource
   * @param {Object} config - Configuration with count and balancing
   * @returns {Array} Selected capitals
   */
  select(dataSource, config) {
    const { count, balancing } = config;

    // Separate by popularity
    const popular = dataSource.filter(item => item.popular === true);
    const obscure = dataSource.filter(item => item.popular === false);

    // Validation: ensure we have enough capitals
    if (popular.length < balancing.popular || obscure.length < balancing.obscure) {
      // Fallback: seeded shuffle and take first N
      const shuffled = this.#seededShuffle([...dataSource]);
      return shuffled.slice(0, count);
    }

    // Select required number from each category
    const selectedPopular = this.#seededSample(popular, balancing.popular);
    const selectedObscure = this.#seededSample(obscure, balancing.obscure);

    // Combine and shuffle for unpredictability
    return this.#seededShuffle([...selectedPopular, ...selectedObscure]);
  }

  /**
   * Sample N items using seeded randomization
   * @private
   * @param {Array} array - Source array
   * @param {number} count - Number of items to select
   * @returns {Array} Selected items
   */
  #seededSample(array, count) {
    const result = [];
    const temp = [...array]; // Clone to avoid mutation

    for (let i = 0; i < count && temp.length > 0; i++) {
      const index = Math.floor(this.rng.next() * temp.length);
      result.push(temp[index]);
      temp.splice(index, 1); // Remove to prevent duplicates
    }

    return result;
  }

  /**
   * Fisher-Yates shuffle using seeded RNG
   * @private
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  #seededShuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Factory function to create appropriate selector based on configuration
 * @param {Object} selectionConfig - Selection configuration from game mode
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {SelectionStrategy} Selector instance
 * @throws {Error} if selection type is unknown
 */
export function createSelector(selectionConfig, date = new Date()) {
  switch (selectionConfig.type) {
    case 'random':
      return new RandomSelector();

    case 'seeded':
      if (!selectionConfig.seed || typeof selectionConfig.seed !== 'function') {
        throw new Error('Seeded selection requires a seed function');
      }
      const seed = selectionConfig.seed(date);
      return new SeededSelector(seed);

    default:
      throw new Error(`Unknown selection type: ${selectionConfig.type}`);
  }
}

/**
 * Main selection function (convenience wrapper)
 * Replaces scattered selection logic in start.js and capitals.js
 *
 * @param {Object} modeConfig - Game mode configuration
 * @param {Array} dataSource - Array of capitals
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {Array} Selected capitals
 */
export function selectCapitals(modeConfig, dataSource, date = new Date()) {
  const selector = createSelector(modeConfig.capitalSelection, date);
  return selector.select(dataSource, modeConfig.capitalSelection);
}

/**
 * Country selection function (for Country mode)
 *
 * @param {Object} modeConfig - Game mode configuration
 * @param {Array} dataSource - Array of countries
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {Array} Selected countries
 */
export function selectCountries(modeConfig, dataSource, date = new Date()) {
  const selector = createSelector(modeConfig.countrySelection, date);
  return selector.select(dataSource, modeConfig.countrySelection);
}
