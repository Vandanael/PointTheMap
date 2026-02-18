/**
 * Shared geo utilities
 * Used by both client (MapSystem, ScoringSystem) and server (submit.js)
 */

import { haversine } from '../game-math/index.js';

/**
 * Simple point-in-polygon test using ray casting algorithm
 * @typedef {{ type: "Polygon", coordinates: number[][][] }} PolygonGeometry
 * @typedef {{ type: "MultiPolygon", coordinates: number[][][][] }} MultiPolygonGeometry
 * @typedef {PolygonGeometry | MultiPolygonGeometry} GeoJSONGeometry
 * @typedef {{ coordinates: [number, number], type?: 'Point' }} GeoJSONPoint
 */

/**
 * Simple point-in-polygon test using ray casting algorithm
 * @param {GeoJSONPoint} point - GeoJSON-like object with coordinates [lng, lat]
 * @param {GeoJSONGeometry} geometry - GeoJSON geometry (Polygon or MultiPolygon)
 * @returns {boolean}
 */
export function pointInPolygon(point, geometry) {
  const [x, y] = point.coordinates;

  if (geometry.type === 'Polygon') {
    return testPolygon(x, y, geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((/** @type {number[][][]} */ polygon) =>
      testPolygon(x, y, polygon)
    );
  }

  return false;
}

/**
 * Test if point is inside polygon using ray casting
 * @param {number} x - Longitude
 * @param {number} y - Latitude
 * @param {number[][][]} rings - Polygon coordinate rings
 * @returns {boolean}
 */
function testPolygon(x, y, rings) {
  // Test exterior ring (first ring)
  const exterior = rings[0];
  if (!exterior || exterior.length < 3) return false;
  let inside = false;

  for (let i = 0, j = exterior.length - 1; i < exterior.length; j = i++) {
    const curr = exterior[i];
    const prev = exterior[j];
    if (!curr || !prev) continue;
    const xi = curr[0] ?? 0,
      yi = curr[1] ?? 0;
    const xj = prev[0] ?? 0,
      yj = prev[1] ?? 0;

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  // If inside exterior ring, check holes (remaining rings)
  if (inside && rings.length > 1) {
    for (let h = 1; h < rings.length; h++) {
      const hole = rings[h];
      if (!hole || hole.length < 3) continue;
      let inHole = false;

      for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
        const curr = hole[i];
        const prev = hole[j];
        if (!curr || !prev) continue;
        const xi = curr[0] ?? 0,
          yi = curr[1] ?? 0;
        const xj = prev[0] ?? 0,
          yj = prev[1] ?? 0;

        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

        if (intersect) inHole = !inHole;
      }

      if (inHole) return false; // Point is in a hole
    }
  }

  return inside;
}

/**
 * Calculate distance from point to nearest polygon border
 * @param {[number, number]} clickCoords - [lat, lng] of click
 * @param {GeoJSONGeometry | null} geometry - GeoJSON geometry (Polygon or MultiPolygon)
 * @returns {number} Distance in kilometers
 */
export function distanceToPolygonBorder(clickCoords, geometry) {
  if (!geometry) return Infinity;

  const [clickLat, clickLng] = clickCoords;
  let minDistance = Infinity;

  /** @param {number[][]} ring */
  const processRing = (ring) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      if (!a || !b) continue;
      const lng1 = a[0] ?? 0;
      const lat1 = a[1] ?? 0;
      const lng2 = b[0] ?? 0;
      const lat2 = b[1] ?? 0;

      const distance = distanceToLineSegment(clickLat, clickLng, lat1, lng1, lat2, lng2);

      minDistance = Math.min(minDistance, distance);
    }
  };

  if (geometry.type === 'Polygon') {
    const exterior = geometry.coordinates[0];
    if (exterior) processRing(exterior);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((/** @type {number[][][]} */ polygon) => {
      const exterior = polygon[0];
      if (exterior) processRing(exterior);
    });
  }

  return minDistance;
}

/**
 * Calculate distance from point to line segment using Haversine
 * @param {number} lat - Point latitude
 * @param {number} lng - Point longitude
 * @param {number} lat1 - Segment start latitude
 * @param {number} lng1 - Segment start longitude
 * @param {number} lat2 - Segment end latitude
 * @param {number} lng2 - Segment end longitude
 * @returns {number} Distance in kilometers
 */
function distanceToLineSegment(lat, lng, lat1, lng1, lat2, lng2) {
  const dx = lng2 - lng1;
  const dy = lat2 - lat1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return haversine([lat, lng], [lat1, lng1]);
  }

  const t = Math.max(0, Math.min(1, ((lng - lng1) * dx + (lat - lat1) * dy) / lengthSquared));

  const closestLat = lat1 + t * dy;
  const closestLng = lng1 + t * dx;

  return haversine([lat, lng], [closestLat, closestLng]);
}

/**
 * Calculate score for Country/Civilization mode based on distance
 *
 * Smooth scoring curve with anchor compatibility:
 * - d = 0 km: 5000 points
 * - d = 50 km: 4000 points
 * - d = 200 km: 3000 points
 * - d > 200 km: exponential decay from 3000 to 0
 *
 * The 0-50 and 50-200 segments are continuous and smooth at boundaries
 * to avoid hard score cliffs around threshold distances.
 *
 * @param {number} distanceKm - Distance to target in kilometers
 * @returns {number} Score (0-5000)
 */
export function calculateCountryScore(distanceKm) {
  if (!Number.isFinite(distanceKm)) return 0;
  if (distanceKm <= 0) return 5000;

  // 0-50km: ease from 5000 -> 4000
  if (distanceKm <= 50) {
    const t = distanceKm / 50;
    const ease = t * (2 - t);
    return Math.round(5000 - 1000 * ease);
  }

  // 50-200km: smoothstep from 4000 -> 3000
  if (distanceKm <= 200) {
    const t = (distanceKm - 50) / 150;
    const smooth = t * t * (3 - 2 * t);
    return Math.round(4000 - 1000 * smooth);
  }

  const decayConstant = 1500;
  const score = 3000 * Math.exp(-(distanceKm - 200) / decayConstant);
  return Math.round(Math.max(0, Math.min(5000, score)));
}
