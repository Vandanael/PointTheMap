/**
 * Capital Selection Strategies
 * Shared between client and server
 *
 * This module implements the Strategy Pattern for capital selection,
 * allowing different selection algorithms (random, seeded, etc.) to be
 * used interchangeably based on game mode configuration.
 */

/**
 * @typedef {{ popular: number, obscure: number }} BalancingConfig
 * @typedef {{ count: number, balancing: BalancingConfig }} SelectionConfigBase
 * @typedef {SelectionConfigBase & { type: "random" | "seeded", seed?: (date: Date) => number }} SelectionConfig
 * @typedef {{ popular: boolean, [key: string]: any }} SelectableItem
 * @typedef {{
 *   capitalSelection: SelectionConfig,
 *   countrySelection: SelectionConfig,
 *   civilizationSelection: SelectionConfig,
 *   stadiumSelection: SelectionConfig
 * }} ModeConfig
 */

/**
 * Abstract selection strategy base class
 * @template {SelectableItem} T
 */
class SelectionStrategy {
  /**
   * Select items based on strategy
   * @param {Array<T>} _dataSource - Array of capitals or other geographic entities
   * @param {SelectionConfigBase} _config - Mode-specific configuration
   * @returns {Array<T>} Selected items
   */
  select(_dataSource, _config) {
    throw new Error('Must implement select() method');
  }
}

/**
 * Random selection strategy (Classic mode)
 * Uses Math.random() for non-deterministic selection
 */
/**
 * Random selection strategy (Classic mode)
 * Uses Math.random() for non-deterministic selection
 * @template {SelectableItem} T
 * @extends {SelectionStrategy<T>}
 */
export class RandomSelector extends SelectionStrategy {
  /**
   * Select capitals randomly
   * @param {Array<T>} dataSource
   * @param {SelectionConfigBase} config - Configuration with count and balancing
   * @returns {Array<T>} Selected items
   */
  select(dataSource, config) {
    const { count, balancing } = config;

    // Separate by popularity
    const popular = dataSource.filter((item) => item.popular === true);
    const obscure = dataSource.filter((item) => item.popular === false);

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
   * Randomly sample N items from array without duplicates using crypto.getRandomValues
   * @param {Array<T>} array - Source array
   * @param {number} count - Number of items to select
   * @returns {Array<T>} Selected items
   */
  #randomSample(array, count) {
    const result = [];
    const temp = [...array]; // Clone to avoid mutation

    // Generate random values in batch for better performance
    const randomValues = new Uint32Array(count);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomValues);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < randomValues.length; i++) {
        randomValues[i] = Math.floor(Math.random() * 0xffffffff);
      }
    }

    for (let i = 0; i < count && temp.length > 0; i++) {
      const randomIndex = randomValues[i] % temp.length;
      result.push(temp[randomIndex]);
      temp.splice(randomIndex, 1); // Remove to prevent duplicates
    }

    return result;
  }

  /**
   * Fisher-Yates shuffle algorithm with crypto.getRandomValues for better randomness
   * @param {Array<T>} array - Array to shuffle
   * @returns {Array<T>} Shuffled array
   */
  #shuffle(array) {
    const result = [...array];

    // Use crypto.getRandomValues for cryptographically secure randomness
    const randomValues = new Uint32Array(result.length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomValues);
    } else {
      // Fallback for environments without crypto (e.g., old browsers)
      for (let i = 0; i < randomValues.length; i++) {
        randomValues[i] = Math.floor(Math.random() * 0xffffffff);
      }
    }

    for (let i = result.length - 1; i > 0; i--) {
      const j = randomValues[i] % (i + 1);
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
/**
 * Seeded selection strategy (Daily mode)
 * Uses a seeded RNG for deterministic selection
 * @template {SelectableItem} T
 * @extends {SelectionStrategy<T>}
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
   * @param {Array<T>} dataSource
   * @param {SelectionConfigBase} config - Configuration with count and balancing
   * @returns {Array<T>} Selected items
   */
  select(dataSource, config) {
    const { count, balancing } = config;

    // Separate by popularity
    const popular = dataSource.filter((item) => item.popular === true);
    const obscure = dataSource.filter((item) => item.popular === false);

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
   * @param {Array<T>} array - Source array
   * @param {number} count - Number of items to select
   * @returns {Array<T>} Selected items
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
   * @param {Array<T>} array - Array to shuffle
   * @returns {Array<T>} Shuffled array
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
 * @param {SelectionConfig} selectionConfig - Selection configuration from game mode
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {SelectionStrategy<SelectableItem>} Selector instance
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
 * @param {{ capitalSelection: SelectionConfig }} modeConfig - Game mode configuration
 * @param {Array<SelectableItem>} dataSource - Array of capitals
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {Array<SelectableItem>} Selected capitals
 */
export function selectCapitals(modeConfig, dataSource, date = new Date()) {
  const selector = createSelector(modeConfig.capitalSelection, date);
  return selector.select(dataSource, modeConfig.capitalSelection);
}

/**
 * Country selection function (for Country mode)
 *
 * @param {{ countrySelection: SelectionConfig }} modeConfig - Game mode configuration
 * @param {Array<SelectableItem>} dataSource - Array of countries
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {Array<SelectableItem>} Selected countries
 */
export function selectCountries(modeConfig, dataSource, date = new Date()) {
  const selector = createSelector(modeConfig.countrySelection, date);
  return selector.select(dataSource, modeConfig.countrySelection);
}

/**
 * Civilization selection function (for Civilization mode)
 *
 * @param {{ civilizationSelection: SelectionConfig }} modeConfig - Game mode configuration
 * @param {Array<SelectableItem>} dataSource - Array of civilizations
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {Array<SelectableItem>} Selected civilizations
 */
export function selectCivilizations(modeConfig, dataSource, date = new Date()) {
  const selector = createSelector(modeConfig.civilizationSelection, date);
  return selector.select(dataSource, modeConfig.civilizationSelection);
}

/**
 * Stadium selection function (for Stadium mode)
 *
 * @param {{ stadiumSelection: SelectionConfig }} modeConfig - Game mode configuration
 * @param {Array<SelectableItem>} dataSource - Array of stadiums
 * @param {Date} [date=new Date()] - Date for seeded selection
 * @returns {Array<SelectableItem>} Selected stadiums
 */
export function selectStadiums(modeConfig, dataSource, date = new Date()) {
  const selector = createSelector(modeConfig.stadiumSelection, date);
  return selector.select(dataSource, modeConfig.stadiumSelection);
}
