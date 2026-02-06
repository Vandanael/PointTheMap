/**
 * Error Monitoring Service
 *
 * Centralized error tracking and reporting
 * Ready to connect to: Sentry, Rollbar, or custom error tracking
 */

import { logger } from '../utils/logger.js';
import { eventBus } from '../core/EventBus.js';

class ErrorMonitoring {
  #enabled = false;
  #initialized = false;

  /**
   * Initialize error monitoring
   * Only enabled in production
   */
  init() {
    // Only enable in production
    this.#enabled = import.meta.env.PROD;

    if (this.#enabled) {
      this.#initializeProvider();
      this.#setupGlobalHandlers();
      this.#subscribeToEvents();
      this.#initialized = true;
      logger.info('ErrorMonitoring: Initialized');
    } else {
      logger.info('ErrorMonitoring: Not initialized (dev mode)');
    }
  }

  /**
   * Initialize error monitoring provider (Sentry, Rollbar, etc.)
   * @private
   */
  #initializeProvider() {}

  /**
   * Setup global error handlers
   * @private
   */
  #setupGlobalHandlers() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error, {
        type: 'unhandled_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(event.reason, {
        type: 'unhandled_rejection',
        promise: event.promise,
      });
    });
  }

  /**
   * Subscribe to application error events
   * @private
   */
  #subscribeToEvents() {
    eventBus.subscribe('error:occurred', ({ error, context }) => {
      this.captureError(error, context);
    });
  }

  /**
   * Capture an error and send to monitoring service
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context about the error
   */
  captureError(error, context = {}) {
    if (!this.#enabled) {
      // Log in development
      logger.error('[ErrorMonitoring]', error, context);
      return;
    }

    try {
      this.#sendToProvider(error, context);
    } catch (sendError) {
      // Don't let error monitoring itself cause errors
      logger.error('ErrorMonitoring: Failed to capture error', sendError);
    }
  }

  /**
   * Send error to monitoring provider
   * @private
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   */
  #sendToProvider(error, context) {
    // For now, just log
    logger.error('[ErrorMonitoring] Error captured:', error, context);
  }

  /**
   * Serialize error for transmission
   * @private
   * @param {Error|string} error - Error to serialize
   * @returns {Object} Serialized error
   */
  #serializeError(error) {
    if (typeof error === 'string') {
      return { message: error };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    return { message: String(error) };
  }

  /**
   * Send data using sendBeacon for reliability
   * @private
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
   * Capture a message (non-error event)
   * @param {string} message - Message to capture
   * @param {Object} context - Additional context
   * @param {string} level - Severity level (info, warning, error)
   */
  captureMessage(message, context = {}, level = 'info') {
    if (!this.#enabled) {
      logger[level](`[ErrorMonitoring] ${message}`, context);
      return;
    }

    logger[level](`[ErrorMonitoring] Message: ${message}`, context);
  }

  /**
   * Set user context for error tracking
   * @param {Object} user - User information (no PII)
   */
  setUser(_user) {
    if (!this.#enabled) return;

    logger.debug('[ErrorMonitoring] User context set');
  }
}

// Export singleton instance
export const errorMonitoring = new ErrorMonitoring();
