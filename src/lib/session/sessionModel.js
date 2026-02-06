/**
 * Session Domain Model
 *
 * Provides a clear boundary between persistence model and domain model.
 *
 * LEGACY PERSISTENCE CONCERN:
 * The database column is named "capitals" for historical reasons, but it actually
 * stores generic session targets (capitals, countries, stadiums, civilizations).
 *
 * This module normalizes the persistence shape into a proper domain model:
 * - Persistence: { capitals: [...] }  ← Legacy DB column name
 * - Domain: { targets: [...] }        ← Semantic domain model
 *
 * Future DB Migration:
 * When ready to rename the DB column from "capitals" to "targets", only this
 * module and the DB schema need to change. All domain code is already prepared.
 */

/**
 * @typedef {Object} SessionPersistenceModel
 * @property {string} token
 * @property {unknown[]} capitals - Legacy field name; contains ANY target type
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
 * Converts legacy "capitals" field to semantic "targets" field.
 *
 * @param {SessionPersistenceModel} persistenceSession - Session from DB/persistence layer
 * @returns {SessionDomainModel} - Normalized domain session
 */
export function toDomainModel(persistenceSession) {
  const { capitals, ...rest } = persistenceSession;

  return {
    ...rest,
    targets: capitals, // Map legacy field to domain field
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
    capitals: targets, // Map domain field back to legacy DB field
  };
}

/**
 * Check if an object is in persistence model format (has "capitals" field).
 * Useful for validation and debugging.
 *
 * @param {unknown} obj
 * @returns {boolean}
 */
export function isPersistenceModel(obj) {
  return typeof obj === 'object' && obj !== null && 'capitals' in obj;
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
