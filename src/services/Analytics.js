/**
 * Analytics Service
 *
 * Privacy-first analytics with Plausible.
 * Sends custom events to Plausible (loaded in index.html) in production.
 */

import { logger } from '../utils/logger.js';

class Analytics {
  #enabled = false;
  #privacyDisabled = false;

  /**
   * Initialize analytics system
   * Enabled in production
   */
  init() {
    this.#privacyDisabled = this.#isPrivacyOptOutEnabled();
    this.#enabled = import.meta.env.PROD && !this.#privacyDisabled;

    if (this.#enabled) {
      logger.info('Analytics: Initialized');
    } else if (this.#privacyDisabled) {
      logger.info('Analytics: Disabled (privacy signal detected)');
    } else {
      logger.info('Analytics: Not initialized (dev mode)');
    }
  }

  /**
   * Track an event
   * @param {string} event - Event name (e.g., 'game_started', 'round_completed')
   * @param {Object} properties - Event properties
   */
  track(event, properties = {}) {
    if (!this.#enabled) {
      // Log in development for debugging
      logger.debug(`[Analytics] ${event}`, properties);
      return;
    }

    // Send to analytics provider
    try {
      this.#sendToProvider(event, properties);
    } catch (error) {
      logger.error('Analytics: Failed to track event', error);
    }
  }

  /**
   * Send event to Plausible (custom events show in Plausible dashboard)
   * @param {string} event - Event name (e.g. 'game_started', 'game_completed')
   * @param {Object} properties - Event properties
   */
  #sendToProvider(event, properties) {
    if (this.#privacyDisabled) return;
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible(event, { props: properties });
    }
    logger.debug(`[Analytics] Event tracked: ${event}`, properties);
  }

  /**
   * Respect global privacy signals (GPC / DNT).
   * @returns {boolean}
   */
  #isPrivacyOptOutEnabled() {
    try {
      if (typeof navigator === 'undefined') return false;
      const gpc = /** @type {any} */ (navigator).globalPrivacyControl === true;
      const dnt =
        navigator.doNotTrack === '1' ||
        (typeof window !== 'undefined' && /** @type {any} */ (window).doNotTrack === '1');
      return gpc || dnt;
    } catch {
      return false;
    }
  }

  // Consent is intentionally not required for Plausible.
}

// Export singleton instance
export const analytics = new Analytics();
