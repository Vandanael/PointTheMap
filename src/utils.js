// Point The Map - Utilitaires
// Fonctions pures et helpers

// Re-export haversine from shared library
export { haversine } from '@lib/game-math/index.js';

/**
 * Format score with thousands separator
 * @param {number} score - Score to format
 * @returns {string} Formatted score
 */
export const formatScore = (score) => Math.round(score).toLocaleString('fr-FR');

/**
 * Generate a simple unique ID
 * @returns {string} Unique ID
 */
export const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

/**
 * Detect iOS devices (iPhone, iPad, iPod)
 * @returns {boolean} True if iOS device
 */
export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ); // iPad avec iPadOS 13+
};

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};
