/**
 * MapRenderer - Leaflet rendering and interaction layer
 *
 * Responsibilities:
 * - Create and manage Leaflet map instance
 * - Handle markers, lines, and result animations
 * - Manage map UI interactions (clicks, tiles, view)
 */

import { MAP } from '../../config/index.js';
import { getTheme, getMapView, setMapView } from '../../services/storage.js';
import { isIOS } from '../../utils/device.js';
import { eventBus } from '../../core/EventBus.js';
import { logger } from '../../utils/logger.js';
import {
  MARKERS,
  LINES,
  MAP_ANIMATIONS,
  MAP_VIEW,
  getLineColor,
} from '../../config/visual-constants.js';
import { waitForMapSettled, normalizeSegmentEnd, animateResultLine } from './lineAnimation.js';

export class MapRenderer {
  /** @type {typeof import('leaflet')} */
  #L;
  /** @type {any} */
  #map = null;
  /** @type {any} */
  #tileLayer = null;
  /** @type {any[]} */
  #markers = [];
  /** @type {any[]} */
  #polylines = [];
  /** @type {any} */
  #capitalsLayer = null;
  /** @type {any[]} */
  #capitalMarkers = [];
  /** @type {((e: any) => void) | null} */
  #clickHandler = null;
  /** @type {Array<() => void>} */
  #eventUnsubscribers = [];
  /** @type {ReturnType<typeof setTimeout> | null} */
  #clearCapitalsTimeout = null;
  /** @type {null | (() => void)} */
  #resultLineCancel = null;
  /** @type {any} */
  #resultLineLayerGroup = null;
  /** @type {null | (() => void)} */
  #resultContinueCallback = null;
  /** @type {null | ((e: Event) => void)} */
  #resultContinueHandler = null;
  #initialized = false;
  #tileErrorCount = 0;
  #usingFallbackTiles = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #tileLoadTimeout = null;

  /**
   * @param {{ L: typeof import('leaflet') }} deps
   */
  constructor({ L }) {
    this.#L = L;
  }

  /**
   * Initialize the map renderer
   * @param {string} containerId
   * @returns {void}
   */
  init(containerId) {
    if (this.#initialized) {
      logger.warn('MapRenderer already initialized');
      return;
    }

    this.#createMap(containerId);
    this.#setupTileLayer();
    this.#setupEventListeners();
    this.#initialized = true;
  }

  /**
   * Get the Leaflet map instance
   * @returns {any}
   */
  getMap() {
    return this.#map;
  }

  /**
   * Create Leaflet map instance
   * @param {string} containerId
   */
  #createMap(containerId) {
    const saved = getMapView();
    const initialCenter = saved?.center ?? MAP.CENTER;
    const initialZoom = saved?.zoom ?? MAP.ZOOM;

