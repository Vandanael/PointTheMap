/**
 * MapSystem - Wrapper around Leaflet map library
 *
 * Responsibilities:
 * - Abstract Leaflet-specific implementation
 * - Provide clean API for map operations
 * - Emit events via EventBus
 * - Testable without DOM
 *
 * Leaflet is loaded lazily on first init() to reduce initial JS and defer until the map is required.
 */

/** @type {typeof import('leaflet') | null} */
let L = null;

/**
 * Load Leaflet and its CSS when the map is first initialized (deferred to avoid unused JS on initial load).
 * @returns {Promise<typeof import('leaflet')>}
 */
async function loadLeaflet() {
  if (L) return L;
  await import('leaflet/dist/leaflet.css');
  const leaflet = await import('leaflet');
  // Support both default export (real Leaflet) and namespace (e.g. Vitest mock)
  L = leaflet.default ?? leaflet;
  return L;
}

import { MAP } from '../config.js';
import { getTheme, getMapView, setMapView } from '../services/storage.js';
import { isIOS } from '../utils.js';
import { eventBus } from '../core/EventBus.js';
import { logger } from '../utils/logger.js';
import {
  MARKERS,
  LINES,
  RESULT_LINES,
  MAP_ANIMATIONS,
  getLineColor,
} from '../config/visual-constants.js';
import { normalizeCoords } from '@lib/game-math/index.js';

/**
 * Returns a Promise that resolves once after the next map moveend.
 * Safe when the map is already settled (e.g. fitBounds no-op): moveend still fires in Leaflet.
 * @param {L.Map} map - Leaflet map instance
 * @returns {Promise<void>}
 */
