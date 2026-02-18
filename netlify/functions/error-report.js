// POST /.netlify/functions/error-report
// Receives batched client errors and inserts into error_logs table

import { ErrorReportSchema } from '../../lib/schemas/error-report.js';
import { getDatabase } from './db.js';
import {
  errorEnvelope,
  successEnvelope,
  parseJsonBody,
  getClientIp,
  createLogger,
} from './_utils.js';
import { createFallbackRateLimiter, checkDbRateLimit } from './_rate-limit.js';

const logger = createLogger('error-report');

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
    return errorEnvelope('method_not_allowed', 'Method not allowed', 405);
  }

  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    logger.error('Database connection failed:', /** @type {Error} */ (dbError).message);
    return errorEnvelope('service_unavailable', 'Service unavailable', 503);
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
    return errorEnvelope('rate_limited', 'Rate limit exceeded', 429);
  }

  const body = await parseJsonBody(req);
  const parsed = ErrorReportSchema.safeParse(body);
  if (!parsed.success) {
    return errorEnvelope(
      'invalid_error_report_payload',
      'Invalid error report payload',
      400,
      parsed.error.flatten()
    );
  }

  const { errors } = parsed.data;
  const userAgent = req.headers.get('user-agent') || '';
  const url = req.headers.get('referer') || '';

  try {
    for (const err of errors) {
      const message = err.message;
      const stack = err.stack ?? null;
      const errorContext = err.context ?? null;
      const errorType = err.type ?? null;

      await sql`
        INSERT INTO error_logs (message, stack, context, error_type, url, user_agent)
        VALUES (${message}, ${stack}, ${errorContext}, ${errorType}, ${url}, ${userAgent})
      `;
    }
  } catch (dbError) {
    if (isMissingErrorLogsTable(dbError)) {
      logger.warn('error_logs table missing; dropping error report payload');
      return successEnvelope({ stored: false, reason: 'table_missing' });
    }
    logger.error('Failed to insert error logs:', /** @type {Error} */ (dbError).message);
    return errorEnvelope('store_failed', 'Failed to store errors', 500);
  }

  return successEnvelope({ stored: true });
}
