/**
 * MapSystem - Wrapper around Leaflet map library
 *
 * Responsibilities:
 * - Abstract Leaflet-specific implementation
 * - Provide clean API for map operations
 * - Emit events via EventBus
 * - Testable without DOM
 */

import {
  map,
  tileLayer,
  marker,
  divIcon,
  polyline,
  layerGroup,
  latLngBounds,
} from 'leaflet';
import { MAP } from '../config.js';
import { getTheme } from '../services/storage.js';
import { isIOS } from '../utils.js';
import { eventBus } from '../core/EventBus.js';
import { logger } from '../utils/logger.js';
import {
  MARKERS,
  LINES,
  MAP_ANIMATIONS,
  getLineColor,
} from '../config/visual-constants.js';

export class MapSystem {
  #map = null;
  #tileLayer = null;
  #markers = [];
  #polylines = [];
  #clickHandler = null;
  #initialized = false;
  #containerId = null;
  #eventUnsubscribers = [];

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
    this.#map = map(containerId, {
      center: MAP.CENTER,
      zoom: MAP.ZOOM,
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

    this.#map.setView(MAP.CENTER, MAP.ZOOM, { animate: false });
    this.#map.doubleClickZoom.disable();

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

    this.#tileLayer = tileLayer(tileUrl, {
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

    // iOS: Add tap support for better responsiveness
    if (isIOS()) {
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

    // iOS: Disable tap events too
    if (isIOS()) {
      this.#map.off('tap', this.#clickHandler);
    }

    this.#clickHandler = null;
  }

  /**
   * Add player click marker
   * @param {[number, number]} coords - [lat, lng]
   * @returns {Object} Leaflet marker instance
   */
  addClickMarker(coords) {
    const markerInstance = marker(coords, {
      icon: divIcon({
        className: '',
        html: `<div class="marker-player"></div>`,
        iconSize: MARKERS.PLAYER.iconSize,
        iconAnchor: MARKERS.PLAYER.iconAnchor,
      }),
    }).addTo(this.#map);

    this.#markers.push(marker);
    return marker;
  }

  /**
   * Add capital target marker
   * @param {[number, number]} coords - [lat, lng]
   * @returns {Object} Leaflet marker instance
   */
  addCapitalMarker(coords) {
    const markerInstance = marker(coords, {
      icon: divIcon({
        className: '',
        html: `<div class="marker-target"></div>`,
        iconSize: MARKERS.CAPITAL.iconSize,
        iconAnchor: MARKERS.CAPITAL.iconAnchor,
      }),
    }).addTo(this.#map);

    this.#markers.push(markerInstance);
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
    const coords = [from, to];

    const outlineLine = polyline(coords, {
      ...LINES.OUTLINE,
    });

    const mainLine = polyline(coords, {
      ...LINES.MAIN,
      color: lineColor,
    });

    const lineGroup = layerGroup([outlineLine, mainLine]).addTo(this.#map);
    this.#polylines.push(lineGroup);
    return lineGroup;
  }

  /**
   * Show round result with markers, line, and animation
   * @param {[number, number]} clickCoords - Player click coordinates
   * @param {[number, number]} capitalCoords - Capital coordinates
   * @param {number} distanceKm - Distance in kilometers
   */
  showRoundResult(clickCoords, capitalCoords, distanceKm) {
    this.addClickMarker(clickCoords);
    this.addCapitalMarker(capitalCoords);
    this.drawLine(clickCoords, capitalCoords, distanceKm);

    // Créer les bounds contenant les deux points
    const bounds = latLngBounds([clickCoords, capitalCoords]);

    // Options pour fitBounds avec animation fluide
    const fitBoundsOptions = {
      ...MAP_ANIMATIONS.SHOW_RESULT,
      padding: [80, 80],  // Padding en pixels pour éviter que les marqueurs touchent les bords
      maxZoom: 10         // Limite supérieure pour éviter un zoom trop proche
    };

    // Animate to result
    this.#map.flyToBounds(bounds, fitBoundsOptions);

    // Emit event
    eventBus.emit('map:result-shown', {
      clickCoords,
      capitalCoords,
      distanceKm,
    });
  }

  /**
   * Clear all markers and polylines from the map
   */
  clearMap() {
    if (!this.#map) return;

    this.#markers.forEach((m) => this.#map.removeLayer(m));
    this.#polylines.forEach((p) => this.#map.removeLayer(p));
    this.#markers = [];
    this.#polylines = [];

    eventBus.emit('map:cleared');
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
   * Destroy the map system
   * Clean up all resources
   */
  destroy() {
    if (!this.#initialized) return;

    // Disable clicks
    this.disableClicks();

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
