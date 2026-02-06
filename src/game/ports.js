/**
 * Port Interfaces for Game Core
 *
 * These interfaces define the minimal contracts between the game core
 * (Game.js, Round.js) and external systems (MapSystem, ScoringSystem, ValidationSystem).
 * This allows the core game logic to remain decoupled and testable.
 */

/**
 * Map query interface for geographic lookups
 * @typedef {Object} MapQueryPort
 * @property {(latlng: [number, number]) => string|null} getCountryAtLatLng - Get country ID at coordinates
 * @property {(countryId: string) => Object|null} getCountryFeatureById - Get country GeoJSON feature
 * @property {(latlng: [number, number]) => string|null} getCivilizationAtLatLng - Get civilization ID at coordinates
 * @property {(civilizationId: string) => Object|null} getCivilizationFeatureById - Get civilization GeoJSON feature
 */

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the input is valid
 * @property {string} [error] - Error message if invalid
 */

/**
 * Score result for point-to-point scoring
 * @typedef {Object} ScoreResult
 * @property {number|null} distance - Distance in km (null if timeout/invalid)
 * @property {number} score - Base score
 * @property {number} timeBonus - Time bonus points
 * @property {number} totalScore - Total score (score + timeBonus)
 */

/**
 * Score result for country/polygon scoring
 * @typedef {Object} CountryScoreResult
 * @property {number|null} distance - Distance in km (null if timeout/invalid)
 * @property {number|null} distanceToCountry - Distance to country border in km
 * @property {number} score - Base score
 * @property {number} timeBonus - Time bonus points
 * @property {number} totalScore - Total score (score + timeBonus)
 */

/**
 * Round rules interface for validation and scoring
 * @typedef {Object} RoundRulesPort
 * @property {(lat: number, lng: number) => ValidationResult} validateCoordinates - Validate coordinates
 * @property {(clickCoords: [number, number], targetCoords: [number, number], elapsed: number, gameMode: string, total: number) => ScoreResult} calculateClickScore - Calculate point-to-point score
 * @property {(clickCoords: [number, number], feature: Object, isInside: boolean, elapsed: number, gameMode: string, total: number) => CountryScoreResult} calculateCountryClickScore - Calculate country/polygon score
 */

/**
 * Create a MapQueryPort adapter from MapSystem
 * @param {import('../systems/MapSystem.js').MapSystem} mapSystem
 * @returns {MapQueryPort}
 */
export function createMapQueryAdapter(mapSystem) {
  return {
    getCountryAtLatLng: (latlng) => mapSystem.getCountryAtLatLng(latlng),
    getCountryFeatureById: (countryId) => mapSystem.getCountryFeatureById(countryId),
    getCivilizationAtLatLng: (latlng) => mapSystem.getCivilizationAtLatLng(latlng),
    getCivilizationFeatureById: (civilizationId) =>
      mapSystem.getCivilizationFeatureById(civilizationId),
  };
}

/**
 * Create a RoundRulesPort adapter from ValidationSystem and ScoringSystem
 * @param {import('../systems/ValidationSystem.js').ValidationSystem} validationSystem
 * @param {import('../systems/ScoringSystem.js').ScoringSystem} scoringSystem
 * @returns {RoundRulesPort}
 */
export function createRoundRulesAdapter(validationSystem, scoringSystem) {
  return {
    validateCoordinates: (lat, lng) => validationSystem.validateCoordinates(lat, lng),
    calculateClickScore: (clickCoords, targetCoords, elapsed, gameMode, total) =>
      scoringSystem.calculateClickScore(clickCoords, targetCoords, elapsed, gameMode, total),
    calculateCountryClickScore: (clickCoords, feature, isInside, elapsed, gameMode, total) =>
      scoringSystem.calculateCountryClickScore(
        clickCoords,
        feature,
        isInside,
        elapsed,
        gameMode,
        total
      ),
  };
}
