import { describe, it, expect, beforeEach } from 'vitest';
import { createRound, recordClick, timeoutRound, getRemainingTime } from './Round.js';
import { scoringSystem } from '../systems/ScoringSystem.js';
import { GAME } from '../config.js';

describe('calculateScore (via ScoringSystem)', () => {
  it('returns max score (5000) for distance < 0.5km (perfect zone)', () => {
    expect(scoringSystem.calculateScore(0)).toBe(5000);
    expect(scoringSystem.calculateScore(0.5)).toBe(5000);
    expect(scoringSystem.calculateScore(0.49)).toBe(5000);
  });

  it('applies smooth transition for 0.5-2km', () => {
    const score099 = scoringSystem.calculateScore(0.99);
    const score1 = scoringSystem.calculateScore(1);
    // Should be in transition (not max, but high)
    expect(score099).toBeLessThan(5000);
    expect(score099).toBeGreaterThan(4900);
    expect(score1).toBeLessThan(5000);
  });

  it('applies exponential decay for distance 2-100km', () => {
    expect(scoringSystem.calculateScore(2)).toBeLessThan(5000);
    expect(scoringSystem.calculateScore(50)).toBeLessThan(scoringSystem.calculateScore(2));
    expect(scoringSystem.calculateScore(99)).toBeLessThan(scoringSystem.calculateScore(50));
  });

  it('applies linear interpolation for 100km < distance < 500km', () => {
    const score100 = scoringSystem.calculateScore(100);
    const score300 = scoringSystem.calculateScore(300);
    const score500 = scoringSystem.calculateScore(500);

    expect(score300).toBeLessThan(score100);
    expect(score300).toBeGreaterThan(score500);
    expect(score500).toBe(245); // V2 formula (k=105, p=1.9)
  });

  it('applies sigmoid decay for all distances > 0.1km', () => {
    expect(scoringSystem.calculateScore(500)).toBe(245);
    expect(scoringSystem.calculateScore(1000)).toBeLessThan(245);
    expect(scoringSystem.calculateScore(5000)).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 for very large distances', () => {
    expect(scoringSystem.calculateScore(20000)).toBe(0);
  });

  // Reference values that MUST match server-side
  it('matches known reference values', () => {
    expect(scoringSystem.calculateScore(0)).toBe(5000);
    expect(scoringSystem.calculateScore(0.5)).toBe(5000); // Perfect zone
    // Note: 1km is now in transition zone, so value differs from old formula
    expect(scoringSystem.calculateScore(1)).toBeLessThan(5000);
    expect(scoringSystem.calculateScore(1)).toBeGreaterThan(4900);
    expect(scoringSystem.calculateScore(50)).toBe(4019); // V2 formula (k=105, p=1.9)
    expect(scoringSystem.calculateScore(100)).toBe(2616); // V2 formula
    expect(scoringSystem.calculateScore(500)).toBe(245);  // V2 formula
  });
});

describe('createRound', () => {
  it('creates a round with correct initial state', () => {
    const capital = {
      name: 'Paris',
      country: 'France',
      lat: 48.8566,
      lng: 2.3522,
    };
    const round = createRound(capital, 0);

    expect(round.capital).toBe(capital);
    expect(round.roundNumber).toBe(0);
    expect(round.status).toBe('playing');
    expect(round.click).toBeNull();
    expect(round.score).toBeNull();
    expect(round.distance).toBeNull();
    expect(round.startTime).toBeGreaterThan(0);
    expect(round.endTime).toBeNull();
  });

  it('creates rounds with correct round numbers', () => {
    const capital = {
      name: 'London',
      country: 'UK',
      lat: 51.5074,
      lng: -0.1278,
    };

    expect(createRound(capital, 0).roundNumber).toBe(0);
    expect(createRound(capital, 1).roundNumber).toBe(1);
    expect(createRound(capital, 4).roundNumber).toBe(4);
  });
});