    this.#map = this.#L.map(containerId, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: MAP.MIN_ZOOM,
      maxZoom: MAP.MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
      keepBuffer: 4,
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    });

    this.#map.setView(initialCenter, initialZoom, { animate: false });
    this.#map.doubleClickZoom.disable();

    // Make map container focusable for programmatic focus
    const mapContainer = this.#map.getContainer();
    if (mapContainer && !mapContainer.hasAttribute('tabindex')) {
      mapContainer.setAttribute('tabindex', '-1');
    }

    // Dedicated layer group for capital markers
    this.#capitalsLayer = this.#L.layerGroup().addTo(this.#map);
  }

  /**
   * Setup tile layer with current theme
   */
  #setupTileLayer() {
    this.#updateMapTiles();
  }

  /**
   * Setup event listeners
   */
  #setupEventListeners() {
    // Subscribe to theme changes
    const unsubTheme = eventBus.subscribe('theme:changed', () => {
      this.#updateMapTiles();
    });
    this.#eventUnsubscribers.push(unsubTheme);

    const unsubTilesRetry = eventBus.subscribe('map:tiles-retry', () => {
      this.#updateMapTiles();
    });
    this.#eventUnsubscribers.push(unsubTilesRetry);

    // Persist map view on move/zoom (debounced)
    /** @type {ReturnType<typeof setTimeout> | null} */
    let saveTimeout = null;
    const saveView = () => {
      if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        const center = this.getCenter();
        const zoom = this.getZoom();
        if (center && zoom !== null) setMapView(center, zoom);
      }, MAP_VIEW.SAVE_VIEW_DEBOUNCE_MS);
    };
    this.#map.on('moveend', saveView);
    this.#eventUnsubscribers.push(() => {
      if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
      }
      this.#map?.off('moveend', saveView);
    });
  }

  /**
   * Update map tiles based on theme
   * @param {{ forceFallback?: boolean }} [options]
   */
  #updateMapTiles(options = {}) {
    if (!this.#map) return;

    if (this.#tileLoadTimeout) {
      clearTimeout(this.#tileLoadTimeout);
      this.#tileLoadTimeout = null;
    }

    if (this.#tileLayer) {
      this.#map.removeLayer(this.#tileLayer);
    }

    const useFallback = options.forceFallback || this.#usingFallbackTiles;

    let tileUrl;
    let attribution;
    if (useFallback) {
      tileUrl = MAP.TILE_URL_FALLBACK;
      attribution = MAP.TILE_FALLBACK_ATTRIBUTION;
      this.#usingFallbackTiles = true;
    } else {
      const theme = getTheme();
      tileUrl = theme === 'light' ? MAP.TILE_URL_LIGHT : MAP.TILE_URL_DARK;
      attribution = MAP.ATTRIBUTION;
    }

    this.#tileErrorCount = 0;

    this.#tileLayer = this.#L
      .tileLayer(tileUrl, {
        maxZoom: MAP.MAX_ZOOM,
        attribution,
        keepBuffer: 4,
        updateWhenZooming: true,
        updateWhenIdle: true,
        crossOrigin: false,
        minZoom: MAP.MIN_ZOOM,
      })
      .addTo(this.#map);

    // Start tile load timeout immediately (some browsers may not emit "loading")
    if (!this.#usingFallbackTiles) {
      if (this.#tileLoadTimeout) clearTimeout(this.#tileLoadTimeout);
      this.#tileLoadTimeout = setTimeout(() => {
        this.#switchToFallbackTiles();
      }, MAP.TILE_LOAD_TIMEOUT_MS);
    }

    this.#tileLayer.on('loading', () => {
      eventBus.emit('map:tiles-loading', {});
    });
    this.#tileLayer.on('load', () => {
      if (this.#tileLoadTimeout) {
        clearTimeout(this.#tileLoadTimeout);
        this.#tileLoadTimeout = null;
      }
      eventBus.emit('map:tiles-loaded', {});
    });
    this.#tileLayer.on('tileerror', (event) => {
      eventBus.emit('map:tiles-error', { error: event?.error });
      if (!this.#usingFallbackTiles) {
        this.#tileErrorCount++;
        if (this.#tileErrorCount >= MAP.TILE_ERROR_THRESHOLD) {
          this.#switchToFallbackTiles();
        }
      }
    });
  }

  /**
   * Switch to OSM fallback tiles when primary provider fails.
   */
  #switchToFallbackTiles() {
    if (this.#usingFallbackTiles) return;
    logger.warn('Primary tile provider failed — switching to OSM fallback');
    this.#usingFallbackTiles = true;
    this.#updateMapTiles({ forceFallback: true });
  }

  /**
   * Enable map clicks
   * @param {Function} callback - Callback function receiving [lat, lng]
   */
  enableClicks(callback) {
    if (!this.#map) {
      throw new Error('Map not initialized');
    }

    this.disableClicks();
    this.#map.invalidateSize({ animate: false });

    this.#clickHandler = (e) => {
      const coords = [e.latlng.lat, e.latlng.lng];
      eventBus.emit('map:click', { lat: e.latlng.lat, lng: e.latlng.lng });
      if (callback) {
        callback(coords);
      }
    };

    this.#map.on('click', this.#clickHandler);
    if (this.#L.Browser.mobile || isIOS()) {
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
    if (this.#L.Browser.mobile || isIOS()) {
      this.#map.off('tap', this.#clickHandler);
    }

    this.#clickHandler = null;
  }

  /**
   * Register a one-time tap/click handler to continue after the result line is shown.
   * @param {() => void} callback
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
    if (this.#L.Browser.mobile || isIOS()) {
      this.#map.once('tap', this.#resultContinueHandler);
    }
  }

  /**
   * Remove the result-continue listener and callback.
   */
  clearOnResultContinue() {
    if (!this.#map || !this.#resultContinueHandler) {
      this.#resultContinueCallback = null;
      this.#resultContinueHandler = null;
      return;
    }
    this.#map.off('click', this.#resultContinueHandler);
    if (this.#L.Browser.mobile || isIOS()) {
      this.#map.off('tap', this.#resultContinueHandler);
    }
    this.#resultContinueCallback = null;
    this.#resultContinueHandler = null;
  }

  /**
   * Add player click marker
   * @param {[number, number]} coords
   * @returns {Object}
   */
  addClickMarker(coords) {
    const markerInstance = this.#L
      .marker(coords, {
        icon: this.#L.divIcon({
          className: '',
          html: `<div class="marker-player marker-pop"><span class="marker-shockwave"></span></div>`,
          iconSize: MARKERS.PLAYER.iconSize,
          iconAnchor: MARKERS.PLAYER.iconAnchor,
        }),
      })
      .addTo(this.#map);

    this.#markers.push(markerInstance);
    return markerInstance;
  }

  /**
   * Add capital target marker
   * @param {[number, number]} coords
   * @returns {Object}
   */
  addCapitalMarker(coords) {
    if (!this.#capitalsLayer) {
      throw new Error('Map not initialized');
    }

    const markerInstance = this.#L
      .marker(coords, {
        icon: this.#L.divIcon({
          className: '',
          html: `<div class="marker-target"></div>`,
          iconSize: MARKERS.CAPITAL.iconSize,
          iconAnchor: MARKERS.CAPITAL.iconAnchor,
        }),
      })
      .addTo(this.#capitalsLayer);

    this.#markers.push(markerInstance);
    this.#capitalMarkers.push(markerInstance);
    return markerInstance;
  }

  /**
   * Draw line between two points
   * @param {[number, number]} from
   * @param {[number, number]} to
   * @param {number} distanceKm
   * @returns {Object}
   */
  drawLine(from, to, distanceKm) {
    const lineColor = getLineColor(distanceKm);
    const coords = [from, normalizeSegmentEnd(from, to)];

    const outlineLine = this.#L.polyline(coords, {
      ...LINES.OUTLINE,
    });

    const mainLine = this.#L.polyline(coords, {
      ...LINES.MAIN,
      color: lineColor,
    });

    const lineGroup = this.#L.layerGroup([outlineLine, mainLine]).addTo(this.#map);
    this.#polylines.push(lineGroup);
    return lineGroup;
  }

  /**
   * Show round result
   * @param {[number, number]} clickCoords
   * @param {[number, number]} capitalCoords
   * @param {number} distanceKm
   * @param {{ skipResultLine?: boolean }} [options]
   * @returns {Promise<void>}
   */
  async showRoundResult(clickCoords, capitalCoords, distanceKm, options = {}) {
    const skipResultLine = options.skipResultLine === true;

    if (this.#clearCapitalsTimeout) {
      clearTimeout(this.#clearCapitalsTimeout);
      this.#clearCapitalsTimeout = null;
    }

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
    const bounds = this.#L.latLngBounds([clickCoords, endNorm]);
    const fitBoundsOptions = {
      ...MAP_ANIMATIONS.SHOW_RESULT,
      padding: MAP_VIEW.RESULT_FIT_PADDING,
      maxZoom: MAP_VIEW.RESULT_FIT_MAX_ZOOM,
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
      this.#L,
      this.#map,
      clickCoords,
      capitalCoords,
      distanceKm
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
   * Check if a coordinate is visible in current map view.
   * @param {[number, number]} latlng - [lat, lng]
   * @param {number} [padding=0.1] - Bounds padding (fraction of bounds)
   * @returns {boolean}
   */
  isInView(latlng, padding = 0.1) {
    if (!this.#map) return false;
    const bounds = this.#map.getBounds();
    const padded = padding > 0 ? bounds.pad(-padding) : bounds;
    const point = this.#L.latLng(latlng);
    return padded.contains(point);
  }

  /**
   * Clear all markers and polylines from the map.
   */
  clearMap() {
    if (!this.#map) return;

    this.#resultLineCancel?.();
    this.#resultLineCancel = null;
    this.#resultLineLayerGroup = null;
    this.clearOnResultContinue();

    this.clearCapitals();

    this.#markers.forEach((m) => this.#map.removeLayer(m));
    this.#polylines.forEach((p) => this.#map.removeLayer(p));
    this.#markers = [];
    this.#polylines = [];

    eventBus.emit('map:cleared', undefined);
  }

  /**
   * Clear all capital markers from the map
   */
  clearCapitals() {
    if (!this.#capitalsLayer) return;

    if (this.#clearCapitalsTimeout) {
      clearTimeout(this.#clearCapitalsTimeout);
      this.#clearCapitalsTimeout = null;
    }

    this.#capitalsLayer.clearLayers();
    this.#markers = this.#markers.filter((m) => !this.#capitalMarkers.includes(m));
    this.#capitalMarkers = [];

    eventBus.emit('map:capitals-cleared', undefined);
  }

  /**
   * Reset map view to default
   */
  resetView() {
    if (!this.#map) return;
    this.#map.flyTo(MAP.CENTER, MAP.ZOOM, MAP_ANIMATIONS.RESET_VIEW);
    eventBus.emit('map:view-reset', undefined);
  }

  /**
   * Fly to specific coordinates
   * @param {[number, number]} coords
   * @param {number} [zoom=MAP.ZOOM]
   * @param {object} [options]
   */
  flyTo(coords, zoom = MAP.ZOOM, options = {}) {
    if (!this.#map) return;
    this.#map.flyTo(coords, zoom, options);
  }

  /**
   * Get current map center
   * @returns {[number, number] | null}
   */
  getCenter() {
    if (!this.#map) return null;
    const center = this.#map.getCenter();
    return [center.lat, center.lng];
  }

  /**
   * Get current zoom level
   * @returns {number | null}
   */
  getZoom() {
    if (!this.#map) return null;
    return this.#map.getZoom();
  }

  /**
   * Get marker count
   */
  getMarkerCount() {
    return this.#markers.length;
  }

  /**
   * Get polyline count
   */
  getPolylineCount() {
    return this.#polylines.length;
  }

  /**
   * Destroy the map renderer
   */
  destroy() {
    if (!this.#initialized) return;

    this.disableClicks();
    if (this.#clearCapitalsTimeout) {
      clearTimeout(this.#clearCapitalsTimeout);
      this.#clearCapitalsTimeout = null;
    }

    this.clearMap();

    this.#eventUnsubscribers.forEach((unsub) => unsub());
    this.#eventUnsubscribers = [];

    if (this.#map && this.#tileLayer) {
      this.#map.removeLayer(this.#tileLayer);
      this.#tileLayer = null;
    }

    if (this.#map && this.#capitalsLayer) {
      this.#map.removeLayer(this.#capitalsLayer);
      this.#capitalsLayer = null;
    }

    if (this.#map) {
      this.#map.remove();
      this.#map = null;
    }

    this.#initialized = false;
  }
}
