/**
 * Session Domain Model
 *
 * Provides a clear boundary between persistence model and domain model.
 *
 * Persistence model uses the "targets" column to store generic session targets
 * (capitals, countries, stadiums, civilizations). This module keeps the
 * persistence and domain models aligned and explicit.
 */

/**
 * @typedef {Object} SessionPersistenceModel
 * @property {string} token
 * @property {unknown[]} targets - Generic target list (capitals, countries, stadiums, civilizations)
 * @property {number} startTime
 * @property {boolean} used
 * @property {string} gameType
 * @property {string} [csrfToken]
 * @property {string} [playerId]
 */

/**
 * @typedef {Object} SessionDomainModel
 * @property {string} token
 * @property {unknown[]} targets - Generic session targets (semantically correct)
 * @property {number} startTime
 * @property {boolean} used
 * @property {string} gameType
 * @property {string} [csrfToken]
 * @property {string} [playerId]
 */

/**
 * Normalize persistence model to domain model.
 * Converts persistence "targets" field to semantic "targets" field.
 *
 * @param {SessionPersistenceModel} persistenceSession - Session from DB/persistence layer
 * @returns {SessionDomainModel} - Normalized domain session
 */
export function toDomainModel(persistenceSession) {
  const { targets, ...rest } = persistenceSession;

  return {
    ...rest,
    targets,
  };
}

/**
 * Convert domain model back to persistence model.
 * Only used at persistence boundaries (DB writes).
 *
 * @param {SessionDomainModel} domainSession - Domain session object
 * @returns {SessionPersistenceModel} - Persistence-ready session
 */
export function toPersistenceModel(domainSession) {
  const { targets, ...rest } = domainSession;

  return {
    ...rest,
    targets,
  };
}

/**
 * Check if an object is in persistence model format (has "targets" field).
 * Useful for validation and debugging.
 *
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isPersistenceModel(obj) {
  return typeof obj === 'object' && obj !== null && 'targets' in obj;
}

/**
 * Check if an object is in domain model format (has "targets" field).
 * Useful for validation and debugging.
 *
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isDomainModel(obj) {
  return typeof obj === 'object' && obj !== null && 'targets' in obj;
}
