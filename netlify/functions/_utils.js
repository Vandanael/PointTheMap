/**
 * Shared API Utilities
 * Common response helpers and utilities for Netlify functions
 */

/**
 * Create JSON response
 * @param {*} data - Response data
 * @param {number} [status=200] - HTTP status code
 * @param {Object} [additionalHeaders={}] - Additional headers
 * @returns {Response} JSON response
 */
export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders
    }
  });
}

/**
 * Create error response
 * @param {string} message - Error message
 * @param {number} [status=500] - HTTP status code
 * @returns {Response} Error response
 */
export function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

/**
 * Create success response
 * @param {*} data - Success data
 * @param {Object} [additionalHeaders={}] - Additional headers
 * @returns {Response} Success response
 */
export function successResponse(data, additionalHeaders = {}) {
  return jsonResponse(data, 200, additionalHeaders);
}

/**
 * Check if error is a database connection error
 * @param {Error} error - Error object
 * @returns {boolean} True if connection error
 */
export function isDatabaseConnectionError(error) {
  const errorMessage = error?.message || '';
  const errorCode = error?.code;

  return (
    errorMessage.includes("Failed to connect") ||
    errorMessage.includes("connection") ||
    errorMessage.includes("timeout") ||
    errorCode === "ECONNREFUSED" ||
    errorCode === "ETIMEDOUT" ||
    errorCode === "ENOTFOUND"
  );
}

/**
 * Check if error is a missing column error (migration needed)
 * @param {Error} error - Error object
 * @returns {boolean} True if missing column error
 */
export function isMissingColumnError(error) {
  const errorMessage = error?.message || '';
  const errorCode = error?.code;

  return errorCode === '42703' && errorMessage.includes('does not exist');
}

/**
 * Handle database error and return appropriate response
 * @param {Error} error - Error object
 * @param {string} [context=''] - Error context for logging
 * @returns {Response} Error response
 */
export function handleDatabaseError(error, context = '') {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error?.code;

  // Log error details in development
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}] Database error:`, errorMessage, errorCode, error?.stack);
  } else {
    console.error(`[${context}] Database error occurred`);
  }

  // Connection errors
  if (isDatabaseConnectionError(error)) {
    return errorResponse(
      "Database connection error. Please try again later.",
      503
    );
  }

  // Missing column errors (migration needed)
  if (isMissingColumnError(error)) {
    return errorResponse(
      "Database schema error: missing column. Please run the migration script.",
      500
    );
  }

  // Generic database error
  return errorResponse("Database error. Please try again later.", 500);
}

/**
 * Validate request method
 * @param {Request} req - Request object
 * @param {string} expectedMethod - Expected HTTP method
 * @returns {Response|null} Error response if invalid, null if valid
 */
export function validateMethod(req, expectedMethod) {
  if (req.method !== expectedMethod) {
    return errorResponse("Method not allowed", 405);
  }
  return null;
}

/**
 * Extract client IP from request
 * @param {Request} req - Request object
 * @param {Object} context - Netlify context
 * @returns {string} Client IP address
 */
export function getClientIp(req, context) {
  const ip = context.ip || req.headers.get("x-forwarded-for") || "unknown";
  return ip.split(",")[0].trim();
}

/**
 * Parse request body as JSON with error handling
 * @param {Request} req - Request object
 * @returns {Promise<Object>} Parsed JSON or empty object
 */
export async function parseJsonBody(req) {
  try {
    return await req.json();
  } catch (error) {
    return {};
  }
}

/**
 * Validate that required fields are present in request body
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Response|null} Error response if validation fails, null if valid
 */
export function validateRequiredFields(body, requiredFields) {
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === null || body[field] === undefined) {
      return errorResponse(`Missing required field: ${field}`, 400);
    }
  }
  return null;
}
