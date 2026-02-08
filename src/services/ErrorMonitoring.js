/**
 * Error Monitoring Service
 *
 * Centralized error tracking and reporting.
 * Batches errors and sends them to /api/error-report.
 */

import { logger } from '../utils/logger.js';
import { eventBus } from '../core/EventBus.js';

const MAX_QUEUE_SIZE = 20;
const MAX_DEDUPE_KEYS = 200;
const FLUSH_DELAY_MS = 5000;
const ERROR_REPORT_URL = '/api/error-report';

class ErrorMonitoring {
  #enabled = false;
  #initialized = false;
  #providerReady = false;
  /** @type {Array<{message: string, stack?: string, context?: string, type?: string}>} */
  #queue = [];
  /** @type {ReturnType<typeof setTimeout> | null} */
  #flushTimeout = null;
  /** @type {Set<string>} */
  #seen = new Set();
  /** @type {string[]} */
  #seenOrder = [];

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

  #initializeProvider() {
    this.#providerReady = true;
    window.addEventListener('beforeunload', () => this.#flush());
  }

  /**
   * Setup global error handlers
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
   * Queue error for batched sending
   * @param {Error|string} error - Error object or message
   * @param {Object} context - Additional context
   */
  #sendToProvider(error, context) {
    const serialized = this.#serializeError(error);
    const contextStr = context?.type || context?.message || '';
    const dedupeKey = serialized.message + '|' + contextStr;

    if (this.#seen.has(dedupeKey)) return;
    this.#seen.add(dedupeKey);
    this.#seenOrder.push(dedupeKey);
    if (this.#seenOrder.length > MAX_DEDUPE_KEYS) {
      const oldest = this.#seenOrder.shift();
      if (oldest) this.#seen.delete(oldest);
    }

    this.#queue.push({
      message: serialized.message,
      stack: serialized.stack,
      context: contextStr.slice(0, 100),
      type: serialized.name,
    });

    // Cap queue size
    if (this.#queue.length > MAX_QUEUE_SIZE) {
      this.#queue.shift();
    }

    // Debounce flush
    if (this.#flushTimeout) clearTimeout(this.#flushTimeout);
    this.#flushTimeout = setTimeout(() => this.#flush(), FLUSH_DELAY_MS);
  }

  /**
   * Send queued errors to the server
   */
  #flush() {
    if (this.#queue.length === 0 || !this.#providerReady) return;

    const errors = this.#queue.splice(0);
    this.#flushTimeout = null;
    const payload = JSON.stringify({ errors });

    // Use sendBeacon for reliability (works during page unload)
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(ERROR_REPORT_URL, blob);
    } else {
      fetch(ERROR_REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silently fail — we can't report errors about error reporting
      });
    }
  }

  /**
   * Serialize error for transmission
   * @param {Error|string} error - Error to serialize
   * @returns {{ message: string, stack?: string, name?: string }}
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
   * @param {Object} _user - User information (no PII)
   */
  setUser(_user) {
    if (!this.#enabled) return;

    logger.debug('[ErrorMonitoring] User context set');
  }
}

// Export singleton instance
export const errorMonitoring = new ErrorMonitoring();
