// Runtime configuration (shared across client and server)

export const GAME = {
  ROUNDS: 5,
  TIMER_MS: 5000,
  GRACE_PERIOD_MS: 500,
  DANGER_ZONE_MS: 1500,
  MAX_SCORE_PER_ROUND: 5000,
};

/** Global timing constants. Mode-specific timing (e.g. timer) lives in GAME / game-modes. */
export const TIMING = {
  SCORE_ANIMATION_MS: 1000,
  /** Max wait before showing answer modal after result line; user can tap/click to continue earlier. */
  RESULT_READ_TIME_MS: 2200,
};
