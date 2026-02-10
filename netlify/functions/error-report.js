// POST /.netlify/functions/error-report
// Receives batched client errors and inserts into error_logs table

import { getDatabase } from './db.js';
import { jsonResponse, parseJsonBody, getClientIp, createLogger } from './_utils.js';
import { createFallbackRateLimiter, checkDbRateLimit } from './_rate-limit.js';

const logger = createLogger('error-report');

const MAX_ERRORS_PER_BATCH = 10;
const MAX_STACK_LENGTH = 4096;
const RATE_LIMIT_MAX = 20;

const fallbackLimiter = createFallbackRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: RATE_LIMIT_MAX,
});

/**
 * @param {unknown} error
 * @returns {boolean}
 */
const isMissingErrorLogsTable = (error) => {
  const err = /** @type {{ code?: string, message?: string }} */ (error || {});
  if (err.code === '42P01') return true;
  if (typeof err.message !== 'string') return false;
  return /relation "error_logs" does not exist/i.test(err.message);
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

  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    logger.error('Database connection failed:', /** @type {Error} */ (dbError).message);
    return jsonResponse({ error: 'Service unavailable' }, 503);
  }

  const ip = getClientIp(req, context);
  const rateLimit = await checkDbRateLimit({
    ip,
    sql,
    keyPrefix: 'error-report-',
    maxRequests: RATE_LIMIT_MAX,
    fallback: fallbackLimiter,
    logger,
  });
  if (!rateLimit.allowed) {
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

  const userAgent = req.headers.get('user-agent') || '';
  const url = req.headers.get('referer') || '';

  try {
    for (const err of errors) {
      if (!err.message || typeof err.message !== 'string') continue;

      const message = err.message.slice(0, 1000);
      const stack = typeof err.stack === 'string' ? err.stack.slice(0, MAX_STACK_LENGTH) : null;
      const errorContext = typeof err.context === 'string' ? err.context.slice(0, 100) : null;
      const errorType = typeof err.type === 'string' ? err.type.slice(0, 50) : null;

      await sql`
        INSERT INTO error_logs (message, stack, context, error_type, url, user_agent)
        VALUES (${message}, ${stack}, ${errorContext}, ${errorType}, ${url}, ${userAgent})
      `;
    }
  } catch (dbError) {
    if (isMissingErrorLogsTable(dbError)) {
      logger.warn('error_logs table missing; dropping error report payload');
      return new Response(null, { status: 204 });
    }
    logger.error('Failed to insert error logs:', /** @type {Error} */ (dbError).message);
    return jsonResponse({ error: 'Failed to store errors' }, 500);
  }

  return new Response(null, { status: 204 });
}
