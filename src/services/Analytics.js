/**
 * Analytics Service
 *
 * Privacy-first analytics with Plausible.
 * Sends custom events to Plausible (loaded in index.html) in production.
 */

import { logger } from '../utils/logger.js';

class Analytics {
  #enabled = false;

  /**
   * Initialize analytics system
   * Enabled in production
   */
  init() {
    this.#enabled = import.meta.env.PROD;

    if (this.#enabled) {
      logger.info('Analytics: Initialized');
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
    if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
      window.plausible(event, { props: properties });
    }
    logger.debug(`[Analytics] Event tracked: ${event}`, properties);
  }

  /**
   * Send data using sendBeacon for reliability
   * @param {string} url - Endpoint URL
   * @param {Object} data - Data to send
   */
  #sendBeacon(url, data) {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    }
  }

  // Consent is intentionally not required for Plausible.
}

// Export singleton instance
export const analytics = new Analytics();
