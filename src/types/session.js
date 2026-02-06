/**
 * Session and round payload typedefs (shared client-side).
 */

/**
 * @typedef {Object} Capital
 * @property {string} name
 * @property {string} country
 * @property {number} lat
 * @property {number} lng
 * @property {boolean} [popular]
 */

/**
 * @typedef {Object} Country
 * @property {string} name
 * @property {string} countryId
 * @property {boolean} [popular]
 */

/**
 * @typedef {Object} Stadium
 * @property {string} name
 * @property {string} city
 * @property {string} country
 * @property {number} lat
 * @property {number} lng
 * @property {boolean} [popular]
 */

/**
 * @typedef {Object} Civilization
 * @property {string} id
 * @property {string} name
 * @property {boolean} [popular]
 */

/**
 * @typedef {Object} StartSessionPayload
 * @property {string} token
 * @property {number} startTime
 * @property {string} csrfToken
 * @property {Capital[]} [capitals]
 * @property {Country[]} [countries]
 * @property {Stadium[]} [stadiums]
 * @property {Civilization[]} [civilizations]
 */

/**
 * @typedef {Object} RoundSubmitPayload
 * @property {{ lat: number, lng: number } | null} click
 * @property {string} status
 * @property {number} score
 * @property {number | undefined} timeElapsed
 * @property {string} [capital]
 * @property {string} [country]
 * @property {string} [countryId]
 * @property {string} [correctCountryId]
 * @property {string} [clickedCountryId]
 * @property {number} [distanceToTargetKm]
 * @property {string} [stadium]
 * @property {string} [city]
 * @property {string} [civilization]
 * @property {string} [civilizationId]
 * @property {string} [correctCivilizationId]
 * @property {string} [clickedCivilizationId]
 */
