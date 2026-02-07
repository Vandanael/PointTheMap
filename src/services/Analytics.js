/**
 * Analytics Service
 *
 * Privacy-first analytics with user consent.
 * Sends custom events to Plausible (loaded in index.html) when consent is given and in production.
 */

import { storageManager } from '../storage/StorageManager.js';
import { logger } from '../utils/logger.js';

class Analytics {
  #enabled = false;
  #queue = [];
  #consentGiven = false;

  /**
   * Initialize analytics system
   * Checks for user consent and flushes queued events
   */
  init() {
    // Check for user consent (respects privacy)
    const consent = storageManager.get('analytics-consent');
    this.#consentGiven = consent === true;
    this.#enabled = this.#consentGiven && import.meta.env.PROD;

    if (this.#enabled) {
      this.#flushQueue();
      logger.info('Analytics: Initialized with consent');
    } else {
      logger.info('Analytics: Not initialized (consent not given or dev mode)');
    }
  }

  /**
   * Track an event
   * @param {string} event - Event name (e.g., 'game_started', 'round_completed')
   * @param {Object} properties - Event properties
   */
  track(event, properties = {}) {
    if (!this.#consentGiven) {
      // Queue events even without consent, in case user consents later
      this.#queue.push({ event, properties, timestamp: Date.now() });

      // Limit queue size to prevent memory issues
      if (this.#queue.length > 100) {
        this.#queue.shift();
      }
      return;
    }

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

  /**
   * Flush queued events (called after user gives consent)
   */
  #flushQueue() {
    if (this.#queue.length === 0) return;

    logger.info(`Analytics: Flushing ${this.#queue.length} queued events`);

    this.#queue.forEach(({ event, properties }) => {
      this.#sendToProvider(event, properties);
    });

    this.#queue = [];
  }

  /**
   * Set user consent for analytics
   * @param {boolean} consent - User consent status
   */
  setConsent(consent) {
    storageManager.set('analytics-consent', consent);
    this.#consentGiven = consent;
    this.#enabled = consent && import.meta.env.PROD;

    if (consent) {
      this.#flushQueue();
      logger.info('Analytics: Consent given, tracking enabled');
    } else {
      logger.info('Analytics: Consent revoked, tracking disabled');
    }
  }

  /**
   * Check if user has given consent
   * @returns {boolean} Consent status
   */
  hasConsent() {
    return this.#consentGiven;
  }
}

// Export singleton instance
export const analytics = new Analytics();
