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

import { eventBus } from '../core/EventBus.js';
import { logger } from '../utils/logger.js';
import { MapRenderer } from './map/MapRenderer.js';
import { GeoJSONManager } from './map/GeoJSONManager.js';
import { MAP_ANIMATIONS } from '../config/visual-constants.js';

export class MapSystem {
  #initialized = false;
  /** @type {string | null} */
  #containerId = null;
  /** @type {MapRenderer | null} */
  #renderer = null;
  /** @type {GeoJSONManager | null} */
  #geoManager = null;

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
      this.#renderer = new MapRenderer({ L: /** @type {typeof import('leaflet')} */ (L) });
      this.#renderer.init(containerId);
      this.#geoManager = new GeoJSONManager({
        L: /** @type {typeof import('leaflet')} */ (L),
        getMap: () => this.#renderer?.getMap(),
      });
      this.#initialized = true;

      eventBus.emit('map:ready', { containerId });
      return true;
    } catch (error) {
      const err = /** @type {Error} */ (error);
      eventBus.emit('map:error', { error: err.message });
      throw error;
    }
  }

  /**
   * Enable map clicks
   * @param {Function} callback - Callback function receiving [lat, lng]
   */
  enableClicks(callback) {
    if (!this.#renderer) {
      throw new Error('Map not initialized');
    }
    this.#renderer.enableClicks(callback);
  }

  /**
   * Disable map clicks
   */
  disableClicks() {
    this.#renderer?.disableClicks();
  }

  /**
   * Register a one-time tap/click handler to continue after the result line is shown.
   * Call clearOnResultContinue() when done (e.g. before showing the modal or on timeout).
   * @param {() => void} callback - Called when the user taps or clicks the map
   */
  setOnResultContinue(callback) {
    this.#renderer?.setOnResultContinue(callback);
  }

  /**
   * Remove the result-continue listener and callback (call after user continued or timeout).
   */
  clearOnResultContinue() {
    this.#renderer?.clearOnResultContinue();
  }

  /**
   * Add player click marker
   * @param {[number, number]} coords - [lat, lng]
   * @returns {Object | null} Leaflet marker instance
   */
  addClickMarker(coords) {
    return this.#renderer ? this.#renderer.addClickMarker(coords) : null;
  }

  /**
   * Add capital target marker
   * @param {[number, number]} coords - [lat, lng]
   * @returns {Object | null} Leaflet marker instance
   */
  addCapitalMarker(coords) {
    return this.#renderer ? this.#renderer.addCapitalMarker(coords) : null;
  }

  /**
   * Draw line between two points
   * @param {[number, number]} from - Start coordinates [lat, lng]
   * @param {[number, number]} to - End coordinates [lat, lng]
   * @param {number} distanceKm - Distance in kilometers
   * @returns {Object | null} Leaflet layer group
   */
  drawLine(from, to, distanceKm) {
    return this.#renderer ? this.#renderer.drawLine(from, to, distanceKm) : null;
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
    return this.#renderer?.showRoundResult(clickCoords, capitalCoords, distanceKm, options);
  }

  /**
   * Clear all markers and polylines from the map.
   * Also clears the result-continue listener if set (e.g. when navigating away during result view).
   */
  clearMap() {
    this.#geoManager?.clearCountryHighlights();
    this.#geoManager?.clearCivilizationHighlights();
    this.#renderer?.clearMap();
  }

  /**
   * Clear all capital markers from the map
   * This removes only the capital markers, keeping other markers and polylines intact
   */
  clearCapitals() {
    this.#renderer?.clearCapitals();
  }

  /**
   * Reset map view to default
   */
  resetView() {
    this.#renderer?.resetView();
  }

  /**
   * Fly to specific coordinates
   * @param {[number, number]} coords - Target coordinates [lat, lng]
   * @param {number} [zoom] - Target zoom level
   * @param {Object} [options] - Animation options
   */
  flyTo(coords, zoom = undefined, options = {}) {
    this.#renderer?.flyTo(coords, zoom, options);
  }

  /**
   * Get current map center
   * @returns {[number, number] | null} Center coordinates [lat, lng]
   */
  getCenter() {
    return this.#renderer?.getCenter() ?? null;
  }

  /**
   * Get current zoom level
   * @returns {number | null} Zoom level
   */
  getZoom() {
    return this.#renderer?.getZoom() ?? null;
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
    return this.#renderer?.getMarkerCount() ?? 0;
  }

  /**
   * Get polyline count
   * @returns {number}
   */
  getPolylineCount() {
    return this.#renderer?.getPolylineCount() ?? 0;
  }

  /**
   * Load countries GeoJSON layer for Country mode
   * Should be called once during game initialization if Country mode is available
   * @returns {Promise<boolean>} Success status
   */
  async loadCountriesGeoJSON() {
    return this.#geoManager?.loadCountriesGeoJSON() ?? false;
  }

  /**
   * Prefetch full-res GeoJSON for a mode after first interaction.
   * @param {string} gameType
   */
  prefetchFullGeoJSONForMode(gameType) {
    if (gameType === 'country' || gameType === 'country_daily') {
      void this.#geoManager?.ensureCountriesGeoJSONFull();
    }
    if (gameType === 'civilization' || gameType === 'civilization_daily') {
      void this.#geoManager?.ensureCivilizationsGeoJSONFull();
    }
  }

  /**
   * Ensure full-res GeoJSON is loaded for a mode before scoring.
   * @param {string} gameType
   * @returns {Promise<boolean>}
   */
  async ensureFullGeoJSONForMode(gameType) {
    if (gameType === 'country' || gameType === 'country_daily') {
      return (await this.#geoManager?.ensureCountriesGeoJSONFull()) ?? false;
    }
    if (gameType === 'civilization' || gameType === 'civilization_daily') {
      return (await this.#geoManager?.ensureCivilizationsGeoJSONFull()) ?? false;
    }
    return true;
  }

  /**
   * Detect which country contains the given coordinates
   * @param {[number, number]} latlng - [lat, lng] coordinates
   * @returns {string|null} Country ID (ISO A3) or null if not in any country
   */
  getCountryAtLatLng(latlng) {
    return this.#geoManager?.getCountryAtLatLng(latlng) ?? null;
  }

  /**
   * Get country feature by ID
   * @param {string} countryId - Country ID (ISO A3)
   * @returns {Object|null} GeoJSON feature or null
   */
  getCountryFeatureById(countryId) {
    return this.#geoManager?.getCountryFeatureById(countryId) ?? null;
  }

  /**
   * Highlight countries for Country mode result
   * @param {Object} options - Highlighting options
   * @param {string} options.correctCountryId - ISO A3 code of correct country
   * @param {string|null} [options.clickedCountryId] - ISO A3 code of clicked country (null if ocean)
   */
  highlightCountries({ correctCountryId, clickedCountryId }) {
    const clickedId = clickedCountryId ?? null;
    this.#geoManager?.highlightCountries({ correctCountryId, clickedCountryId: clickedId });
  }

  /**
   * Clear all country highlights
   */
  clearCountryHighlights() {
    this.#geoManager?.clearCountryHighlights();
  }

  /**
   * Load civilizations GeoJSON layer for Civilization mode
   * @returns {Promise<boolean>} Success status
   */
  async loadCivilizationsGeoJSON() {
    return this.#geoManager?.loadCivilizationsGeoJSON() ?? false;
  }

  /**
   * Detect which civilization zone contains the given coordinates
   * @param {[number, number]} latlng - [lat, lng] coordinates
   * @returns {string|null} Civilization id or null if not in any zone
   */
  getCivilizationAtLatLng(latlng) {
    return this.#geoManager?.getCivilizationAtLatLng(latlng) ?? null;
  }

  /**
   * Get civilization feature by id
   * @param {string} civilizationId - Civilization id (matches properties.id)
   * @returns {Object|null} GeoJSON feature or null
   */
  getCivilizationFeatureById(civilizationId) {
    return this.#geoManager?.getCivilizationFeatureById(civilizationId) ?? null;
  }

  /**
   * Fly to the bounds of a GeoJSON feature.
   * @param {Object} feature - GeoJSON feature with geometry
   * @param {{ padding?: [number, number], maxZoom?: number, animation?: { duration?: number, easeLinearity?: number }, includePoint?: [number, number] }} [options]
   * @returns {boolean} True if bounds were applied
   */
  flyToFeatureBounds(feature, options = {}) {
    if (!feature || !this.#renderer || !L) return false;
    const map = this.#renderer.getMap();
    if (!map) return false;

    const layer = L.geoJSON(feature);
    const bounds = layer.getBounds();
    if (!bounds || !bounds.isValid || !bounds.isValid()) return false;

    if (options.includePoint) {
      bounds.extend(options.includePoint);
    }

    map.flyToBounds(bounds, {
      ...MAP_ANIMATIONS.SHOW_RESULT,
      ...(options.animation ?? null),
      padding: options.padding ?? [60, 60],
      maxZoom: options.maxZoom ?? 14,
    });
    return true;
  }

  /**
   * Check if a coordinate is visible in current map view.
   * @param {[number, number]} latlng - [lat, lng]
   * @param {number} [padding=0.1] - Bounds padding (fraction of bounds)
   * @returns {boolean}
   */
  isInView(latlng, padding = 0.1) {
    return this.#renderer?.isInView(latlng, padding) ?? false;
  }

  /**
   * Highlight civilizations for Civilization mode result
   * @param {Object} options - Highlighting options
   * @param {string} options.correctCivilizationId - Id of correct civilization
   * @param {string|null} [options.clickedCivilizationId] - Id of clicked civilization (null if ocean)
   */
  highlightCivilizations({ correctCivilizationId, clickedCivilizationId }) {
    const clickedId = clickedCivilizationId ?? null;
    this.#geoManager?.highlightCivilizations({
      correctCivilizationId,
      clickedCivilizationId: clickedId,
    });
  }

  /**
   * Clear all civilization highlights
   */
  clearCivilizationHighlights() {
    this.#geoManager?.clearCivilizationHighlights();
  }

  /**
   * Destroy the map system
   * Clean up all resources
   */
  destroy() {
    if (!this.#initialized) return;

    this.#geoManager?.destroy();
    this.#geoManager = null;

    this.#renderer?.destroy();
    this.#renderer = null;

    this.#initialized = false;

    eventBus.emit('map:destroyed', undefined);
  }
}

// Singleton instance
/** @type {MapSystem | null} */
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
