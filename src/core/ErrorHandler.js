// Point The Map - Centralized Error Handler
// Sprint 6 - Error handling system

import { logger } from "../utils/logger.js";
import { eventBus } from "./EventBus.js";

/**
 * @typedef {'NETWORK_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'API_ERROR' | 'GAME_ERROR' | 'STORAGE_ERROR' | 'UNKNOWN'} ErrorCode
 */

/**
 * Custom error class for game-specific errors
 */
export class GameError extends Error {
  /**
   * @param {string} message - Error message
   * @param {ErrorCode} code - Error code
   * @param {any} [context] - Additional context
   */
  constructor(message, code = 'UNKNOWN', context = null) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.context = context;
    this.timestamp = Date.now();
  }
}

/**
 * Custom error class for API-specific errors
 */
export class APIError extends Error {
  /**
   * @param {string} message - Error message
   * @param {number} status - HTTP status code
   * @param {any} [data] - Response data
   */
  constructor(message, status, data = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
    this.code = status === 429 ? 'RATE_LIMIT' : status >= 500 ? 'SERVER_ERROR' : 'API_ERROR';
    this.timestamp = Date.now();
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   */
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.field = field;
    this.timestamp = Date.now();
  }
}

/**
 * Centralized error handler
 */
class ErrorHandler {
  constructor() {
    this.errorCounts = {};
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error, 'unhandled');
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError(event.reason, 'promise');
    });
  }

  /**
   * Handle any error
   * @param {Error} error - The error object
   * @param {string} context - Context where error occurred
   * @param {Object} options - Handler options
   * @param {boolean} options.showToUser - Whether to show error to user
   * @param {boolean} options.fatal - Whether error is fatal
   */
  handle(error, context = 'unknown', options = {}) {
    const { showToUser = true, fatal = false } = options;

    // Track error for monitoring
    this.trackError(error, context);

    // Log error
    const logLevel = fatal ? 'fatal' : 'error';
    logger[logLevel](`[${context}]`, error.message, error);

    // Emit error event for monitoring
    eventBus.emit('error:occurred', {
      error,
      context,
      fatal,
      timestamp: Date.now(),
    });

    // Show to user if needed
    if (showToUser) {
      this.showUserError(error, context);
    }

    // Handle fatal errors
    if (fatal) {
      this.handleFatalError(error, context);
    }

    return error;
  }

  /**
   * Handle global errors
   * @private
   */
  handleGlobalError(error, type) {
    logger.error(`[global-${type}]`, error);

    // Don't show UI for every global error (too noisy)
    // Only track and log
    this.trackError(error, `global-${type}`);

    eventBus.emit('error:global', {
      error,
      type,
      timestamp: Date.now(),
    });
  }

  /**
   * Track error for monitoring
   * @private
   */
  trackError(error, context) {
    const key = `${context}:${error.code || error.name || 'unknown'}`;
    this.errorCounts[key] = (this.errorCounts[key] || 0) + 1;
  }

  /**
   * Show error to user
   * @private
   */
  showUserError(error, context) {
    // Determine user-friendly message based on error type
    let message = 'Une erreur est survenue';

    if (error instanceof APIError) {
      if (error.status === 429) {
        message = 'Trop de requêtes. Veuillez patienter.';
      } else if (error.status === 403) {
        message = 'Accès refusé. Veuillez recommencer une partie.';
      } else if (error.status >= 500) {
        message = 'Erreur serveur. Veuillez réessayer.';
      } else if (error.status === 401) {
        message = 'Session expirée. Veuillez recommencer une partie.';
      } else {
        message = error.message;
      }
    } else if (error instanceof ValidationError) {
      message = error.message;
    } else if (error instanceof GameError) {
      if (error.code === 'NETWORK_ERROR') {
        message = 'Erreur réseau. Vérifiez votre connexion.';
      } else if (error.code === 'TIMEOUT') {
        message = 'Délai d\'attente dépassé.';
      } else {
        message = error.message;
      }
    } else if (error.message.includes('fetch')) {
      message = 'Erreur réseau. Vérifiez votre connexion.';
    }

    // Emit event for UI to show error
    eventBus.emit('error:show', { message, error, context });
  }

  /**
   * Handle fatal errors
   * @private
   */
  handleFatalError(error, context) {
    logger.fatal(`[FATAL][${context}]`, error);

    // Show fatal error UI
    eventBus.emit('error:fatal', {
      error,
      context,
      timestamp: Date.now(),
    });

    // In production, might want to reload or show recovery UI
    if (import.meta.env.PROD) {
      // Give user option to reload
      setTimeout(() => {
        if (confirm('Une erreur critique est survenue. Recharger la page ?')) {
          window.location.reload();
        }
      }, 100);
    }
  }

  /**
   * Wrap an async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} context - Context name
   * @param {Object} options - Handler options
   * @returns {Function} Wrapped function
   */
  wrap(fn, context, options = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handle(error, context, options);
        throw error; // Re-throw after handling
      }
    };
  }

  /**
   * Get error statistics
   * @returns {Object} Error counts by type
   */
  getStats() {
    return { ...this.errorCounts };
  }

  /**
   * Clear error statistics
   */
  clearStats() {
    this.errorCounts = {};
  }

  /**
   * Check if error is recoverable
   * @param {Error} error - Error to check
   * @returns {boolean} True if recoverable
   */
  isRecoverable(error) {
    if (error instanceof APIError) {
      // Rate limits and server errors are recoverable
      return error.status === 429 || error.status >= 500;
    }
    if (error instanceof GameError) {
      return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT';
    }
    return false;
  }
}

// Singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Helper to safely execute async functions with error handling
 * @param {Function} fn - Async function to execute
 * @param {string} context - Context name
 * @param {any} fallback - Fallback value on error
 * @returns {Promise<any>} Result or fallback
 */
export const safeAsync = async (fn, context, fallback = null) => {
  try {
    return await fn();
  } catch (error) {
    errorHandler.handle(error, context, { showToUser: true });
    return fallback;
  }
};

/**
 * Helper to safely execute sync functions with error handling
 * @param {Function} fn - Function to execute
 * @param {string} context - Context name
 * @param {any} fallback - Fallback value on error
 * @returns {any} Result or fallback
 */
export const safe = (fn, context, fallback = null) => {
  try {
    return fn();
  } catch (error) {
    errorHandler.handle(error, context, { showToUser: true });
    return fallback;
  }
};
