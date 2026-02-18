/**
 * Acquire and validate pseudo lock for a submit request.
 *
 * @param {{
 *   sql: any,
 *   clientIp: string,
 *   trimmedPseudo: string,
 *   acquirePseudoLock: (args: { sql: any, ip: string, pseudo: string }) => Promise<any>,
 *   markStage: (stage: string, startedAt: number) => void,
 *   logger: { error: (...args: any[]) => void },
 *   isDatabaseConnectionError: (error: unknown) => boolean,
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response
 * }} deps
 * @returns {Promise<{ ok: true } | { ok: false, response: Response }>}
 */
export async function enforcePseudoLock(deps) {
  const {
    sql,
    clientIp,
    trimmedPseudo,
    acquirePseudoLock,
    markStage,
    logger,
    isDatabaseConnectionError,
    errorJson,
    finish,
  } = deps;

  const pseudoLockStart = Date.now();
  /** @type {{ ok: true, lock: { pseudo: string, updatedAt: string, expiresAt: string } } | { ok: false, pseudo: string | null, lock: { pseudo: string | null, updatedAt: string | null, expiresAt: string | null } }} */
  let pseudoLockResult;
  try {
    pseudoLockResult = await acquirePseudoLock({
      sql,
      ip: clientIp,
      pseudo: trimmedPseudo,
    });
    markStage('pseudoLockMs', pseudoLockStart);
  } catch (dbError) {
    const error = /** @type {Error & {code?: string}} */ (dbError);
    logger.error('Database query error (pseudo lock):', error.message, error.code);
    return {
      ok: false,
      response: finish(
        errorJson(
          isDatabaseConnectionError(error) ? 'db_connection_error' : 'db_error',
          'Database error. Please try again later.',
          isDatabaseConnectionError(error) ? 503 : 500
        ),
        'failure',
        { stage: 'pseudo_lock' }
      ),
    };
  }

  if (!pseudoLockResult.ok) {
    const lockedPseudo = 'pseudo' in pseudoLockResult ? pseudoLockResult.pseudo : null;
    return {
      ok: false,
      response: finish(
        errorJson('pseudo_already_set_for_this_ip', 'Pseudo already set for this IP', 409, {
          pseudo: lockedPseudo,
          lock: pseudoLockResult.lock,
        }),
        'rejected'
      ),
    };
  }

  return { ok: true };
}
