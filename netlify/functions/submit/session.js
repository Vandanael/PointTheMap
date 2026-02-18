/**
 * Load active session and normalize persistence model to domain model.
 *
 * @param {{
 *   sql: any,
 *   token: string,
 *   markStage: (stage: string, startedAt: number) => void,
 *   logger: { error: (...args: any[]) => void },
 *   isDatabaseConnectionError: (error: unknown) => boolean,
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response,
 *   toDomainModel: (persistenceSession: any) => any
 * }} deps
 * @returns {Promise<{ ok: false, response: Response } | { ok: true, session: any }>}
 */
export async function loadActiveSessionByToken(deps) {
  const {
    sql,
    token,
    markStage,
    logger,
    isDatabaseConnectionError,
    errorJson,
    finish,
    toDomainModel,
  } = deps;

  const sessionLookupStart = Date.now();
  let sessionResult;
  try {
    sessionResult = await sql`
      SELECT token, targets, start_time, used, game_type, expires_at, csrf_token, player_id
      FROM sessions
      WHERE token = ${token}
        AND expires_at > NOW()
    `;
    markStage('sessionLookupMs', sessionLookupStart);
  } catch (dbError) {
    const error = /** @type {Error & {code?: string}} */ (dbError);
    logger.error('Database query error (session lookup):', error.message, error.code);
    return {
      ok: false,
      response: finish(
        errorJson(
          isDatabaseConnectionError(error) ? 'db_connection_error' : 'db_error',
          'Database error. Please try again later.',
          isDatabaseConnectionError(error) ? 503 : 500
        ),
        'failure',
        { stage: 'session_lookup' }
      ),
    };
  }

  if (sessionResult.length === 0) {
    return {
      ok: false,
      response: finish(
        errorJson('session_not_found', 'Session not found or expired', 401),
        'rejected'
      ),
    };
  }

  const sessionRow = /** @type {any} */ (sessionResult[0]);
  const persistenceSession = {
    token: sessionRow.token,
    targets: sessionRow.targets,
    startTime: parseInt(sessionRow.start_time, 10),
    used: sessionRow.used,
    gameType: sessionRow.game_type,
    csrfToken: sessionRow.csrf_token,
    playerId: sessionRow.player_id ?? undefined,
  };

  return {
    ok: true,
    session: toDomainModel(persistenceSession),
  };
}
