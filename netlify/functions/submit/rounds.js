import { checkPlausibility, validateRounds } from '../_round-validation.js';
import { scoreRound } from '../_round-scoring.js';

/**
 * Validate rounds and compute scored rounds + total score.
 *
 * @param {{
 *   rounds: any[],
 *   session: any,
 *   bypass: boolean,
 *   gameDuration: number,
 *   markStage: (stage: string, startedAt: number) => void,
 *   errorJson: (code: string, message: string, status?: number, details?: unknown, headers?: Record<string, string>) => Response,
 *   finish: (response: Response, outcome: 'success' | 'rejected' | 'failure', details?: Record<string, unknown>) => Response
 * }} deps
 * @returns {Promise<{ ok: false, response: Response } | { ok: true, validatedRounds: any[], totalScore: number }>}
 */
export async function validateAndScoreRounds(deps) {
  const { rounds, session, bypass, gameDuration, markStage, errorJson, finish } = deps;

  const roundProcessingStart = Date.now();
  const validation = validateRounds(rounds, session.targets, session.gameType || 'classic');
  if (!validation.valid) {
    return {
      ok: false,
      response: finish(
        errorJson('invalid_rounds', validation.error || 'Invalid rounds', 400),
        'rejected'
      ),
    };
  }

  if (!bypass) {
    const plausibility = checkPlausibility(gameDuration);
    if (!plausibility.valid) {
      return {
        ok: false,
        response: finish(
          errorJson(
            'implausible_duration',
            plausibility.reason || 'Session duration implausible',
            400
          ),
          'rejected'
        ),
      };
    }
  }

  const validatedRounds = rounds.map((round, i) => scoreRound(round, i, session));
  markStage('roundValidationAndScoringMs', roundProcessingStart);
  const totalScore = validatedRounds.reduce(
    (/** @type {number} */ sum, /** @type {any} */ r) => sum + r.score,
    0
  );

  return { ok: true, validatedRounds, totalScore };
}
