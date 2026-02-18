/**
 * Shared API Utilities
 * Common response helpers and utilities for Netlify functions
 */

/**
 * @typedef {'debug' | 'info' | 'log' | 'warn' | 'error'} LogLevel
 */

/** @type {Record<LogLevel, number>} */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  log: 2,
  warn: 3,
  error: 4,
};

const isDev = process.env.NODE_ENV === 'development';
const minLevel =
  LOG_LEVELS[/** @type {LogLevel} */ (process.env.LOG_LEVEL || (isDev ? 'debug' : 'warn'))] ??
  LOG_LEVELS.warn;

/**
 * Create a scoped logger for serverless functions.
 * @param {string} [context='app'] - Log context label
 * @returns {{ debug: (...args: any[]) => void, info: (...args: any[]) => void, log: (...args: any[]) => void, warn: (...args: any[]) => void, error: (...args: any[]) => void }}
 */
export function createLogger(context = 'app') {
  /** @param {LogLevel} level @param {any[]} args */
  const log = (level, ...args) => {
    if (LOG_LEVELS[level] < minLevel) return;
    const prefix = `[${context}]`;
    const method = level === 'log' ? 'log' : level;
    console[method](prefix, ...args);
  };

  return {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    log: (...args) => log('log', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
  };
}

const utilsLogger = createLogger('utils');

const SENSITIVE_LOG_KEYS = new Set([
  'token',
  'sessionToken',
  'csrfToken',
  'csrf_token',
  'pseudo',
  'click',
  'rounds',
  'authorization',
]);

/**
 * Redact an identifier-like token for logs.
 * @param {unknown} value
 * @returns {string}
 */
export function redactToken(value) {
  if (typeof value !== 'string' || value.length === 0) return '[redacted]';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

/**
 * Redact potentially sensitive fields recursively for logging.
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactForLog(value) {
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (!value || typeof value !== 'object') return value;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (SENSITIVE_LOG_KEYS.has(key)) {
      out[key] = key.toLowerCase().includes('token')
        ? redactToken(fieldValue)
        : '[redacted]';
      continue;
    }
    out[key] = fieldValue && typeof fieldValue === 'object' ? redactForLog(fieldValue) : fieldValue;
  }
  return out;
}

/**
 * Create JSON response
 * @param {*} data - Response data
 * @param {number} [status=200] - HTTP status code
 * @param {Record<string, string>} [additionalHeaders={}] - Additional headers
 * @returns {Response} JSON response
 */
export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    'x-api-version': '2',
    ...additionalHeaders,
  };
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

/**
 * Create standardized error response envelope.
 * @param {string} code
 * @param {string} message
 * @param {number} [status=400]
 * @param {unknown} [details]
 * @param {Record<string, string>} [additionalHeaders]
 * @returns {Response}
 */
export function errorEnvelope(
  code,
  message,
  status = 400,
  details = undefined,
  additionalHeaders = undefined
) {
  return jsonResponse(
    {
      ok: false,
      error: { code, message, details },
    },
    status,
    additionalHeaders
  );
}

/**
 * Create standardized success response envelope.
 * @param {unknown} data
 * @param {Record<string, string>} [additionalHeaders]
 * @param {unknown} [meta]
 * @param {number} [status=200]
 * @returns {Response}
 */
export function successEnvelope(data, additionalHeaders = {}, meta = undefined, status = 200) {
  return jsonResponse(
    {
      ok: true,
      data,
      ...(meta !== undefined ? { meta } : {}),
    },
    status,
    additionalHeaders
  );
}

/**
 * Backward-compatible wrapper mapped to envelope.
 * @param {string} message
 * @param {number} [status=500]
 * @returns {Response}
 */
export function errorResponse(message, status = 500) {
  return errorEnvelope('request_failed', message, status);
}

/**
 * Backward-compatible wrapper mapped to envelope.
 * @param {unknown} data
 * @param {Record<string, string>} [additionalHeaders]
 * @returns {Response}
 */
export function successResponse(data, additionalHeaders = {}) {
  return successEnvelope(data, additionalHeaders);
}

/**
 * Check if error is a database connection error
 * @param {unknown} error - Error object
 * @returns {boolean} True if connection error
 */
export function isDatabaseConnectionError(error) {
  const err = /** @type {{ message?: string, code?: string }} */ (error);
  const errorMessage = err?.message || '';
  const errorCode = err?.code;

  return (
    errorMessage.includes('Failed to connect') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENOTFOUND'
  );
}

/**
 * Check if error is a missing column error (migration needed)
 * @param {unknown} error - Error object
 * @returns {boolean} True if missing column error
 */
export function isMissingColumnError(error) {
  const err = /** @type {{ message?: string, code?: string }} */ (error);
  const errorMessage = err?.message || '';
  const errorCode = err?.code;

  return errorCode === '42703' && errorMessage.includes('does not exist');
}

/**
 * Handle database error and return appropriate response
 * @param {unknown} error - Error object
 * @param {string} [context=''] - Error context for logging
 * @returns {Response} Error response
 */
export function handleDatabaseError(error, context = '') {
  const err = /** @type {{ message?: string, code?: string, stack?: string }} */ (error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = err?.code;

  if (isDev) {
    utilsLogger.error(`[${context}] Database error:`, errorMessage, errorCode, err?.stack);
  } else {
    utilsLogger.error(`[${context}] Database error occurred`);
  }

  if (isDatabaseConnectionError(error)) {
    return errorEnvelope(
      'db_connection_error',
      'Database connection error. Please try again later.',
      503
    );
  }

  if (isMissingColumnError(error)) {
    return errorEnvelope(
      'db_schema_error',
      'Database schema error: missing column. Please run the migration script.',
      500
    );
  }

  return errorEnvelope('db_error', 'Database error. Please try again later.', 500);
}

/**
 * Validate request method
 * @param {Request} req - Request object
 * @param {string} expectedMethod - Expected HTTP method
 * @returns {Response|null} Error response if invalid, null if valid
 */
export function validateMethod(req, expectedMethod) {
  if (req.method !== expectedMethod) {
    return errorEnvelope('method_not_allowed', 'Method not allowed', 405);
  }
  return null;
}

/**
 * Extract client IP from request
 * @param {Request} req - Request object
 * @param {{ ip?: string } | undefined} context - Netlify context
 * @returns {string} Client IP address
 */
export function getClientIp(req, context) {
  const contextIp = context?.ip;
  if (contextIp) return String(contextIp).split(',')[0].trim();

  const edgeIp = req.headers.get('x-nf-client-connection-ip');
  if (edgeIp) return String(edgeIp).split(',')[0].trim();

  // In local/dev tooling we allow x-forwarded-for fallback for convenience.
  if (process.env.NODE_ENV !== 'production') {
    const forwardedIp = req.headers.get('x-forwarded-for');
    if (forwardedIp) return String(forwardedIp).split(',')[0].trim();
  }

  return 'unknown';
}

/**
 * Parse request body as JSON with error handling
 * @param {Request} req - Request object
 * @returns {Promise<Object>} Parsed JSON or empty object
 */
export async function parseJsonBody(req) {
  try {
    return await req.json();
  } catch {
    utilsLogger.warn('Failed to parse JSON body');
    return {};
  }
}

/**
 * Validate that required fields are present in request body
 * @param {Record<string, unknown>} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Response|null} Error response if validation fails, null if valid
 */
export function validateRequiredFields(body, requiredFields) {
  for (const field of requiredFields) {
    if (!(field in body) || body[field] === null || body[field] === undefined) {
      return errorEnvelope('missing_required_field', `Missing required field: ${field}`, 400);
    }
  }
  return null;
}
