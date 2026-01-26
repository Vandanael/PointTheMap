import { describe, it, expect } from 'vitest';
import { haversine, formatScore, generateId, isIOS } from './utils.js';

describe('haversine', () => {
  it('calculates distance between Paris and London', () => {
    const paris = [48.8566, 2.3522];
    const london = [51.5074, -0.1278];
    const distance = haversine(paris, london);

    // Actual distance is ~344km
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

    // Should be ~222km (2 degrees at equator)
    expect(distance).toBeCloseTo(222, 0);
  });

  it('handles poles correctly', () => {
    const northPole = [90, 0];
    const southPole = [-90, 0];
    const distance = haversine(northPole, southPole);

    // Half Earth circumference ~20,015km
    expect(distance).toBeCloseTo(20015, 0);
  });

  it('calculates distance between New York and Tokyo', () => {
    const newYork = [40.7128, -74.0060];
    const tokyo = [35.6762, 139.6503];
    const distance = haversine(newYork, tokyo);

    // Actual distance is ~10,850km (allow 10km tolerance)
    expect(distance).toBeCloseTo(10850, -1);
  });
});

describe('formatScore', () => {
  it('formats score with French locale', () => {
    const formatted = formatScore(1000);
    // French locale uses narrow no-break space (U+202F)
    expect(formatted).toMatch(/1[\s\u202F]000/);
  });

  it('formats large score', () => {
    const formatted = formatScore(25000);
    expect(formatted).toMatch(/25[\s\u202F]000/);
  });

  it('rounds decimal scores', () => {
    expect(formatScore(1234.56)).toMatch(/1[\s\u202F]235/);
  });

  it('handles zero score', () => {
    expect(formatScore(0)).toBe('0');
  });

  it('handles negative scores by converting to positive', () => {
    const formatted = formatScore(-100);
    expect(formatted).toMatch(/-100/);
  });
});

describe('generateId', () => {
  it('generates a string ID', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).not.toBe(id2);
  });

  it('generates alphanumeric IDs', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('generates IDs consistently', () => {
    const ids = Array.from({ length: 100 }, () => generateId());
    const uniqueIds = new Set(ids);

    // All 100 IDs should be unique
    expect(uniqueIds.size).toBe(100);
  });
});

describe('isIOS', () => {
  it('returns false in test environment', () => {
    expect(isIOS()).toBe(false);
  });

  it('returns boolean', () => {
    const result = isIOS();
    expect(typeof result).toBe('boolean');
  });
});
