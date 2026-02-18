/**
 * Enforce submit session and timing guards before round validation/scoring.
 *
 * @param {{
 *   sql: any,
 *   token: string,
 *   session: any,
 *   csrfToken: string,
 *   gameType: string,
 *   rounds: any[],
 *   bypass: boolean,
 *   sessionExpiryMs: number,
 *   minGameDurationMs: number,
 *   logger: { info: (...args: any[]) => void },
 *   getReplayResult: (sql: any, token: string) => Promise<null | { score: number, rank: number, isTopFifty: boolean, rounds: any[] }>,
 *   successEnvelope: (data: unknown, meta?: Record<string, unknown>, options?: Record<string, unknown>) => Response,
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response
 * }} deps
 * @returns {Promise<{ ok: false, response: Response } | { ok: true, now: number, gameDuration: number }>}
 */
export async function enforceSessionGuards(deps) {
  const {
    sql,
    token,
    session,
    csrfToken,
    gameType,
    rounds,
    bypass,
    sessionExpiryMs,
    minGameDurationMs,
    logger,
    getReplayResult,
    successEnvelope,
    errorJson,
    finish,
  } = deps;

  if (session.csrfToken !== csrfToken) {
    logger.info('[submit] CSRF token mismatch, returning 403');
    return {
      ok: false,
      response: finish(errorJson('csrf_mismatch', 'Invalid CSRF token', 403), 'rejected'),
    };
  }

  if (session.used) {
    const replay = await getReplayResult(sql, token);
    if (replay) {
      return {
        ok: false,
        response: finish(successEnvelope(replay, {}, { idempotentReplay: true }), 'success', {
          idempotentReplay: true,
        }),
      };
    }
    return {
      ok: false,
      response: finish(errorJson('session_used', 'Session already used', 401), 'rejected'),
    };
  }

  if (session.gameType && session.gameType !== gameType) {
    return {
      ok: false,
      response: finish(errorJson('game_type_mismatch', 'Game type mismatch', 400), 'rejected'),
    };
  }

  const now = Date.now();
  if (session.startTime > now) {
    return {
      ok: false,
      response: finish(
        errorJson('invalid_session_timestamp', 'Invalid session timestamp', 400),
        'rejected'
      ),
    };
  }

  const gameDuration = now - session.startTime;
  if (gameDuration < 0) {
    return {
      ok: false,
      response: finish(
        errorJson('invalid_game_duration', 'Invalid game duration', 400),
        'rejected'
      ),
    };
  }

  if (gameDuration > sessionExpiryMs) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    return {
      ok: false,
      response: finish(errorJson('session_expired', 'Session expired', 401), 'rejected'),
    };
  }

  if (!bypass && gameDuration < minGameDurationMs) {
    return {
      ok: false,
      response: finish(
        errorJson('suspicious_fast', 'Suspicious activity: too fast', 400),
        'rejected'
      ),
    };
  }

  const timeElapsedValues = rounds
    .map((round) => round?.timeElapsed)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (timeElapsedValues.length === rounds.length) {
    const totalElapsed = timeElapsedValues.reduce((sum, value) => sum + value, 0);
    if (totalElapsed > gameDuration + 1000) {
      return {
        ok: false,
        response: finish(
          errorJson('invalid_round_times', 'Round timings exceed total game duration', 400, {
            totalElapsed,
            gameDuration,
          }),
          'rejected'
        ),
      };
    }
  }

  return { ok: true, now, gameDuration };
}
