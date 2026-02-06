/**
 * Middleware functions for Netlify functions
 * Centralized cross-cutting concerns like database connection
 */

import { getDatabase } from './db.js';
import { errorResponse, handleDatabaseError, createLogger } from './_utils.js';

const logger = createLogger('middleware');

/**
 * Middleware to attach database connection to context
 * Handles database connection errors centrally
 *
 * Usage:
 * ```javascript
 * import { withDatabase } from './_middleware.js';
 *
 * const handler = async (req, context) => {
 *   const sql = context.sql; // Database already connected!
 *   // ... rest of logic
 * };
 *
 * export default withDatabase(handler);
 * ```
 *
 * @param {Function} handler - Function handler (req, context) => Promise<Response>
 * @returns {Function} Wrapped handler with database connection
 */
export function withDatabase(handler) {
  /**
   * @param {Request} req - Netlify request
   * @param {Record<string, unknown>} context - Netlify context (will have sql attached)
   */
  return async (req, context) => {
    // Attempt database connection
    let sql;
    try {
      sql = getDatabase(context);
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      logger.error('Database connection failed:', errorMessage);
      return errorResponse('Database connection failed. Please try again later.', 503);
    }

    // Attach to context for handler access
    context.sql = sql;

    // Execute handler with database available - never re-throw to avoid 502
    try {
      return await handler(req, context);
    } catch (error) {
      const err = /** @type {Error & { code?: string }} */ (error);
      if (err?.code || err?.message?.includes('database')) {
        return handleDatabaseError(err, 'middleware');
      }
      // Log and return 500 instead of re-throwing (unhandled exceptions → 502 in production)
      logger.error('Unhandled error:', err?.message, err?.stack);
      return errorResponse('An error occurred. Please try again later.', 500);
    }
  };
}

/**
 * Middleware to validate HTTP method
 *
 * Usage:
 * ```javascript
 * export default withMethod('POST', withDatabase(handler));
 * ```
 *
 * @param {string} expectedMethod - Expected HTTP method (GET, POST, etc.)
 * @param {Function} handler - Function handler
 * @returns {Function} Wrapped handler with method validation
 */
export function withMethod(expectedMethod, handler) {
  /**
   * @param {Request} req - Netlify request
   * @param {Record<string, unknown>} context - Netlify context
   */
  return async (req, context) => {
    if (req.method !== expectedMethod) {
      return errorResponse('Method not allowed', 405);
    }
    return await handler(req, context);
  };
}

/**
 * Compose multiple middleware functions
 * Applies middleware from right to left (like function composition)
 *
 * Usage:
 * ```javascript
 * export default compose(
 *   withMethod('POST'),
 *   withDatabase
 * )(handler);
 * ```
 *
 * @param {...Function} middlewares - Middleware functions to compose
 * @returns {Function} Composed middleware function
 */
export function compose(...middlewares) {
  /**
   * @param {Function} handler - Handler (req, context) => Promise<Response>
   */
  return (handler) => {
    return middlewares.reduceRight(
      (wrappedHandler, middleware) => middleware(wrappedHandler),
      handler
    );
  };
}
