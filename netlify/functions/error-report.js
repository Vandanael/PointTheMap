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
const MAX_ERROR_REPORT_BYTES = 32 * 1024;

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
 * @param {string | null} value
 * @returns {string}
 */
const sanitizeUrl = (value) => {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 512);
  } catch {
    return '';
  }
};

/**
 * @param {string | null | undefined} input
 * @param {number} [maxLength]
 * @returns {string | null}
 */
const redactSensitiveText = (input, maxLength = 1000) => {
  if (typeof input !== 'string') return null;
  const redacted = input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[REDACTED_IP]')
    .replace(/\b(?:bearer|token|apikey|api_key|authorization)[\s=:]+[^\s]+/gi, '$1=[REDACTED]');
  return redacted.slice(0, maxLength);
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

  const contentLength = Number.parseInt(req.headers.get('content-length') || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_ERROR_REPORT_BYTES) {
    return errorEnvelope('payload_too_large', 'Error report payload too large', 413);
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
  const bodySize = Buffer.byteLength(JSON.stringify(body || {}), 'utf8');
  if (bodySize > MAX_ERROR_REPORT_BYTES) {
    return errorEnvelope('payload_too_large', 'Error report payload too large', 413);
  }

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
  const userAgent = redactSensitiveText(req.headers.get('user-agent') || '', 512) || '';
  const url = sanitizeUrl(req.headers.get('referer') || req.referrer || null);

  try {
    for (const err of errors) {
      const message = redactSensitiveText(err.message, 1000) || 'unknown';
      const stack = redactSensitiveText(err.stack ?? null, 4096);
      const errorContext = redactSensitiveText(err.context ?? null, 100);
      const errorType = redactSensitiveText(err.type ?? null, 50);

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
