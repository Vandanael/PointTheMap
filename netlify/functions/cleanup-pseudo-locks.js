// POST /.netlify/functions/cleanup-pseudo-locks
// Deletes expired pseudo locks based on TTL.

import { getDatabase } from './db.js';
import { errorEnvelope, successEnvelope, createLogger } from './_utils.js';

const logger = createLogger('cleanup-pseudo-locks');

const ttlHoursFromEnv = Number.parseInt(process.env.PSEUDO_LOCK_TTL_HOURS || '720', 10);
const PSEUDO_LOCK_TTL_HOURS =
  Number.isFinite(ttlHoursFromEnv) && ttlHoursFromEnv > 0 ? ttlHoursFromEnv : 720;

const requireMaintenanceToken = process.env.MAINTENANCE_TOKEN || '';

/**
 * @param {Request} req
 * @param {any} context
 */
export default async function cleanupPseudoLocksHandler(req, context) {
  if (req.method !== 'POST') {
    return errorEnvelope('method_not_allowed', 'Method not allowed', 405);
  }

  if (requireMaintenanceToken) {
    const provided = req.headers.get('x-maintenance-token');
    if (provided !== requireMaintenanceToken) {
      return errorEnvelope('forbidden', 'Forbidden', 403);
    }
  }

  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    const error = /** @type {Error} */ (dbError);
    logger.error('Database connection failed:', error.message);
    return errorEnvelope(
      'db_connection_failed',
      'Database connection failed. Please try again later.',
      503
    );
  }

  try {
    const result = await sql`
      DELETE FROM ip_pseudo_locks
      WHERE updated_at < NOW() - (${PSEUDO_LOCK_TTL_HOURS} * INTERVAL '1 hour')
      RETURNING ip
    `;

    const deletedCount = Array.isArray(result) ? result.length : 0;
    return successEnvelope({
      deletedCount,
      ttlHours: PSEUDO_LOCK_TTL_HOURS,
    });
  } catch (error) {
    const err = /** @type {Error} */ (error);
    logger.error('Failed to cleanup pseudo locks:', err.message);
    return errorEnvelope('db_error', 'Database error. Please try again later.', 500);
  }
}