function waitForMapSettled(map) {
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
function formatDistanceLabel(distanceKm) {
  const km = Math.round(distanceKm);
  return `${km} km`;
}

/**
 * Normalize segment end so the arc from from to to is the shortest (|lon delta| <= 180).
 * @param {[number, number]} from - [lat, lng] start
 * @param {[number, number]} to - [lat, lng] end
 * @returns {[number, number]} [lat2, lon2'] with lon2' adjusted for shortest arc
 */
function normalizeSegmentEnd(from, to) {
  const [lat1, lon1] = from;
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
function interpolatePoints(from, to, steps) {
  const toNorm = normalizeSegmentEnd(from, to);
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([
      from[0] + (toNorm[0] - from[0]) * t,
      from[1] + (toNorm[1] - from[1]) * t,
    ]);
  }
  return points;
}

/**
 * Animate a result line from start to end using requestAnimationFrame.
 * Creates outline + main polylines (dashed), distance label at midpoint; updates each frame.
 * @param {L.Map} map - Leaflet map instance
 * @param {[number, number]} startLatLng - [lat, lng]
 * @param {[number, number]} endLatLng - [lat, lng]
 * @param {number} distanceKm - Distance for line color and label
 * @param {{ durationMs?: number, steps?: number }} [options] - Override RESULT_LINE defaults
 * @returns {{ cancel: () => void, layerGroup: L.LayerGroup, ready: Promise<void> }}
 */
function animateResultLine(map, startLatLng, endLatLng, distanceKm, options = {}) {
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

  const midpoint = points[Math.floor(steps / 2)];
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

  let rafId = null;
  let startTime = null;
  let cancelled = false;
  let resolveReady = null;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  const cancel = () => {
    cancelled = true;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    startTime = null;
    resolveReady?.();
  };

  const updateDistanceLabel = (progress) => {
    const el = distanceLabel.getElement?.();
    if (!el) return;
    const span = el.querySelector('.result-line-distance');
    if (!span) return;
    const currentKm = progress >= 1 ? distanceKm : Math.round(progress * distanceKm);
    span.textContent = `${currentKm} km`;
  };

  const tick = () => {
    if (startTime == null) startTime = performance.now();
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

export class MapSystem {
  #map = null;
  #tileLayer = null;
  #markers = [];
  #polylines = [];
  #capitalsLayer = null;
  #capitalMarkers = [];
  #clickHandler = null;
  #initialized = false;
  #containerId = null;
  #eventUnsubscribers = [];
  #clearCapitalsTimeout = null;
  #resultLineCancel = null;
  #resultLineLayerGroup = null;
  #resultContinueCallback = null;
  #resultContinueHandler = null;
  // Country mode support
  #countriesLayer = null;
  #countriesGeoJSON = null;
  #countryHighlights = [];
  // Civilization mode support
  #civilizationsLayer = null;
  #civilizationsGeoJSON = null;
  #civilizationHighlights = [];

  constructor() {}

  /**
   * Initialize the map
   * @param {string} containerId - DOM container ID for the map
   * @returns {Promise<boolean>} Success status
   */
  async init(containerId) {
    if (this.#initialized) {
      logger.warn('MapSystem already initialized');
      return true;
    }

    try {
      await loadLeaflet();
      this.#containerId = containerId;
      this.#createMap(containerId);
      this.#setupTileLayer();
      this.#setupEventListeners();
      this.#initialized = true;

      eventBus.emit('map:ready', { containerId });
      return true;
    } catch (error) {
      eventBus.emit('map:error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create Leaflet map instance
   * @private
   */
  #createMap(containerId) {
    const saved = getMapView();
    const initialCenter = saved?.center ?? MAP.CENTER;
    const initialZoom = saved?.zoom ?? MAP.ZOOM;

    this.#map = L.map(containerId, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: MAP.MIN_ZOOM,
      maxZoom: MAP.MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
      keepBuffer: 4,
      zoomAnimation: true,
      preferCanvas: true, // Canvas renderer pour des lignes plus nettes (pas de SVG antialiasing)
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    this.#map.setView(initialCenter, initialZoom, { animate: false });
    this.#map.doubleClickZoom.disable();

    // Make map container focusable for programmatic focus
    // This prevents "first tap = focus restoration" issue on mobile after long idle
    const mapContainer = this.#map.getContainer();
    if (mapContainer && !mapContainer.hasAttribute('tabindex')) {
      mapContainer.setAttribute('tabindex', '-1');
    }

    // Créer un layerGroup dédié aux markers de capitales
    this.#capitalsLayer = L.layerGroup().addTo(this.#map);

    // Désactiver l'antialiasing du Canvas pour des lignes en pointillés plus nettes
    if (this.#map._renderer && this.#map._renderer._ctx) {
      const ctx = this.#map._renderer._ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
    }
  }

  /**
   * Setup tile layer with current theme
   * @private
   */
  #setupTileLayer() {
    this.#updateMapTiles();
  }

  /**
   * Setup event listeners
   * @private
   */
  #setupEventListeners() {
    // Subscribe to theme changes
    const unsubTheme = eventBus.subscribe('theme:changed', () => {
      this.#updateMapTiles();
    });

    this.#eventUnsubscribers.push(unsubTheme);

    // Persist map view on move/zoom (debounced)
    let saveTimeout = null;
    const saveView = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        const center = this.getCenter();
        const zoom = this.getZoom();
        if (center) setMapView(center, zoom);
      }, 300);
    };
    this.#map.on('moveend', saveView);
    this.#eventUnsubscribers.push(() => {
      clearTimeout(saveTimeout);
      this.#map?.off('moveend', saveView);
    });
  }

  /**
   * Update map tiles based on theme
   * @private
   */
  #updateMapTiles() {
    if (!this.#map) return;

    // Remove old tile layer
    if (this.#tileLayer) {
      this.#map.removeLayer(this.#tileLayer);
    }

    // Choose tiles based on theme
    const theme = getTheme();
    const tileUrl = theme === 'light' ? MAP.TILE_URL_LIGHT : MAP.TILE_URL_DARK;

    this.#tileLayer = L.tileLayer(tileUrl, {
      maxZoom: MAP.MAX_ZOOM,
      attribution: MAP.ATTRIBUTION,
      keepBuffer: 4,
      updateWhenZooming: true,
      updateWhenIdle: true,
      crossOrigin: false,
      minZoom: MAP.MIN_ZOOM,
    }).addTo(this.#map);

    // Suppress tile errors (they're not critical)
    this.#tileLayer.on('tileerror', () => {});
  }

  /**
   * Enable map clicks
   * @param {Function} callback - Callback function receiving [lat, lng]
   */
  enableClicks(callback) {
    if (!this.#map) {
      throw new Error('Map not initialized');
    }

    // Remove existing handler
    this.disableClicks();

    // Refresh map size and hit-testing after long idle
    // After tab inactive or long wait, map's internal size/hit-testing can be stale
    // This ensures clicks are properly registered to the correct lat/lng
    this.#map.invalidateSize({ animate: false });

    // Create new handler
    this.#clickHandler = (e) => {
      const coords = [e.latlng.lat, e.latlng.lng];

      // Emit event
      eventBus.emit('map:click', { lat: e.latlng.lat, lng: e.latlng.lng });

      // Call callback
      if (callback) {
        callback(coords);
      }
    };

    // Attach handlers
    this.#map.on('click', this.#clickHandler);

    // Mobile: Add tap support for better responsiveness on all mobile devices
    // Prevents 300ms click delay on Android and other mobile browsers
    if (L.Browser.mobile || isIOS()) {
      this.#map.on('tap', this.#clickHandler);
    }
  }

  /**
   * Disable map clicks
   */
  disableClicks() {
    if (!this.#map || !this.#clickHandler) {
      return;
    }

    this.#map.off('click', this.#clickHandler);

    // Mobile: Disable tap events too (for all mobile devices)
    if (L.Browser.mobile || isIOS()) {
      this.#map.off('tap', this.#clickHandler);
    }

    this.#clickHandler = null;
  }

  /**
   * Register a one-time tap/click handler to continue after the result line is shown.
   * Call clearOnResultContinue() when done (e.g. before showing the modal or on timeout).
   * @param {() => void} callback - Called when the user taps or clicks the map
   */
  setOnResultContinue(callback) {
    if (!this.#map) return;
    this.clearOnResultContinue();
    this.#resultContinueCallback = callback;
    this.#resultContinueHandler = () => {
      this.#resultContinueCallback?.();
      this.clearOnResultContinue();
    };
    this.#map.once('click', this.#resultContinueHandler);
    if (L.Browser.mobile || isIOS()) {
      this.#map.once('tap', this.#resultContinueHandler);
    }
  }

  /**
   * Remove the result-continue listener and callback (call after user continued or timeout).
   */
  clearOnResultContinue() {
    if (!this.#map || !this.#resultContinueHandler) {
      this.#resultContinueCallback = null;
      this.#resultContinueHandler = null;
      return;
    }
    this.#map.off('click', this.#resultContinueHandler);
    if (L.Browser.mobile || isIOS()) {
      this.#map.off('tap', this.#resultContinueHandler);
    }
    this.#resultContinueCallback = null;
    this.#resultContinueHandler = null;
  }

  /**
   * Add player click marker
   * @param {[number, number]} coords - [lat, lng]
   * @returns {Object} Leaflet marker instance
   */
  addClickMarker(coords) {
    const markerInstance = L.marker(coords, {
      icon: L.divIcon({
        className: '',
        html: `<div class="marker-player"></div>`,
        iconSize: MARKERS.PLAYER.iconSize,
        iconAnchor: MARKERS.PLAYER.iconAnchor,
      }),
    }).addTo(this.#map);

    this.#markers.push(markerInstance);
    return markerInstance;
  }

  /**
   * Add capital target marker
   * @param {[number, number]} coords - [lat, lng]
   * @returns {Object} Leaflet marker instance
   */
  addCapitalMarker(coords) {
    if (!this.#capitalsLayer) {
      throw new Error('Map not initialized');
    }

    const markerInstance = L.marker(coords, {
      icon: L.divIcon({
        className: '',
        html: `<div class="marker-target"></div>`,
        iconSize: MARKERS.CAPITAL.iconSize,
        iconAnchor: MARKERS.CAPITAL.iconAnchor,
      }),
    }).addTo(this.#capitalsLayer);

    this.#markers.push(markerInstance);
    this.#capitalMarkers.push(markerInstance);
    return markerInstance;
  }

  /**
   * Draw line between two points
   * @param {[number, number]} from - Start coordinates [lat, lng]
   * @param {[number, number]} to - End coordinates [lat, lng]
   * @param {number} distanceKm - Distance in kilometers
   * @returns {Object} Leaflet layer group
   */
  drawLine(from, to, distanceKm) {
    const lineColor = getLineColor(distanceKm);
    const coords = [from, normalizeSegmentEnd(from, to)];

    const outlineLine = L.polyline(coords, {
      ...LINES.OUTLINE,
    });

    const mainLine = L.polyline(coords, {
      ...LINES.MAIN,
      color: lineColor,
    });

    const lineGroup = L.layerGroup([outlineLine, mainLine]).addTo(this.#map);
    this.#polylines.push(lineGroup);
    return lineGroup;
  }

  /**
   * Show round result: markers, flyToBounds, then (unless skipResultLine) dashed result line + distance label (animated).
   * Resolves when the line animation is complete (or immediately after flyTo when skipResultLine).
   * @param {[number, number]} clickCoords - Player click coordinates
   * @param {[number, number]} capitalCoords - Capital coordinates
   * @param {number} distanceKm - Distance in kilometers
   * @param {{ skipResultLine?: boolean }} [options] - If skipResultLine true, do not draw/animate the result line
   * @returns {Promise<void>}
   */
  async showRoundResult(clickCoords, capitalCoords, distanceKm, options = {}) {
    const skipResultLine = options.skipResultLine === true;

    if (this.#clearCapitalsTimeout) {
      clearTimeout(this.#clearCapitalsTimeout);
      this.#clearCapitalsTimeout = null;
    }

    // Cancel any previous result-line animation and remove its layer
    this.#resultLineCancel?.();
    this.#resultLineCancel = null;
    if (this.#resultLineLayerGroup) {
      this.#map.removeLayer(this.#resultLineLayerGroup);
      this.#polylines = this.#polylines.filter((p) => p !== this.#resultLineLayerGroup);
      this.#resultLineLayerGroup = null;
    }

    this.clearCapitals();
    this.addClickMarker(clickCoords);
    this.addCapitalMarker(capitalCoords);

    const endNorm = normalizeSegmentEnd(clickCoords, capitalCoords);
    const bounds = L.latLngBounds([clickCoords, endNorm]);
    const fitBoundsOptions = {
      ...MAP_ANIMATIONS.SHOW_RESULT,
      padding: [60, 60],
      maxZoom: 14,
    };
    this.#map.flyToBounds(bounds, fitBoundsOptions);

    await waitForMapSettled(this.#map);

    if (skipResultLine) {
      eventBus.emit('map:result-shown', {
        clickCoords,
        capitalCoords,
        distanceKm,
      });
      return;
    }

    const { cancel, layerGroup, ready } = animateResultLine(
      this.#map,
      clickCoords,
      capitalCoords,
      distanceKm,
    );
    this.#resultLineCancel = cancel;
    this.#resultLineLayerGroup = layerGroup;
    this.#polylines.push(layerGroup);

    await ready;

    eventBus.emit('map:result-shown', {
      clickCoords,
      capitalCoords,
      distanceKm,
    });
  }

  /**
   * Clear all markers and polylines from the map.
   * Also clears the result-continue listener if set (e.g. when navigating away during result view).
   */
  clearMap() {
    if (!this.#map) return;

    this.#resultLineCancel?.();
    this.#resultLineCancel = null;
    this.#resultLineLayerGroup = null;
    this.clearOnResultContinue();

    this.clearCapitals();
    this.clearCountryHighlights();
    this.clearCivilizationHighlights();

    this.#markers.forEach((m) => this.#map.removeLayer(m));
    this.#polylines.forEach((p) => this.#map.removeLayer(p));
    this.#markers = [];
    this.#polylines = [];

    eventBus.emit('map:cleared');
  }

  /**
   * Clear all capital markers from the map
   * This removes only the capital markers, keeping other markers and polylines intact
   */
  clearCapitals() {
    if (!this.#capitalsLayer) return;

    // Annuler le timeout en cours s'il existe
    if (this.#clearCapitalsTimeout) {
      clearTimeout(this.#clearCapitalsTimeout);
      this.#clearCapitalsTimeout = null;
    }

    // Clear the layer (removes markers from the map)
    this.#capitalsLayer.clearLayers();

    // Remove capital markers from the main markers array
    this.#markers = this.#markers.filter((m) => !this.#capitalMarkers.includes(m));

    // Clear the capital markers tracking array
    this.#capitalMarkers = [];

    eventBus.emit('map:capitals-cleared');
  }

  /**
   * Reset map view to default
   */
  resetView() {
    if (!this.#map) return;

    this.#map.flyTo(MAP.CENTER, MAP.ZOOM, MAP_ANIMATIONS.RESET_VIEW);

    eventBus.emit('map:view-reset');
  }

  /**
   * Fly to specific coordinates
   * @param {[number, number]} coords - Target coordinates [lat, lng]
   * @param {number} [zoom] - Target zoom level
   * @param {Object} [options] - Animation options
   */
  flyTo(coords, zoom = MAP.ZOOM, options = {}) {
    if (!this.#map) return;

    this.#map.flyTo(coords, zoom, options);
  }

  /**
   * Get current map center
   * @returns {[number, number]} Center coordinates [lat, lng]
   */
  getCenter() {
    if (!this.#map) return null;

    const center = this.#map.getCenter();
    return [center.lat, center.lng];
  }

  /**
   * Get current zoom level
   * @returns {number} Zoom level
   */
  getZoom() {
    if (!this.#map) return null;

    return this.#map.getZoom();
  }

  /**
   * Check if map is initialized
   * @returns {boolean}
   */
  isInitialized() {
    return this.#initialized;
  }

  /**
   * Get marker count
   * @returns {number}
   */
  getMarkerCount() {
    return this.#markers.length;
  }

  /**
   * Get polyline count
   * @returns {number}
   */
  getPolylineCount() {
    return this.#polylines.length;
  }

  /**
   * Load countries GeoJSON layer for Country mode
   * Should be called once during game initialization if Country mode is available
   * @returns {Promise<boolean>} Success status
   */
  async loadCountriesGeoJSON() {
    if (this.#countriesLayer) {
      logger.warn('Countries layer already loaded');
      return true;
    }

    try {
      const response = await fetch('/data/countries.geojson');
      if (!response.ok) {
        throw new Error(`Failed to load countries.geojson: ${response.status}`);
      }

      this.#countriesGeoJSON = await response.json();

      // Create GeoJSON layer (invisible by default)
      this.#countriesLayer = L.geoJSON(this.#countriesGeoJSON, {
        style: () => ({
          fillColor: 'transparent',
          fillOpacity: 0,
          color: 'transparent',
          weight: 0,
          interactive: false
        })
      }).addTo(this.#map);

      logger.info('Countries GeoJSON loaded successfully');
      eventBus.emit('map:countries-loaded');
      return true;
    } catch (error) {
      logger.error('Failed to load countries GeoJSON:', error);
      eventBus.emit('map:countries-error', { error: error.message });
      return false;
    }
  }

  /**
   * Detect which country contains the given coordinates
   * @param {[number, number]} latlng - [lat, lng] coordinates
   * @returns {string|null} Country ID (ISO A3) or null if not in any country
   */
  getCountryAtLatLng(latlng) {
    if (!this.#countriesGeoJSON) {
      logger.warn('Countries GeoJSON not loaded');
      return null;
    }

    const [lat, lng] = this.#map
      ? (() => {
          const wrapped = this.#map.wrapLatLng(L.latLng(latlng));
          return [wrapped.lat, wrapped.lng];
        })()
      : normalizeCoords(latlng);
    const point = { type: 'Point', coordinates: [lng, lat] };

    // Find country containing this point
    for (const feature of this.#countriesGeoJSON.features) {
      if (this.#pointInPolygon(point, feature.geometry)) {
        return feature.properties.ISO_A3 || feature.properties.ADM0_A3;
      }
    }

    return null; // Ocean or no match
  }

  /**
   * Simple point-in-polygon test using ray casting algorithm
   * @private
   * @param {Object} point - GeoJSON point
   * @param {Object} geometry - GeoJSON geometry (Polygon or MultiPolygon)
   * @returns {boolean}
   */
  #pointInPolygon(point, geometry) {
    const [x, y] = point.coordinates;

    if (geometry.type === 'Polygon') {
      return this.#testPolygon(x, y, geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some(polygon => this.#testPolygon(x, y, polygon));
    }

    return false;
  }

  /**
   * Test if point is inside polygon using ray casting
   * @private
   */
  #testPolygon(x, y, rings) {
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
   * Get country feature by ID
   * @param {string} countryId - Country ID (ISO A3)
   * @returns {Object|null} GeoJSON feature or null
   */
  getCountryFeatureById(countryId) {
    if (!this.#countriesGeoJSON) return null;

    return this.#countriesGeoJSON.features.find(f =>
      f.properties.ISO_A3 === countryId || f.properties.ADM0_A3 === countryId
    );
  }

  /**
   * Highlight countries for Country mode result
   * @param {Object} options - Highlighting options
   * @param {string} options.correctCountryId - ISO A3 code of correct country
   * @param {string|null} [options.clickedCountryId] - ISO A3 code of clicked country (null if ocean)
   */
  highlightCountries({ correctCountryId, clickedCountryId }) {
    if (!this.#countriesLayer) {
      logger.warn('Countries layer not loaded');
      return;
    }

    // Clear previous highlights
    this.clearCountryHighlights();

    const correctFeature = this.getCountryFeatureById(correctCountryId);
    if (!correctFeature) {
      logger.warn(`Correct country not found: ${correctCountryId}`);
      return;
    }

    const isSameCountry = clickedCountryId === correctCountryId;

    // Highlight correct country (green)
    const correctStyle = {
      fillColor: '#22c55e',
      fillOpacity: isSameCountry ? 0.45 : 0.35,
      color: '#16a34a',
      weight: 2,
      interactive: false
    };

    const correctHighlight = L.geoJSON(correctFeature, { style: () => correctStyle })
      .addTo(this.#map);
    this.#countryHighlights.push(correctHighlight);

    // Highlight clicked country if different (orange/red)
    if (clickedCountryId && !isSameCountry) {
      const clickedFeature = this.getCountryFeatureById(clickedCountryId);
      if (clickedFeature) {
        const clickedStyle = {
          fillColor: '#f97316',
          fillOpacity: 0.3,
          color: '#ea580c',
          weight: 2,
          interactive: false
        };

        const clickedHighlight = L.geoJSON(clickedFeature, { style: () => clickedStyle })
          .addTo(this.#map);
        this.#countryHighlights.push(clickedHighlight);
      }
    }

    eventBus.emit('map:countries-highlighted', { correctCountryId, clickedCountryId });
  }

  /**
   * Clear all country highlights
   */
  clearCountryHighlights() {
    this.#countryHighlights.forEach(layer => {
      if (this.#map) {
        this.#map.removeLayer(layer);
      }
    });
    this.#countryHighlights = [];
    eventBus.emit('map:country-highlights-cleared');
  }

  /**
   * Load civilizations GeoJSON layer for Civilization mode
   * @returns {Promise<boolean>} Success status
   */
  async loadCivilizationsGeoJSON() {
    if (this.#civilizationsLayer) {
      logger.warn('Civilizations layer already loaded');
      return true;
    }

    try {
      const response = await fetch('/data/civilizations.geojson');
      if (!response.ok) {
        throw new Error(`Failed to load civilizations.geojson: ${response.status}`);
      }

      this.#civilizationsGeoJSON = await response.json();
      if (!this.#map.getPane('civilizationsOverlay')) {
        const civPane = this.#map.createPane('civilizationsOverlay');
        civPane.style.zIndex = 450;
        civPane.style.pointerEvents = 'none';
      }
      this.#civilizationsLayer = L.geoJSON(this.#civilizationsGeoJSON, {
        style: () => ({
          fillColor: 'transparent',
          fillOpacity: 0,
          color: 'transparent',
          weight: 0,
          interactive: false,
          pane: 'civilizationsOverlay'
        })
      }).addTo(this.#map);

      logger.info('Civilizations GeoJSON loaded successfully');
      eventBus.emit('map:civilizations-loaded');
      return true;
    } catch (error) {
      logger.error('Failed to load civilizations GeoJSON:', error);
      eventBus.emit('map:civilizations-error', { error: error.message });
      return false;
    }
  }

  /**
   * Detect which civilization zone contains the given coordinates
   * @param {[number, number]} latlng - [lat, lng] coordinates
   * @returns {string|null} Civilization id or null if not in any zone
   */
  getCivilizationAtLatLng(latlng) {
    if (!this.#civilizationsGeoJSON) {
      logger.warn('Civilizations GeoJSON not loaded');
      return null;
    }

    const [lat, lng] = this.#map
      ? (() => {
          const wrapped = this.#map.wrapLatLng(L.latLng(latlng));
          return [wrapped.lat, wrapped.lng];
        })()
      : normalizeCoords(latlng);
    const point = { type: 'Point', coordinates: [lng, lat] };

    for (const feature of this.#civilizationsGeoJSON.features) {
      if (this.#pointInPolygon(point, feature.geometry)) {
        return feature.properties.id ?? feature.properties.name;
      }
    }

    return null;
  }

  /**
   * Get civilization feature by id
   * @param {string} civilizationId - Civilization id (matches properties.id)
   * @returns {Object|null} GeoJSON feature or null
   */
  getCivilizationFeatureById(civilizationId) {
    if (!this.#civilizationsGeoJSON) return null;

    return this.#civilizationsGeoJSON.features.find(f =>
      f.properties.id === civilizationId
    ) ?? null;
  }

  /**
   * Highlight civilizations for Civilization mode result
   * @param {Object} options - Highlighting options
   * @param {string} options.correctCivilizationId - Id of correct civilization
   * @param {string|null} [options.clickedCivilizationId] - Id of clicked civilization (null if ocean)
   */
  highlightCivilizations({ correctCivilizationId, clickedCivilizationId }) {
    if (!this.#civilizationsLayer) {
      logger.warn('Civilizations layer not loaded');
      return;
    }

    this.clearCivilizationHighlights();

    const correctFeature = this.getCivilizationFeatureById(correctCivilizationId);
    if (!correctFeature) {
      logger.warn(`Correct civilization not found: ${correctCivilizationId}`);
      return;
    }

    const isSame = clickedCivilizationId === correctCivilizationId;

    const correctStyle = {
      fillColor: '#22c55e',
      fillOpacity: isSame ? 0.45 : 0.35,
      color: '#16a34a',
      weight: 2,
      interactive: false
    };

    const correctHighlight = L.geoJSON(correctFeature, { style: () => correctStyle })
      .addTo(this.#map);
    this.#civilizationHighlights.push(correctHighlight);

    if (clickedCivilizationId && !isSame) {
      const clickedFeature = this.getCivilizationFeatureById(clickedCivilizationId);
      if (clickedFeature) {
        const clickedStyle = {
          fillColor: '#f97316',
          fillOpacity: 0.3,
          color: '#ea580c',
          weight: 2,
          interactive: false
        };

        const clickedHighlight = L.geoJSON(clickedFeature, { style: () => clickedStyle })
          .addTo(this.#map);
        this.#civilizationHighlights.push(clickedHighlight);
      }
    }

    eventBus.emit('map:civilizations-highlighted', { correctCivilizationId, clickedCivilizationId });
  }

  /**
   * Clear all civilization highlights
   */
  clearCivilizationHighlights() {
    this.#civilizationHighlights.forEach(layer => {
      if (this.#map) {
        this.#map.removeLayer(layer);
      }
    });
    this.#civilizationHighlights = [];
    eventBus.emit('map:civilization-highlights-cleared');
  }

  /**
   * Destroy the map system
   * Clean up all resources
   */
  destroy() {
    if (!this.#initialized) return;

    // Disable clicks
    this.disableClicks();

    // Annuler le timeout en cours s'il existe
    if (this.#clearCapitalsTimeout) {
      clearTimeout(this.#clearCapitalsTimeout);
      this.#clearCapitalsTimeout = null;
    }

    // Clear all layers
    this.clearMap();

    // Unsubscribe from events
    this.#eventUnsubscribers.forEach((unsub) => unsub());
    this.#eventUnsubscribers = [];

    // Remove tile layer
    if (this.#tileLayer) {
      this.#map.removeLayer(this.#tileLayer);
      this.#tileLayer = null;
    }

    // Remove capitals layer
    if (this.#capitalsLayer) {
      this.#map.removeLayer(this.#capitalsLayer);
      this.#capitalsLayer = null;
    }

    // Remove countries layer
    if (this.#countriesLayer) {
      this.#map.removeLayer(this.#countriesLayer);
      this.#countriesLayer = null;
    }
    this.#countriesGeoJSON = null;

    // Destroy Leaflet map
    if (this.#map) {
      this.#map.remove();
      this.#map = null;
    }

    this.#initialized = false;

    eventBus.emit('map:destroyed');
  }
}

// Singleton instance
let _mapSystemInstance = null;

/**
 * Get the singleton instance of MapSystem
 * @returns {MapSystem}
 */
export function getMapSystem() {
  if (!_mapSystemInstance) {
    _mapSystemInstance = new MapSystem();
  }
  return _mapSystemInstance;
}

// Export singleton instance
export const mapSystem = getMapSystem();
