/**
 * Shared geo utilities
 * Used by both client (MapSystem, ScoringSystem) and server (submit.js)
 */

import { haversine } from '../game-math/index.js';

/**
 * Simple point-in-polygon test using ray casting algorithm
 * @param {Object} point - GeoJSON-like object with coordinates [lng, lat]
 * @param {Object} geometry - GeoJSON geometry (Polygon or MultiPolygon)
 * @returns {boolean}
 */
export function pointInPolygon(point, geometry) {
  const [x, y] = point.coordinates;

  if (geometry.type === 'Polygon') {
    return testPolygon(x, y, geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(polygon => testPolygon(x, y, polygon));
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
  let inside = false;

  for (let i = 0, j = exterior.length - 1; i < exterior.length; j = i++) {
    const xi = exterior[i][0], yi = exterior[i][1];
    const xj = exterior[j][0], yj = exterior[j][1];

    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  // If inside exterior ring, check holes (remaining rings)
  if (inside && rings.length > 1) {
    for (let h = 1; h < rings.length; h++) {
      const hole = rings[h];
      let inHole = false;

      for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
        const xi = hole[i][0], yi = hole[i][1];
        const xj = hole[j][0], yj = hole[j][1];

        const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

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
 * @param {Object} geometry - GeoJSON geometry (Polygon or MultiPolygon)
 * @returns {number} Distance in kilometers
 */
export function distanceToPolygonBorder(clickCoords, geometry) {
  if (!geometry) return Infinity;

  const [clickLat, clickLng] = clickCoords;
  let minDistance = Infinity;

  const processRing = (ring) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i];
      const [lng2, lat2] = ring[i + 1];

      const distance = distanceToLineSegment(
        clickLat, clickLng,
        lat1, lng1,
        lat2, lng2
      );

      minDistance = Math.min(minDistance, distance);
    }
  };

  if (geometry.type === 'Polygon') {
    processRing(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => {
      processRing(polygon[0]);
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

  const t = Math.max(0, Math.min(1,
    ((lng - lng1) * dx + (lat - lat1) * dy) / lengthSquared
  ));

  const closestLat = lat1 + t * dy;
  const closestLng = lng1 + t * dx;

  return haversine([lat, lng], [closestLat, closestLng]);
}

/**
 * Calculate score for Country/Civilization mode based on distance
 *
 * Scoring curve:
 * - d = 0 km (inside): 5000 points
 * - 0 < d <= 50 km: 4000 points
 * - 50 < d <= 200 km: 3000 points
 * - d > 200 km: exponential decay from 3000 to 0
 *
 * @param {number} distanceKm - Distance to target in kilometers
 * @returns {number} Score (0-5000)
 */
export function calculateCountryScore(distanceKm) {
  if (distanceKm === 0) return 5000;
  if (distanceKm <= 50) return 4000;
  if (distanceKm <= 200) return 3000;

  const decayConstant = 1500;
  const score = 3000 * Math.exp(-(distanceKm - 200) / decayConstant);
  return Math.round(Math.max(0, Math.min(3000, score)));
}
