import { describe, it, expect } from 'vitest';
import { haversine, calculateScore, normalizeLng, normalizeLat, normalizeCoords } from './index.js';

describe('haversine', () => {
  it('calculates distance between Paris and London', () => {
    const paris = [48.8566, 2.3522];
    const london = [51.5074, -0.1278];
    const distance = haversine(paris, london);
    expect(distance).toBeCloseTo(344, 0);
  });

  it('returns 0 for identical coordinates', () => {
    const coords = [48.8566, 2.3522];
    expect(haversine(coords, coords)).toBe(0);
  });

  it('handles coordinates across the antimeridian', () => {
    const point1 = [0, 179];
    const point2 = [0, -179];
    const distance = haversine(point1, point2);
    expect(distance).toBeCloseTo(222, 0);
  });

  it('handles poles correctly', () => {
    const northPole = [90, 0];
    const southPole = [-90, 0];
    const distance = haversine(northPole, southPole);
    expect(distance).toBeCloseTo(20015, 0);
  });
});

describe('calculateScore', () => {
  it('returns max score for distance < 0.5km (perfect zone)', () => {
    expect(calculateScore(0)).toBe(5000);
    expect(calculateScore(0.5)).toBe(5000);
    expect(calculateScore(0.49)).toBe(5000);
  });

  it('applies smooth transition for 0.5-2km', () => {
    const score099 = calculateScore(0.99);
    const score1 = calculateScore(1);
    const score2 = calculateScore(2);
    
    // Should be in transition zone (not max, but high)
    expect(score099).toBeLessThan(5000);
    expect(score099).toBeGreaterThan(4900);
    expect(score1).toBeLessThan(5000);
    expect(score2).toBeLessThan(5000);
    // Monotone
    expect(score099).toBeGreaterThanOrEqual(score1);
    expect(score1).toBeGreaterThanOrEqual(score2);
  });

  it('applies exponential decay for distance 2-100km', () => {
    expect(calculateScore(2)).toBeLessThan(5000);
    expect(calculateScore(50)).toBe(4182);
    expect(calculateScore(99)).toBeLessThan(calculateScore(50));
  });

  it('applies linear interpolation for 100-500km (ensures C0 continuity)', () => {
    expect(calculateScore(100)).toBe(3498);
    expect(calculateScore(300)).toBe(2249); // Actual value from implementation
    expect(calculateScore(500)).toBe(1000);
    
    // Verify continuity at transition points
    // Note: Small jumps (< 15 points) are acceptable due to rounding
    // The formula ensures continuity at the exact transition point
    const scoreAt100 = calculateScore(100);
    const scoreAt101 = calculateScore(101);
    // Linear interpolation should be smooth (jump < 10 points per km)
    expect(Math.abs(scoreAt100 - scoreAt101)).toBeLessThan(10);
  });

  it('applies exponential decay for distance > 500km (ensures C0 continuity)', () => {
    expect(calculateScore(1000)).toBe(535);
    expect(calculateScore(5000)).toBe(4); // Actual value from implementation
    expect(calculateScore(20000)).toBe(0);
    
    // Verify continuity at 500km transition
    // Note: Small jumps (< 10 points) are acceptable due to rounding
    const scoreAt500 = calculateScore(500);
    const scoreAt501 = calculateScore(501);
    // Exponential decay should be smooth (jump < 5 points per km)
    expect(Math.abs(scoreAt500 - scoreAt501)).toBeLessThan(5);
  });

  it('is monotone (score decreases with distance)', () => {
    const distances = [0, 0.5, 1, 2, 10, 50, 100, 200, 500, 1000, 5000];
    let previousScore = Infinity;
    
    for (const dist of distances) {
      const score = calculateScore(dist);
      expect(score).toBeLessThanOrEqual(previousScore);
      previousScore = score;
    }
  });

  it('returns integer scores', () => {
    for (let i = 0; i < 10; i++) {
      const distance = Math.random() * 10000;
      const score = calculateScore(distance);
      expect(score).toBe(Math.round(score));
    }
  });

  it('never returns negative scores', () => {
    expect(calculateScore(0)).toBeGreaterThanOrEqual(0);
    expect(calculateScore(10000)).toBeGreaterThanOrEqual(0);
    expect(calculateScore(50000)).toBeGreaterThanOrEqual(0);
  });
});

describe('normalizeLng', () => {
  it('normalizes longitude > 180', () => {
    expect(normalizeLng(200)).toBe(-160);
    expect(normalizeLng(360)).toBe(0);
    expect(normalizeLng(540)).toBe(180); // 540 - 360 = 180
  });

  it('normalizes longitude < -180', () => {
    expect(normalizeLng(-200)).toBe(160);
    expect(normalizeLng(-360)).toBe(0);
    expect(normalizeLng(-540)).toBe(-180); // -540 + 360 = -180
  });

  it('keeps valid longitudes unchanged', () => {
    expect(normalizeLng(0)).toBe(0);
    expect(normalizeLng(90)).toBe(90);
    expect(normalizeLng(-90)).toBe(-90);
    expect(normalizeLng(180)).toBe(180);
    expect(normalizeLng(-180)).toBe(-180);
  });

  it('guards against NaN (prevents infinite loop)', () => {
    expect(normalizeLng(NaN)).toBe(0);
  });

  it('guards against Infinity (prevents infinite loop)', () => {
    expect(normalizeLng(Infinity)).toBe(0);
    expect(normalizeLng(-Infinity)).toBe(0);
  });
});

describe('normalizeLat', () => {
  it('clamps latitude > 90', () => {
    expect(normalizeLat(100)).toBe(90);
    expect(normalizeLat(200)).toBe(90);
  });

  it('clamps latitude < -90', () => {
    expect(normalizeLat(-100)).toBe(-90);
    expect(normalizeLat(-200)).toBe(-90);
  });

  it('keeps valid latitudes unchanged', () => {
    expect(normalizeLat(0)).toBe(0);
    expect(normalizeLat(45)).toBe(45);
    expect(normalizeLat(-45)).toBe(-45);
    expect(normalizeLat(90)).toBe(90);
    expect(normalizeLat(-90)).toBe(-90);
  });

  it('guards against NaN', () => {
    expect(normalizeLat(NaN)).toBe(0);
  });

  it('guards against Infinity', () => {
    expect(normalizeLat(Infinity)).toBe(90);
    expect(normalizeLat(-Infinity)).toBe(-90);
  });
});

describe('normalizeCoords', () => {
  it('normalizes both coordinates', () => {
    expect(normalizeCoords([100, 200])).toEqual([90, -160]);
    expect(normalizeCoords([0, 0])).toEqual([0, 0]);
    expect(normalizeCoords([-100, -200])).toEqual([-90, 160]);
  });

  it('handles valid coordinates unchanged', () => {
    expect(normalizeCoords([45, 90])).toEqual([45, 90]);
    expect(normalizeCoords([-45, -90])).toEqual([-45, -90]);
  });

  it('handles edge cases', () => {
    expect(normalizeCoords([90, 180])).toEqual([90, 180]);
    expect(normalizeCoords([-90, -180])).toEqual([-90, -180]);
  });

  it('handles invalid inputs gracefully', () => {
    expect(normalizeCoords([NaN, NaN])).toEqual([0, 0]);
    expect(normalizeCoords([Infinity, -Infinity])).toEqual([90, 0]);
  });
});
