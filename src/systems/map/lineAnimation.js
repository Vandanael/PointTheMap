import { MAP_ANIMATIONS, RESULT_LINES, getLineColor } from '../../config/visual-constants.js';

/**
 * Returns a Promise that resolves once after the next map moveend.
 * Safe when the map is already settled (e.g. fitBounds no-op): moveend still fires in Leaflet.
 * @param {import('leaflet').Map} map - Leaflet map instance
 * @returns {Promise<void>}
 */
export function waitForMapSettled(map) {
  if (!map) return Promise.resolve();
  return new Promise((resolve) => {
    map.once('moveend', () => resolve());
  });
}

/**
 * Format distance for display on the result line (e.g. "344 km", "1 234 km").
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string}
 */
export function formatDistanceLabel(distanceKm) {
  const km = Math.round(distanceKm);
  return `${km} km`;
}

/**
 * Normalize segment end so the arc from from to to is the shortest (|lon delta| <= 180).
 * @param {[number, number]} from - [lat, lng] start
 * @param {[number, number]} to - [lat, lng] end
 * @returns {[number, number]} [lat2, lon2'] with lon2' adjusted for shortest arc
 */
export function normalizeSegmentEnd(from, to) {
  const [, lon1] = from;
  const [lat2, lon2] = to;
  let lon2Norm = lon2;
  const dLon = lon2 - lon1;
  if (dLon > 180) lon2Norm = lon2 - 360;
  else if (dLon < -180) lon2Norm = lon2 + 360;
  return [lat2, lon2Norm];
}

/**
 * Precompute interpolated points from start to end (linear lat/lng, shortest arc).
 * @param {[number, number]} from - [lat, lng]
 * @param {[number, number]} to - [lat, lng]
 * @param {number} steps - Number of segments (points length = steps + 1)
 * @returns {[number, number][]}
 */
export function interpolatePoints(from, to, steps) {
  const toNorm = normalizeSegmentEnd(from, to);
  /** @type {[number, number][]} */
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([from[0] + (toNorm[0] - from[0]) * t, from[1] + (toNorm[1] - from[1]) * t]);
  }
  return points;
}

/**
 * Animate a result line from start to end using requestAnimationFrame.
 * Creates outline + main polylines (dashed), distance label at midpoint; updates each frame.
 * @param {typeof import('leaflet')} L - Leaflet namespace
 * @param {import('leaflet').Map} map - Leaflet map instance
 * @param {[number, number]} startLatLng - [lat, lng]
 * @param {[number, number]} endLatLng - [lat, lng]
 * @param {number} distanceKm - Distance for line color and label
 * @param {{ durationMs?: number, steps?: number }} [options] - Override RESULT_LINE defaults
 * @returns {{ cancel: () => void, layerGroup: import('leaflet').LayerGroup, ready: Promise<void> }}
 */
export function animateResultLine(L, map, startLatLng, endLatLng, distanceKm, options = {}) {
  if (!L) throw new Error('Leaflet not loaded');
  const durationMs = options.durationMs ?? MAP_ANIMATIONS.RESULT_LINE.durationMs;
  const steps = options.steps ?? MAP_ANIMATIONS.RESULT_LINE.steps;
  const endNorm = normalizeSegmentEnd(startLatLng, endLatLng);
  const points = interpolatePoints(startLatLng, endNorm, steps);
  const lineColor = getLineColor(distanceKm);

  const outlineLine = L.polyline([startLatLng], {
    ...RESULT_LINES.OUTLINE,
  });
  const mainLine = L.polyline([startLatLng], {
    ...RESULT_LINES.MAIN,
    color: lineColor,
  });

  const midpoint = points[Math.floor(steps / 2)] ?? startLatLng;
  const distanceLabel = L.marker(midpoint, {
    icon: L.divIcon({
      className: 'result-line-distance-marker',
      html: '<span class="result-line-distance">0 km</span>',
      iconSize: [48, 24],
      iconAnchor: [24, 12],
    }),
    interactive: false,
    keyboard: false,
  });

  const resultLayerGroup = L.layerGroup([outlineLine, mainLine, distanceLabel]);
  resultLayerGroup.addTo(map);

  /** @type {number | null} */
  let rafId = null;
  /** @type {number | null} */
  let startTime = null;
  /** @type {null | ((value?: void | PromiseLike<void>) => void)} */
  let resolveReady = null;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    startTime = null;
    resolveReady?.();
  };

  /** @param {number} progress */
  const updateDistanceLabel = (progress) => {
    const el = distanceLabel.getElement?.();
    if (!el) return;
    const span = el.querySelector('.result-line-distance');
    if (!span) return;
    const currentKm = progress >= 1 ? distanceKm : Math.round(progress * distanceKm);
    span.textContent = `${currentKm} km`;
  };

  const tick = () => {
    if (startTime === null) startTime = performance.now();
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const currentIndex = 1 + Math.floor(progress * steps);
    const visiblePoints = points.slice(0, currentIndex);

    outlineLine.setLatLngs(visiblePoints);
    mainLine.setLatLngs(visiblePoints);
    updateDistanceLabel(progress);

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      outlineLine.setLatLngs(points);
      mainLine.setLatLngs(points);
      updateDistanceLabel(1);
      resolveReady?.();
    }
  };

  rafId = requestAnimationFrame(tick);

  return { cancel, layerGroup: resultLayerGroup, ready };
}