describe('recordClick', () => {
  let capital;
  let round;

  beforeEach(() => {
    capital = {
      name: 'Paris',
      country: 'France',
      lat: 48.8566,
      lng: 2.3522,
    };
    round = createRound(capital, 0);
  });

  it('records a click and calculates score for perfect click', () => {
    // Click exactly on Paris
    const clickCoords = [48.8566, 2.3522];
    const result = recordClick(round, clickCoords);

    expect(result.status).toBe('completed');
    expect(result.score).toBe(5000);
    expect(result.distance).toBe(0);
    expect(result.click).toEqual({ lat: 48.8566, lng: 2.3522 });
    expect(result.endTime).toBeGreaterThan(0);
  });

  it('records a click and calculates score for nearby click', () => {
    // Click 50km from Paris (approximately)
    const clickCoords = [48.4, 2.3522];
    const result = recordClick(round, clickCoords);

    expect(result.status).toBe('completed');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(5000);
    expect(result.distance).toBeGreaterThan(0);
  });

  it('normalizes coordinates > 180 longitude', () => {
    // Longitude > 180 should be normalized
    const clickCoords = [48.8566, 200];
    const result = recordClick(round, clickCoords);

    expect(result.click.lng).toBe(-160); // 200 - 360 = -160
    expect(result.status).toBe('completed');
  });

  it('normalizes coordinates < -180 longitude', () => {
    const clickCoords = [48.8566, -200];
    const result = recordClick(round, clickCoords);

    expect(result.click.lng).toBe(160); // -200 + 360 = 160
    expect(result.status).toBe('completed');
  });

  it('clamps latitude > 90', () => {
    const clickCoords = [100, 2.3522];
    const result = recordClick(round, clickCoords);

    expect(result.click.lat).toBe(90);
    expect(result.status).toBe('completed');
  });

  it('clamps latitude < -90', () => {
    const clickCoords = [-100, 2.3522];
    const result = recordClick(round, clickCoords);

    expect(result.click.lat).toBe(-90);
    expect(result.status).toBe('completed');
  });

  it('marks as timeout if clicked after time limit', () => {
    // Create a round in the past
    const pastRound = {
      ...round,
      startTime: Date.now() - (GAME.TIMER_MS + GAME.GRACE_PERIOD_MS + 1000),
    };

    const clickCoords = [48.8566, 2.3522];
    const result = recordClick(pastRound, clickCoords);

    expect(result.status).toBe('timeout');
    expect(result.score).toBe(0);
    expect(result.distance).toBeNull();
    expect(result.click).toEqual({ lat: 48.8566, lng: 2.3522 });
  });
});

describe('timeoutRound', () => {
  it('marks round as timed out', () => {
    const capital = {
      name: 'Paris',
      country: 'France',
      lat: 48.8566,
      lng: 2.3522,
    };
    const round = createRound(capital, 0);
    const result = timeoutRound(round);

    expect(result.status).toBe('timeout');
    expect(result.score).toBe(0);
    expect(result.click).toBeNull();
    expect(result.distance).toBeNull();
    expect(result.endTime).toBeGreaterThan(0);
  });

  it('preserves capital and round number', () => {
    const capital = {
      name: 'London',
      country: 'UK',
      lat: 51.5074,
      lng: -0.1278,
    };
    const round = createRound(capital, 3);
    const result = timeoutRound(round);

    expect(result.capital).toBe(capital);
    expect(result.roundNumber).toBe(3);
  });
});

describe('getRemainingTime', () => {
  it('returns full time for just-created round', () => {
    const round = createRound({ name: 'Paris', country: 'France', lat: 48, lng: 2 }, 0);
    const remaining = getRemainingTime(round);
    const totalAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;

    expect(remaining).toBeGreaterThan(totalAllowed - 100); // Allow 100ms tolerance
    expect(remaining).toBeLessThanOrEqual(totalAllowed);
  });

  it('returns 0 for expired round', () => {
    const round = {
      startTime: Date.now() - (GAME.TIMER_MS + GAME.GRACE_PERIOD_MS + 1000),
      capital: { name: 'Paris', country: 'France', lat: 48, lng: 2 },
      roundNumber: 0,
    };
    const remaining = getRemainingTime(round);

    expect(remaining).toBe(0);
  });

  it('returns positive time for active round', () => {
    const round = {
      startTime: Date.now() - 1000, // Started 1 second ago
      capital: { name: 'Paris', country: 'France', lat: 48, lng: 2 },
      roundNumber: 0,
    };
    const remaining = getRemainingTime(round);
    const expected = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS - 1000;

    expect(remaining).toBeGreaterThan(expected - 100); // Allow tolerance
    expect(remaining).toBeLessThan(expected + 100);
  });
});
