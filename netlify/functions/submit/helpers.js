import { isDailyVariant } from '../../../lib/config/game-modes.js';

/**
 * @param {typeof import('../_utils.js').errorEnvelope} errorEnvelope
 * @returns {(code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response}
 */
export function createErrorJson(errorEnvelope) {
  return (code, message, status = 400, details = undefined, headers = undefined) =>
    errorEnvelope(code, message, status, details, headers);
}

/**
 * Read a previously inserted score for this session token and rebuild a submit response.
 * @param {any} sql
 * @param {string} token
 * @returns {Promise<null | { score: number, rank: number, isTopFifty: boolean, rounds: any[] }>}
 */
export const getReplayResult = async (sql, token) => {
  const rows = await sql`
    SELECT score, time, rounds, game_type, timestamp
    FROM scores
    WHERE session_token = ${token}
    ORDER BY id DESC
    LIMIT 1
  `;
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = /** @type {{ score?: number, time?: number, rounds?: any[], game_type?: string, timestamp?: number }} */ (
    rows[0]
  );
  const score = Number.isFinite(row.score) ? row.score : 0;
  const time = Number.isFinite(row.time) ? row.time : 0;
  const gameType = row.game_type || 'classic';

  let rank = 0;
  try {
    let rankResult;
    if (isDailyVariant(gameType)) {
      const ts = Number(row.timestamp);
      const d = new Date(ts);
      const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      const dayEnd = dayStart + 86400000;
      rankResult = await sql`
        SELECT COUNT(*) + 1 as rank
        FROM scores
        WHERE game_type = ${gameType}
          AND timestamp >= ${dayStart} AND timestamp < ${dayEnd}
          AND (score > ${score} OR (score = ${score} AND time < ${time}))
      `;
    } else {
      rankResult = await sql`
        SELECT COUNT(*) + 1 as rank
        FROM scores
        WHERE game_type = ${gameType}
          AND (score > ${score} OR (score = ${score} AND time < ${time}))
      `;
    }
    rank = parseInt(rankResult[0]?.rank ?? '0', 10);
  } catch {
    rank = 0;
  }

  return {
    score,
    rank,
    isTopFifty: rank > 0 && rank <= 50,
    rounds: Array.isArray(row.rounds) ? row.rounds : [],
  };
};

export const SUPPORTED_PAYLOAD_VERSIONS = new Set([1]);

/**
 * @param {{
 *   logger: { info: (...args: any[]) => void, warn: (...args: any[]) => void, error: (...args: any[]) => void },
 *   getDbBreakerStats: () => Record<string, unknown>,
 *   isDbBreakerOpen: () => boolean
 * }} deps
 */
export function createSubmitMetrics(deps) {
  const { logger, getDbBreakerStats, isDbBreakerOpen } = deps;
  /** @type {{ startedAt: number, bypass: boolean, stages: Record<string, number> }} */
  const metrics = {
    startedAt: Date.now(),
    bypass: false,
    stages: {},
  };

  /**
   * @param {string} stage
   * @param {number} startedAt
   */
  const markStage = (stage, startedAt) => {
    metrics.stages[stage] = Date.now() - startedAt;
  };

  /**
   * @param {boolean} bypass
   */
  const setBypass = (bypass) => {
    metrics.bypass = bypass;
  };

  /**
   * @param {Response} response
   * @param {'success' | 'rejected' | 'failure'} outcome
   * @param {Record<string, unknown>} [details]
   */
  const finish = (response, outcome, details = undefined) => {
    const payload = {
      outcome,
      totalMs: Date.now() - metrics.startedAt,
      bypass: metrics.bypass,
      stages: metrics.stages,
      breaker: {
        ...getDbBreakerStats(),
        isOpen: isDbBreakerOpen(),
      },
      ...(details ? { details } : {}),
    };
    if (outcome === 'success') {
      logger.info('[submit] metrics', payload);
    } else if (outcome === 'rejected') {
      logger.warn('[submit] metrics', payload);
    } else {
      logger.error('[submit] metrics', payload);
    }
    return response;
  };

  return { metrics, markStage, setBypass, finish };
}
