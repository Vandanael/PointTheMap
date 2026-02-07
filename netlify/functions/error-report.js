// POST /.netlify/functions/error-report
// Receives batched client errors and inserts into error_logs table

import { getDatabase } from './db.js';
import { jsonResponse, parseJsonBody, getClientIp, createLogger } from './_utils.js';

const logger = createLogger('error-report');

const MAX_ERRORS_PER_BATCH = 10;
const MAX_STACK_LENGTH = 4096;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 20;

/** @type {Map<string, { count: number, expiresAt: number }>} */
const rateLimits = new Map();

/**
 * @param {string} ip
 * @returns {boolean}
 */
const checkRateLimit = (ip) => {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.expiresAt) {
    rateLimits.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
};

/**
 * @param {Request} req
 * @param {any} context
 * @returns {Promise<Response>}
 */
export default async function errorReportHandler(req, context) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const ip = getClientIp(req, context);
  if (!checkRateLimit(ip)) {
    return jsonResponse({ error: 'Rate limit exceeded' }, 429);
  }

  const body = await parseJsonBody(req);
  const errors = body?.errors;

  if (!Array.isArray(errors) || errors.length === 0) {
    return jsonResponse({ error: 'Missing errors array' }, 400);
  }

  if (errors.length > MAX_ERRORS_PER_BATCH) {
    return jsonResponse({ error: `Max ${MAX_ERRORS_PER_BATCH} errors per batch` }, 400);
  }

  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    logger.error('Database connection failed:', /** @type {Error} */ (dbError).message);
    return jsonResponse({ error: 'Service unavailable' }, 503);
  }

  const userAgent = req.headers.get('user-agent') || '';
  const url = req.headers.get('referer') || '';

  try {
    for (const err of errors) {
      if (!err.message || typeof err.message !== 'string') continue;

      const message = err.message.slice(0, 1000);
      const stack = typeof err.stack === 'string' ? err.stack.slice(0, MAX_STACK_LENGTH) : null;
      const errorContext =
        typeof err.context === 'string' ? err.context.slice(0, 100) : null;
      const errorType = typeof err.type === 'string' ? err.type.slice(0, 50) : null;

      await sql`
        INSERT INTO error_logs (message, stack, context, error_type, url, user_agent)
        VALUES (${message}, ${stack}, ${errorContext}, ${errorType}, ${url}, ${userAgent})
      `;
    }
  } catch (dbError) {
    logger.error('Failed to insert error logs:', /** @type {Error} */ (dbError).message);
    return jsonResponse({ error: 'Failed to store errors' }, 500);
  }

  return new Response(null, { status: 204 });
}
