// POST /.netlify/functions/cleanup-error-logs

import { getDatabase } from './db.js';
import { createLogger, errorEnvelope, successEnvelope } from './_utils.js';

const logger = createLogger('cleanup-error-logs');
const retentionDaysRaw = Number.parseInt(process.env.ERROR_LOG_RETENTION_DAYS || '30', 10);
const ERROR_LOG_RETENTION_DAYS =
  Number.isFinite(retentionDaysRaw) && retentionDaysRaw > 0 ? retentionDaysRaw : 30;

/**
 * @param {Request} req
 * @param {any} context
 * @returns {Promise<Response>}
 */
export default async function cleanupErrorLogsHandler(req, context) {
  if (req.method !== 'POST') {
    return errorEnvelope('method_not_allowed', 'Method not allowed', 405);
  }

  const maintenanceToken = process.env.MAINTENANCE_TOKEN;
  if (maintenanceToken) {
    const token = req.headers.get('x-maintenance-token');
    if (token !== maintenanceToken) {
      return errorEnvelope('forbidden', 'Invalid maintenance token', 403);
    }
  }

  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    logger.error('Database connection failed:', /** @type {Error} */ (dbError).message);
    return errorEnvelope(
      'db_connection_failed',
      'Database connection failed. Please try again later.',
      503
    );
  }

  try {
    const deleted = await sql`
      DELETE FROM error_logs
      WHERE created_at < NOW() - (${ERROR_LOG_RETENTION_DAYS} * INTERVAL '1 day')
      RETURNING id
    `;

    return successEnvelope({
      deleted: Array.isArray(deleted) ? deleted.length : 0,
      retentionDays: ERROR_LOG_RETENTION_DAYS,
    });
  } catch (error) {
    const err = /** @type {Error} */ (error);
    logger.error('Failed to cleanup error logs:', err.message);
    return errorEnvelope('cleanup_failed', 'Failed to cleanup error logs', 500);
  }
}
