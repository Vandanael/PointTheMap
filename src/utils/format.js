/**
 * Format score with thousands separator
 * @param {number} score - Score to format
 * @returns {string} Formatted score
 */
export const formatScore = (score) => Math.round(score).toLocaleString('fr-FR');
