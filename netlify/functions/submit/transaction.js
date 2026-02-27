import { isDailyVariant } from '../../../lib/config/game-modes.js';

/**
 * Execute submit transaction, rank lookup, and idempotent replay fallback.
 *
 * @param {{
 *   sql: any,
 *   token: string,
 *   trimmedPseudo: string,
 *   totalScore: number,
 *   gameDuration: number,
 *   validatedRounds: any[],
 *   gameType: string,
 *   now: number,
 *   clientIp: string,
 *   playerId: string | null,
 *   markStage: (stage: string, startedAt: number) => void,
 *   logger: { info: (...args: any[]) => void, error: (...args: any[]) => void },
 *   isDatabaseConnectionError: (error: unknown) => boolean,
 *   getReplayResult: (sql: any, token: string) => Promise<null | { score: number, rank: number, isTopFifty: boolean, rounds: any[] }>,
 *   successEnvelope: (data: unknown, meta?: Record<string, unknown>, options?: Record<string, unknown>) => Response,
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response
 * }} deps
 * @returns {Promise<{ ok: false, response: Response } | { ok: true, payload: { score: number, rank: number, isTopFifty: boolean, rounds: any[] } }>}
 */
export async function persistSubmitAndBuildResponse(deps) {
  const {
    sql,
    token,
    trimmedPseudo,
    totalScore,
    gameDuration,
    validatedRounds,
    gameType,
    now,
    clientIp,
    playerId,
    markStage,
    logger,
    isDatabaseConnectionError,
    getReplayResult,
    successEnvelope,
    errorJson,
    finish,
  } = deps;

  const transactionStart = Date.now();
  try {
    logger.info('[submit] Starting database transaction');
    const txnQueries = [
      sql`UPDATE sessions SET used = true WHERE token = ${token} AND used = false`,
      sql`
        INSERT INTO scores (pseudo, score, time, rounds, timestamp, game_type, session_token, ip, player_id)
        VALUES (${trimmedPseudo}, ${totalScore}, ${gameDuration}, ${JSON.stringify(validatedRounds)}::jsonb, ${now}, ${gameType}, ${token}, ${clientIp}, ${playerId})
      `,
      ...(playerId
        ? [
            sql`
            UPDATE players
            SET total_games = total_games + 1,
                total_score = total_score + ${totalScore}
            WHERE player_id = ${playerId}
          `,
          ]
        : []),
    ];
    await sql.transaction(txnQueries);
    logger.info('[submit] Transaction committed');
    markStage('transactionMs', transactionStart);
  } catch (dbError) {
    markStage('transactionMs', transactionStart);
    const error = /** @type {Error & {code?: string}} */ (dbError);
    logger.error('[submit] Database operation failed:', error.message, error.code, error.stack);

    if (error.code === '23505') {
      const replay = await getReplayResult(sql, token);
      if (replay) {
        return {
          ok: false,
          response: finish(successEnvelope(replay, {}, { idempotentReplay: true }), 'success', {
            idempotentReplay: true,
          }),
        };
      }
    }

    if (isDatabaseConnectionError(error)) {
      logger.error('[submit] Connection error detected');
      return {
        ok: false,
        response: finish(
          errorJson(
            'db_connection_error',
            'Database connection error. Please try again later.',
            503,
            {
              score: totalScore,
              rank: 0,
              isTopFifty: false,
              rounds: validatedRounds,
            }
          ),
          'failure',
          { stage: 'transaction' }
        ),
      };
    }

    logger.error('[submit] Generic database error');
    return {
      ok: false,
      response: finish(
        errorJson('db_error', 'Database error. Please try again later.', 500, {
          score: totalScore,
          rank: 0,
          isTopFifty: false,
          rounds: validatedRounds,
        }),
        'failure',
        { stage: 'transaction' }
      ),
    };
  }

  const rankLookupStart = Date.now();
  let rank = 1;
  let isTopFifty = false;
  try {
    logger.info('[submit] Calculating rank');
    let rankResult;
    if (isDailyVariant(gameType)) {
      const todayTs = Date.UTC(
        new Date(now).getUTCFullYear(),
        new Date(now).getUTCMonth(),
        new Date(now).getUTCDate()
      );
      const tomorrowTs = todayTs + 86400000;
      rankResult = await sql`
        SELECT COUNT(*) + 1 as rank
        FROM scores
        WHERE game_type = ${gameType}
          AND timestamp >= ${todayTs} AND timestamp < ${tomorrowTs}
          AND (score > ${totalScore} OR (score = ${totalScore} AND time < ${gameDuration}))
      `;
    } else {
      rankResult = await sql`
        SELECT COUNT(*) + 1 as rank
        FROM scores
        WHERE game_type = ${gameType}
          AND (score > ${totalScore} OR (score = ${totalScore} AND time < ${gameDuration}))
      `;
    }
    rank = parseInt(rankResult[0]?.rank ?? '1', 10);
    isTopFifty = rank <= 50;
    logger.info('[submit] Rank calculated:', rank);
    markStage('rankLookupMs', rankLookupStart);
  } catch (rankError) {
    logger.error('[submit] Rank query error:', rankError);
    rank = 0;
    isTopFifty = false;
    markStage('rankLookupMs', rankLookupStart);
  }

  return {
    ok: true,
    payload: {
      score: totalScore,
      rank,
      isTopFifty,
      rounds: validatedRounds,
    },
  };
}
