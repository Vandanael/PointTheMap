import { describe, it, expect } from 'vitest';
import { pointInPolygon, distanceToPolygonBorder, calculateCountryScore } from './index.js';

/** @typedef {{ type: "Polygon", coordinates: number[][][] }} PolygonGeometry */
/** @typedef {{ type: "MultiPolygon", coordinates: number[][][][] }} MultiPolygonGeometry */

// Simple square polygon: [0,0] to [10,10] (lng, lat)
/** @type {PolygonGeometry} */
const squarePolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ],
  ],
};

// MultiPolygon with two squares
/** @type {MultiPolygonGeometry} */
const multiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [0, 0],
        [5, 0],
        [5, 5],
        [0, 5],
        [0, 0],
      ],
    ],
    [
      [
        [20, 20],
        [25, 20],
        [25, 25],
        [20, 25],
        [20, 20],
      ],
    ],
  ],
};

// Polygon with a hole
/** @type {PolygonGeometry} */
const polygonWithHole = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0],
    ], // exterior
    [
      [3, 3],
      [7, 3],
      [7, 7],
      [3, 7],
      [3, 3],
    ], // hole
  ],
};

describe('pointInPolygon', () => {
  it('should return true for point inside polygon', () => {
    expect(pointInPolygon({ coordinates: [5, 5] }, squarePolygon)).toBe(true);
  });

  it('should return false for point outside polygon', () => {
    expect(pointInPolygon({ coordinates: [15, 15] }, squarePolygon)).toBe(false);
  });

  it('should handle MultiPolygon — inside first polygon', () => {
    expect(pointInPolygon({ coordinates: [2, 2] }, multiPolygon)).toBe(true);
  });

  it('should handle MultiPolygon — inside second polygon', () => {
    expect(pointInPolygon({ coordinates: [22, 22] }, multiPolygon)).toBe(true);
  });

  it('should handle MultiPolygon — outside all polygons', () => {
    expect(pointInPolygon({ coordinates: [12, 12] }, multiPolygon)).toBe(false);
  });

  it('should return false for point inside hole', () => {
    expect(pointInPolygon({ coordinates: [5, 5] }, polygonWithHole)).toBe(false);
  });

  it('should return true for point inside exterior but outside hole', () => {
    expect(pointInPolygon({ coordinates: [1, 1] }, polygonWithHole)).toBe(true);
  });

  it('should return false for unknown geometry type', () => {
    expect(
      pointInPolygon(
        { coordinates: [5, 5] },
        /** @type {any} */ ({ type: 'Point', coordinates: [5, 5] })
      )
    ).toBe(false);
  });
});

describe('distanceToPolygonBorder', () => {
  it('should return 0 or near 0 for point on border', () => {
    const dist = distanceToPolygonBorder([0, 5], squarePolygon);
    expect(dist).toBeLessThan(1); // Very close to border
  });

  it('should return positive distance for point outside', () => {
    const dist = distanceToPolygonBorder([15, 5], squarePolygon);
    expect(dist).toBeGreaterThan(0);
  });

  it('should return Infinity for null geometry', () => {
    expect(distanceToPolygonBorder([5, 5], null)).toBe(Infinity);
  });

  it('should handle MultiPolygon', () => {
    const dist = distanceToPolygonBorder([3, 3], multiPolygon);
    expect(dist).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateCountryScore', () => {
  it('should return 5000 for distance 0 (inside country)', () => {
    expect(calculateCountryScore(0)).toBe(5000);
  });

  it('should return 4000 for distance <= 50 km', () => {
    expect(calculateCountryScore(10)).toBe(4000);
    expect(calculateCountryScore(50)).toBe(4000);
  });

  it('should return 3000 for distance <= 200 km', () => {
    expect(calculateCountryScore(100)).toBe(3000);
    expect(calculateCountryScore(200)).toBe(3000);
  });

  it('should decay for distance > 200 km', () => {
    const score500 = calculateCountryScore(500);
    const score1000 = calculateCountryScore(1000);
    expect(score500).toBeLessThan(3000);
    expect(score500).toBeGreaterThan(score1000);
    expect(score1000).toBeGreaterThan(0);
  });

  it('should approach 0 for very large distances', () => {
    expect(calculateCountryScore(10000)).toBeLessThan(10);
  });
});
