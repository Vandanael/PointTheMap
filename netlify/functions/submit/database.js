/**
 * Initialize database client for submit flow and attach to context.
 *
 * @param {{
 *   context: any,
 *   getDatabase: (context: any) => any,
 *   logger: { error: (...args: any[]) => void, warn: (...args: any[]) => void },
 *   recordDbFailure: (error: unknown) => void,
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response
 * }} deps
 * @returns {Promise<{ ok: false, response: Response } | { ok: true, sql: any }>}
 */
export async function initSubmitDatabase(deps) {
  const { context, getDatabase, logger, recordDbFailure, errorJson, finish } = deps;

  let sql;
  try {
    sql = getDatabase(context);
  } catch (dbError) {
    const error = /** @type {Error} */ (dbError);
    logger.error('Database connection failed:', error.message);
    recordDbFailure(dbError);
    return {
      ok: false,
      response: finish(
        errorJson(
          'db_connection_failed',
          'Database connection failed. Please try again later.',
          503
        ),
        'failure',
        { reason: 'db_connection_setup_failed' }
      ),
    };
  }
  context.sql = sql;

  // Best-effort TTL cleanup for stale sessions.
  try {
    await sql`DELETE FROM sessions WHERE expires_at <= NOW()`;
  } catch (cleanupError) {
    logger.warn('[submit] session cleanup skipped:', /** @type {Error} */ (cleanupError).message);
  }

  return { ok: true, sql };
}
