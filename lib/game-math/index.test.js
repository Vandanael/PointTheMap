import { describe, it, expect } from 'vitest';
import { haversine, calculateScore, calculateScoreV1, calculateScoreV2, normalizeLng, normalizeLat, normalizeCoords } from './index.js';

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

describe('calculateScoreV1 (Legacy)', () => {
  it('returns max score for distance < 0.5km (perfect zone)', () => {
    expect(calculateScoreV1(0)).toBe(5000);
    expect(calculateScoreV1(0.5)).toBe(5000);
    expect(calculateScoreV1(0.49)).toBe(5000);
  });

  it('applies exponential decay for distance 2-100km', () => {
    expect(calculateScoreV1(2)).toBeLessThan(5000);
    expect(calculateScoreV1(50)).toBe(4182);
    expect(calculateScoreV1(99)).toBeLessThan(calculateScoreV1(50));
  });

  it('applies linear interpolation for 100-500km', () => {
    expect(calculateScoreV1(100)).toBe(3498);
    expect(calculateScoreV1(300)).toBe(2249);
    expect(calculateScoreV1(500)).toBe(1000);
  });

  it('applies exponential decay for distance > 500km', () => {
    expect(calculateScoreV1(1000)).toBe(535);
    expect(calculateScoreV1(5000)).toBe(4);
    expect(calculateScoreV1(20000)).toBe(0);
  });
});

describe('calculateScoreV2 (Current)', () => {
  it('returns max score for distance < 0.1km (perfect zone)', () => {
    expect(calculateScoreV2(0)).toBe(5000);
    expect(calculateScoreV2(0.05)).toBe(5000);
    expect(calculateScoreV2(0.09)).toBe(5000);
  });

  it('applies sigmoid formula with smooth decay', () => {
    // Sigmoid decays very slowly at first due to k=800 (casual-friendly)
    expect(calculateScoreV2(0.5)).toBe(4999);  // Just below perfect threshold
    expect(calculateScoreV2(1)).toBe(4998);    // Still very high
    expect(calculateScoreV2(10)).toBe(4974);   // Minimal drop
    expect(calculateScoreV2(10)).toBeLessThan(5000);
    expect(calculateScoreV2(10)).toBeGreaterThan(4900);
  });

  it('provides balanced score distribution (casual-friendly)', () => {
    // Actual scores with k=800, p=1.2 (balanced for casual + expert)
    expect(calculateScoreV2(10)).toBeCloseTo(4974, -1);   // ~4974 pts (99%)
    expect(calculateScoreV2(50)).toBeCloseTo(4827, -1);   // ~4827 pts (97%)
    expect(calculateScoreV2(100)).toBeCloseTo(4619, -1);  // ~4619 pts (92%)
    expect(calculateScoreV2(500)).toBeCloseTo(3187, -1);  // ~3187 pts (64%)
    expect(calculateScoreV2(1000)).toBeCloseTo(2167, -1); // ~2167 pts (43%) - encouraging!
    expect(calculateScoreV2(2000)).toBeCloseTo(1249, -1); // ~1249 pts (25%)
    expect(calculateScoreV2(5000)).toBeCloseTo(499, -1);  // ~499 pts (10%)

    // Verify it's still rewarding good precision
    expect(calculateScoreV2(10)).toBeGreaterThan(4900);
    expect(calculateScoreV2(100)).toBeGreaterThan(4500);
  });

  it('is smooth and continuous (no discontinuities)', () => {
    // Test that adjacent distances don't have large jumps
    for (let d = 0; d < 1000; d += 10) {
      const score1 = calculateScoreV2(d);
      const score2 = calculateScoreV2(d + 1);
      const diff = Math.abs(score1 - score2);
      expect(diff).toBeLessThan(100); // No jumps > 100pts per km
    }
  });

  it('is monotone (score decreases with distance)', () => {
    const distances = [0, 0.1, 1, 10, 50, 100, 200, 500, 1000, 5000];
    let previousScore = Infinity;

    for (const dist of distances) {
      const score = calculateScoreV2(dist);
      expect(score).toBeLessThanOrEqual(previousScore);
      previousScore = score;
    }
  });

  it('returns integer scores', () => {
    for (let i = 0; i < 10; i++) {
      const distance = Math.random() * 10000;
      const score = calculateScoreV2(distance);
      expect(score).toBe(Math.round(score));
    }
  });

  it('never returns negative scores', () => {
    expect(calculateScoreV2(0)).toBeGreaterThanOrEqual(0);
    expect(calculateScoreV2(10000)).toBeGreaterThanOrEqual(0);
    expect(calculateScoreV2(50000)).toBeGreaterThanOrEqual(0);
  });

  it('accepts custom config parameters', () => {
    const customConfig = {
      perfectThreshold: 0.5,
      k: 150,
      p: 3.0,
      maxScore: 10000
    };

    const score = calculateScoreV2(100, customConfig);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(10000);

    // Perfect zone respects custom threshold
    expect(calculateScoreV2(0.4, customConfig)).toBe(10000);
    expect(calculateScoreV2(10, customConfig)).toBeLessThan(10000); // Noticeable drop at 10km
  });
});

describe('calculateScore (default export = V2)', () => {
  it('uses V2 formula by default', () => {
    expect(calculateScore(0)).toBe(calculateScoreV2(0));
    expect(calculateScore(50)).toBe(calculateScoreV2(50));
    expect(calculateScore(1000)).toBe(calculateScoreV2(1000));
  });

  it('is monotone (score decreases with distance)', () => {
    const distances = [0, 0.1, 1, 2, 10, 50, 100, 200, 500, 1000, 5000];
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
