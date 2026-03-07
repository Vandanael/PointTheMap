import { describe, it, expect, vi } from 'vitest';

vi.mock('../../netlify/functions/_utils.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const { checkPlausibility, validateRounds } =
  await import('../../netlify/functions/_round-validation.js');
const { API, GAME } = await import('../../lib/config/index.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCapitalTargets = (count = GAME.ROUNDS) =>
  Array.from({ length: count }, (_, i) => ({ name: `Capital${i}`, lat: 0, lng: 0 }));

const makeCapitalRounds = (targets) =>
  targets.map((t) => ({
    capital: t.name,
    click: { lat: 10, lng: 10 },
    timeElapsed: 2000,
    score: 1000,
  }));

const makeCountryTargets = (count = GAME.ROUNDS) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Country${i}`,
    countryId: `C${i}`,
  }));

const makeCountryRounds = (targets) =>
  targets.map((t) => ({
    country: t.name,
    countryId: t.countryId,
    click: { lat: 10, lng: 10 },
    timeElapsed: 2000,
    score: 1000,
  }));

const makeCivilizationTargets = (count = GAME.ROUNDS) =>
  Array.from({ length: count }, (_, i) => ({
    name: `Civ${i}`,
    id: `civ-${i}`,
  }));

const makeCivilizationRounds = (targets) =>
  targets.map((t) => ({
    civilization: t.name,
    civilizationId: t.id,
    click: { lat: 10, lng: 10 },
    timeElapsed: 2000,
    score: 1000,
  }));

const makeStadiumTargets = (count = GAME.ROUNDS) =>
  Array.from({ length: count }, (_, i) => ({ name: `Stadium${i}`, lat: 0, lng: 0 }));

const makeStadiumRounds = (targets) =>
  targets.map((t) => ({
    stadium: t.name,
    click: { lat: 10, lng: 10 },
    timeElapsed: 2000,
    score: 1000,
  }));

// ---------------------------------------------------------------------------
// checkPlausibility
// ---------------------------------------------------------------------------

describe('checkPlausibility', () => {
  it('returns valid for duration within limits', () => {
    const result = checkPlausibility(30000);
    expect(result.valid).toBe(true);
  });

  it('returns invalid when duration is too short', () => {
    const result = checkPlausibility(API.MIN_PLAUSIBLE_DURATION_MS - 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('returns invalid when duration is too long', () => {
    const result = checkPlausibility(API.MAX_GAME_DURATION_MS + 1);
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('returns valid at the minimum boundary', () => {
    const result = checkPlausibility(API.MIN_PLAUSIBLE_DURATION_MS);
    expect(result.valid).toBe(true);
  });

  it('returns valid at the maximum boundary', () => {
    const result = checkPlausibility(API.MAX_GAME_DURATION_MS);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRounds — round count
// ---------------------------------------------------------------------------

describe('validateRounds — round count', () => {
  it('rejects when rounds array is too short', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets).slice(0, GAME.ROUNDS - 1);
    const result = validateRounds(rounds, targets, 'classic');
    expect(result.valid).toBe(false);
  });

  it('rejects when rounds array is too long', () => {
    const extraTargets = makeCapitalTargets(GAME.ROUNDS + 1);
    const extraRounds = makeCapitalRounds(extraTargets);
    const result = validateRounds(extraRounds, extraTargets, 'classic');
    expect(result.valid).toBe(false);
  });

  it('rejects a non-array', () => {
    const targets = makeCapitalTargets();
    const result = validateRounds(null, targets, 'classic');
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateRounds — capital mode (classic / daily)
// ---------------------------------------------------------------------------

describe('validateRounds — capital mode', () => {
  it('accepts valid capital rounds', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(true);
  });

  it('accepts valid capital_daily rounds', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    expect(validateRounds(rounds, targets, 'daily').valid).toBe(true);
  });

  it('rejects capital name mismatch', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[2].capital = 'WrongCapital';
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(false);
  });

  it('rejects timeElapsed below minimum (suspicious fast)', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[0].timeElapsed = API.MIN_ROUND_TIME_MS - 1;
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(false);
  });

  it('rejects timeElapsed above maximum', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[0].timeElapsed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS + 2000;
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(false);
  });

  it('rejects timeElapsed = 0', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[0].timeElapsed = 0;
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(false);
  });

  it('accepts timeout round (no click, no timeElapsed)', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[0].click = undefined;
    rounds[0].timeElapsed = undefined;
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(true);
  });

  it('rejects click coords out of bounds — lat > 90', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[0].click = { lat: 91, lng: 0 };
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(false);
  });

  it('rejects click coords out of bounds — lng > 180', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[0].click = { lat: 0, lng: 181 };
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(false);
  });

  it('rejects non-finite coordinate values', () => {
    const targets = makeCapitalTargets();
    const rounds = makeCapitalRounds(targets);
    rounds[0].click = { lat: Infinity, lng: 0 };
    expect(validateRounds(rounds, targets, 'classic').valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateRounds — country mode
// ---------------------------------------------------------------------------

describe('validateRounds — country mode', () => {
  it('accepts valid country rounds', () => {
    const targets = makeCountryTargets();
    const rounds = makeCountryRounds(targets);
    expect(validateRounds(rounds, targets, 'country').valid).toBe(true);
  });

  it('accepts valid country_daily rounds', () => {
    const targets = makeCountryTargets();
    const rounds = makeCountryRounds(targets);
    expect(validateRounds(rounds, targets, 'country_daily').valid).toBe(true);
  });

  it('rejects country ID mismatch', () => {
    const targets = makeCountryTargets();
    const rounds = makeCountryRounds(targets);
    rounds[1].countryId = 'WRONG';
    expect(validateRounds(rounds, targets, 'country').valid).toBe(false);
  });

  it('rejects missing countryId field', () => {
    const targets = makeCountryTargets();
    const rounds = makeCountryRounds(targets);
    delete rounds[0].countryId;
    expect(validateRounds(rounds, targets, 'country').valid).toBe(false);
  });

  it('accepts timeout round (no click)', () => {
    const targets = makeCountryTargets();
    const rounds = makeCountryRounds(targets);
    rounds[0].click = undefined;
    rounds[0].timeElapsed = undefined;
    expect(validateRounds(rounds, targets, 'country').valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRounds — civilization mode
// ---------------------------------------------------------------------------

describe('validateRounds — civilization mode', () => {
  it('accepts valid civilization rounds', () => {
    const targets = makeCivilizationTargets();
    const rounds = makeCivilizationRounds(targets);
    expect(validateRounds(rounds, targets, 'civilization').valid).toBe(true);
  });

  it('accepts valid civilization_daily rounds', () => {
    const targets = makeCivilizationTargets();
    const rounds = makeCivilizationRounds(targets);
    expect(validateRounds(rounds, targets, 'civilization_daily').valid).toBe(true);
  });

  it('rejects civilization ID mismatch', () => {
    const targets = makeCivilizationTargets();
    const rounds = makeCivilizationRounds(targets);
    rounds[0].civilizationId = 'wrong-id';
    expect(validateRounds(rounds, targets, 'civilization').valid).toBe(false);
  });

  it('accepts timeout round (no click)', () => {
    const targets = makeCivilizationTargets();
    const rounds = makeCivilizationRounds(targets);
    rounds[2].click = undefined;
    rounds[2].timeElapsed = undefined;
    expect(validateRounds(rounds, targets, 'civilization').valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRounds — stadium mode
// ---------------------------------------------------------------------------

describe('validateRounds — stadium mode', () => {
  it('accepts valid stadium rounds', () => {
    const targets = makeStadiumTargets();
    const rounds = makeStadiumRounds(targets);
    expect(validateRounds(rounds, targets, 'stadium').valid).toBe(true);
  });

  it('accepts valid stadium_daily rounds', () => {
    const targets = makeStadiumTargets();
    const rounds = makeStadiumRounds(targets);
    expect(validateRounds(rounds, targets, 'stadium_daily').valid).toBe(true);
  });

  it('rejects stadium name mismatch', () => {
    const targets = makeStadiumTargets();
    const rounds = makeStadiumRounds(targets);
    rounds[0].stadium = 'WrongStadium';
    expect(validateRounds(rounds, targets, 'stadium').valid).toBe(false);
  });

  it('accepts timeout round (no click)', () => {
    const targets = makeStadiumTargets();
    const rounds = makeStadiumRounds(targets);
    rounds[4].click = undefined;
    rounds[4].timeElapsed = undefined;
    expect(validateRounds(rounds, targets, 'stadium').valid).toBe(true);
  });
});
