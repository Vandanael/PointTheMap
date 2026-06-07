/**
 * GeoJSONManager - GeoJSON layers and spatial queries
 *
 * Responsibilities:
 * - Load and cache country/civilization GeoJSON layers
 * - Perform point-in-polygon lookups
 * - Highlight features for result views
 */

import { pointInPolygon } from '@lib/geo-utils/index.js';
import {
  getCountriesGeoJSON,
  getCountriesGeoJSONLow,
  getCivilizationsGeoJSON,
  getCivilizationsGeoJSONLow,
} from '../../data/geoDataLoader.js';
import { normalizeCoords } from '@lib/game-math/index.js';
import { eventBus } from '../../core/EventBus.js';
import { EVENTS } from '../../core/eventTypes.js';
import { logger } from '../../utils/logger.js';
import { getTheme } from '../../services/storage.js';

/** @typedef {{ geometry: any, properties: any }} GeoFeature */
/** @typedef {{ features: GeoFeature[] }} GeoFeatureCollection */
/** @typedef {{ coordinates: [number, number], type?: 'Point' }} GeoJSONPoint */
/** @typedef {{ minLat: number, maxLat: number, minLng: number, maxLng: number }} BBox */
/** @typedef {{ bbox: BBox, feature: GeoFeature }} BBoxEntry */

/**
 * Compute per-ring bounding boxes for a feature geometry.
 * Handles Polygon and MultiPolygon. Splits anti-meridian-crossing rings into two boxes.
 * @param {GeoFeature} feature
 * @returns {BBoxEntry[]}
 */
function computeFeatureBBoxes(feature) {
  const rings = [];
  const { geometry } = feature;
  if (geometry.type === 'Polygon') {
    rings.push(geometry.coordinates[0]);
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      rings.push(poly[0]);
    }
  }

  /** @type {BBoxEntry[]} */
  const entries = [];
  for (const ring of rings) {
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    // Anti-meridian crossing: lng span > 180°
    if (maxLng - minLng > 180) {
      // Split into two boxes: [minLng, 180] and [-180, maxLng]
      entries.push({ bbox: { minLat, maxLat, minLng, maxLng: 180 }, feature });
      entries.push({ bbox: { minLat, maxLat, minLng: -180, maxLng }, feature });
    } else {
      entries.push({ bbox: { minLat, maxLat, minLng, maxLng }, feature });
    }
  }
  return entries;
}

export class GeoJSONManager {
  /** @type {typeof import('leaflet')} */
  #L;
  /** @type {() => any} */
  #getMap;
  /** @type {GeoFeatureCollection | null} */
  #countriesGeoJSON = null;
  /** @type {GeoFeatureCollection | null} */
  #countriesGeoJSONLow = null;
  /** @type {Promise<boolean> | null} */
  #countriesFullLoadPromise = null;
  /** @type {any[]} */
  #countryHighlights = [];
  /** @type {Map<string, GeoFeature>} */
  #countryIdIndex = new Map();
  /** @type {BBoxEntry[]} */
  #countryBBoxIndex = [];
  /** @type {GeoFeatureCollection | null} */
  #civilizationsGeoJSON = null;
  /** @type {GeoFeatureCollection | null} */
  #civilizationsGeoJSONLow = null;
  /** @type {Promise<boolean> | null} */
  #civilizationsFullLoadPromise = null;
  /** @type {any[]} */
  #civilizationHighlights = [];
  /** @type {Map<string, GeoFeature>} */
  #civilizationIdIndex = new Map();
  /** @type {BBoxEntry[]} */
  #civilizationBBoxIndex = [];
  /** @type {any} */
  #countriesOutlineLayer = null;
  /** @type {(() => void) | null} */
  #unsubTheme = null;

  /**
   * @param {{ L: typeof import('leaflet'), getMap: () => any }} deps
   */
  constructor({ L, getMap }) {
    this.#L = L;
    this.#getMap = getMap;
  }

  /**
   * Return the stroke style for the persistent country outline based on the current theme.
   * @returns {{ color: string, opacity: number, weight: number, fill: boolean, interactive: boolean }}
   */
  #outlineStyle() {
    const theme = getTheme();
    if (theme === 'light') {
      return { color: '#000000', opacity: 0.25, weight: 0.8, fill: false, interactive: false };
    }
    return { color: '#ffffff', opacity: 0.28, weight: 0.8, fill: false, interactive: false };
  }

  /**
   * Create or replace the persistent country outline layer using currently cached GeoJSON data.
   * Safe to call multiple times - removes the previous layer before adding the new one.
   */
  #applyCountriesOutline() {
    const source = this.#countriesGeoJSONLow ?? this.#countriesGeoJSON;
    if (!source) return;

    const map = this.#getMap();
    if (!map) return;

    if (!map.getPane('countriesOutline')) {
      const outlinePane = map.createPane('countriesOutline');
      outlinePane.style.zIndex = 450;
      outlinePane.style.pointerEvents = 'none';
    }

    if (this.#countriesOutlineLayer) {
      map.removeLayer(this.#countriesOutlineLayer);
      this.#countriesOutlineLayer = null;
    }

    const style = this.#outlineStyle();
    this.#countriesOutlineLayer = this.#L
      .geoJSON(source, { style: () => style, pane: 'countriesOutline', interactive: false })
      .addTo(map);
  }

  /**
   * Load countries GeoJSON layer for Country mode
   * @returns {Promise<boolean>}
   */
  async loadCountriesGeoJSON() {
    if (this.#countriesGeoJSON) {
      logger.warn('Countries GeoJSON already loaded');
      return true;
    }

    const map = this.#getMap();
    if (!map) {
      logger.warn('Map not initialized');
      return false;
    }

    try {
      if (!map.getPane('countriesHighlight')) {
        const highlightPane = map.createPane('countriesHighlight');
        highlightPane.style.zIndex = 460;
        highlightPane.style.pointerEvents = 'none';
      }
      // Load low-res first for faster highlight rendering (optional)
      this.#countriesGeoJSONLow = await getCountriesGeoJSONLow();

      this.#applyCountriesOutline();

      if (!this.#unsubTheme) {
        this.#unsubTheme = eventBus.subscribe(EVENTS.THEME_CHANGED, () => {
          this.#applyCountriesOutline();
        });
      }

      logger.info('Countries GeoJSON (low-res) loaded successfully');
      eventBus.emit(EVENTS.MAP_COUNTRIES_LOADED, undefined);

      // Eagerly kick off full-res in background so it's ready before first click
      this.ensureCountriesGeoJSONFull().catch(() => {
        // Will retry on first click — ignore error here
      });

      return true;
    } catch (error) {
      const err = /** @type {Error} */ (error);
      logger.error('Failed to load countries GeoJSON:', err);
      eventBus.emit(EVENTS.MAP_COUNTRIES_ERROR, { error: err.message });
      return false;
    }
  }

  /**
   * Ensure full-res countries GeoJSON is loaded (deferred until first interaction).
   * @returns {Promise<boolean>}
   */
  async ensureCountriesGeoJSONFull() {
    if (this.#countriesGeoJSON) return true;
    if (this.#countriesFullLoadPromise) return this.#countriesFullLoadPromise;

    this.#countriesFullLoadPromise = (async () => {
      try {
        this.#countriesGeoJSON = await getCountriesGeoJSON();

        // Build O(1) ID index
        this.#countryIdIndex.clear();
        for (const f of this.#countriesGeoJSON.features) {
          if (f.properties.ISO_A3) this.#countryIdIndex.set(f.properties.ISO_A3, f);
          if (f.properties.ADM0_A3) this.#countryIdIndex.set(f.properties.ADM0_A3, f);
        }

        // Build bbox index for pre-filtering point-in-polygon candidates
        this.#countryBBoxIndex = this.#countriesGeoJSON.features.flatMap((f) =>
          computeFeatureBBoxes(f)
        );

        logger.info('Countries GeoJSON (full-res) loaded successfully');
        eventBus.emit(EVENTS.MAP_COUNTRIES_FULL_LOADED, undefined);
        return true;
      } catch (error) {
        const err = /** @type {Error} */ (error);
        logger.error('Failed to load full-res countries GeoJSON:', err);
        eventBus.emit(EVENTS.MAP_COUNTRIES_ERROR, { error: err.message });
        return false;
      } finally {
        this.#countriesFullLoadPromise = null;
      }
    })();

    return this.#countriesFullLoadPromise;
  }

  /**
   * Detect which country contains the given coordinates
   * @param {[number, number]} latlng
   * @returns {string|null}
   */
  getCountryAtLatLng(latlng) {
    const source = this.#countriesGeoJSON ?? this.#countriesGeoJSONLow;
    if (!source) {
      logger.warn('Countries GeoJSON not loaded');
      return null;
    }
    if (!this.#countriesGeoJSON) {
      logger.warn('Countries GeoJSON full-res not loaded; using low-res fallback');
    }

    const map = this.#getMap();
    const [lat, lng] = map
      ? (() => {
          const wrapped = map.wrapLatLng(this.#L.latLng(latlng));
          return [wrapped.lat, wrapped.lng];
        })()
      : normalizeCoords(latlng);
    const point = /** @type {GeoJSONPoint} */ ({
      type: 'Point',
      coordinates: [Number(lng), Number(lat)],
    });

    // Use bbox index for fast candidate pre-filtering (only when full-res + index are ready)
    if (source === this.#countriesGeoJSON && this.#countryBBoxIndex.length > 0) {
      const candidates = new Set();
      for (const { bbox, feature } of this.#countryBBoxIndex) {
        if (lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng) {
          candidates.add(feature);
        }
      }
      for (const feature of candidates) {
        if (pointInPolygon(point, feature.geometry)) {
          return feature.properties.ISO_A3 || feature.properties.ADM0_A3;
        }
      }
      return null;
    }

    // Fallback: linear scan (low-res or index not yet built)
    for (const feature of source.features) {
      if (pointInPolygon(point, feature.geometry)) {
        return feature.properties.ISO_A3 || feature.properties.ADM0_A3;
      }
    }

    return null;
  }

  /**
   * Get country feature by ID
   * @param {string} countryId
   * @returns {Object|null}
   */
  getCountryFeatureById(countryId) {
    if (!this.#countriesGeoJSON) return null;
    return this.#countryIdIndex.get(countryId) ?? null;
  }

  /**
   * Get country feature for highlighting (prefer low-res).
   * @param {string} countryId
   * @returns {Object|null}
   */
  getCountryFeatureByIdForHighlight(countryId) {
    const source = this.#countriesGeoJSON ?? this.#countriesGeoJSONLow;
    if (!source) return null;
    return (
      source.features.find(
        (f) => f.properties.ISO_A3 === countryId || f.properties.ADM0_A3 === countryId
      ) ?? null
    );
  }

  /**
   * Highlight countries for Country mode result
   * @param {{ correctCountryId: string, clickedCountryId?: string | null }} options
   */
  highlightCountries({ correctCountryId, clickedCountryId }) {
    if (!this.#countriesGeoJSON && !this.#countriesGeoJSONLow) {
      logger.warn('Countries GeoJSON not loaded');
      return;
    }

    const map = this.#getMap();
    if (!map) return;

    this.clearCountryHighlights();

    const correctFeature = this.getCountryFeatureByIdForHighlight(correctCountryId);
    if (!correctFeature) {
      logger.warn(`Correct country not found: ${correctCountryId}`);
      return;
    }

    const isSameCountry = clickedCountryId === correctCountryId;

    const correctStyle = {
      fillColor: '#22c55e',
      fillOpacity: isSameCountry ? 0.45 : 0.35,
      color: '#16a34a',
      weight: 2,
      interactive: false,
    };

    const correctHighlight = this.#L
      .geoJSON(correctFeature, { style: () => correctStyle, pane: 'countriesHighlight' })
      .addTo(map);
    this.#countryHighlights.push(correctHighlight);

    if (clickedCountryId && !isSameCountry) {
      const clickedFeature = this.getCountryFeatureByIdForHighlight(clickedCountryId);
      if (clickedFeature) {
        const clickedStyle = {
          fillColor: '#f97316',
          fillOpacity: 0.3,
          color: '#ea580c',
          weight: 2,
          interactive: false,
        };

        const clickedHighlight = this.#L
          .geoJSON(clickedFeature, { style: () => clickedStyle, pane: 'countriesHighlight' })
          .addTo(map);
        this.#countryHighlights.push(clickedHighlight);
      }
    }

    eventBus.emit(EVENTS.MAP_COUNTRIES_HIGHLIGHTED, { correctCountryId, clickedCountryId });
  }

  /**
   * Clear all country highlights
   */
  clearCountryHighlights() {
    const map = this.#getMap();
    this.#countryHighlights.forEach((layer) => {
      if (map) {
        map.removeLayer(layer);
      }
    });
    this.#countryHighlights = [];
    eventBus.emit(EVENTS.MAP_COUNTRY_HIGHLIGHTS_CLEARED, undefined);
  }

  /**
   * Load civilizations GeoJSON layer for Civilization mode
   * @returns {Promise<boolean>}
   */
  async loadCivilizationsGeoJSON() {
    if (this.#civilizationsGeoJSON) {
      logger.warn('Civilizations GeoJSON already loaded');
      return true;
    }

    const map = this.#getMap();
    if (!map) {
      logger.warn('Map not initialized');
      return false;
    }

    try {
      this.#civilizationsGeoJSONLow = await getCivilizationsGeoJSONLow();

      if (!map.getPane('civilizationsHighlight')) {
        const highlightPane = map.createPane('civilizationsHighlight');
        highlightPane.style.zIndex = 650;
        highlightPane.style.pointerEvents = 'none';
      }

      logger.info('Civilizations GeoJSON (low-res) loaded successfully');
      eventBus.emit(EVENTS.MAP_CIVILIZATIONS_LOADED, undefined);

      // Eagerly kick off full-res in background so it's ready before first click
      this.ensureCivilizationsGeoJSONFull().catch(() => {
        // Will retry on first click — ignore error here
      });

      return true;
    } catch (error) {
      const err = /** @type {Error} */ (error);
      logger.error('Failed to load civilizations GeoJSON:', err);
      eventBus.emit(EVENTS.MAP_CIVILIZATIONS_ERROR, { error: err.message });
      return false;
    }
  }

  /**
   * Ensure full-res civilizations GeoJSON is loaded (deferred until first interaction).
   * @returns {Promise<boolean>}
   */
  async ensureCivilizationsGeoJSONFull() {
    if (this.#civilizationsGeoJSON) return true;
    if (this.#civilizationsFullLoadPromise) return this.#civilizationsFullLoadPromise;

    this.#civilizationsFullLoadPromise = (async () => {
      try {
        this.#civilizationsGeoJSON = await getCivilizationsGeoJSON();

        // Build O(1) ID index
        this.#civilizationIdIndex.clear();
        for (const f of this.#civilizationsGeoJSON.features) {
          if (f.properties.id) this.#civilizationIdIndex.set(f.properties.id, f);
          if (f.properties.name) this.#civilizationIdIndex.set(f.properties.name, f);
        }

        // Build bbox index for pre-filtering point-in-polygon candidates
        this.#civilizationBBoxIndex = this.#civilizationsGeoJSON.features.flatMap((f) =>
          computeFeatureBBoxes(f)
        );

        logger.info('Civilizations GeoJSON (full-res) loaded successfully');
        eventBus.emit(EVENTS.MAP_CIVILIZATIONS_FULL_LOADED, undefined);
        return true;
      } catch (error) {
        const err = /** @type {Error} */ (error);
        logger.error('Failed to load full-res civilizations GeoJSON:', err);
        eventBus.emit(EVENTS.MAP_CIVILIZATIONS_ERROR, { error: err.message });
        return false;
      } finally {
        this.#civilizationsFullLoadPromise = null;
      }
    })();

    return this.#civilizationsFullLoadPromise;
  }

  /**
   * Detect which civilization zone contains the given coordinates
   * @param {[number, number]} latlng
   * @returns {string|null}
   */
  getCivilizationAtLatLng(latlng) {
    const source = this.#civilizationsGeoJSON ?? this.#civilizationsGeoJSONLow;
    if (!source) {
      logger.warn('Civilizations GeoJSON not loaded');
      return null;
    }
    if (!this.#civilizationsGeoJSON) {
      logger.warn('Civilizations GeoJSON full-res not loaded; using low-res fallback');
    }

    const map = this.#getMap();
    const [lat, lng] = map
      ? (() => {
          const wrapped = map.wrapLatLng(this.#L.latLng(latlng));
          return [wrapped.lat, wrapped.lng];
        })()
      : normalizeCoords(latlng);
    const point = /** @type {GeoJSONPoint} */ ({
      type: 'Point',
      coordinates: [Number(lng), Number(lat)],
    });

    // Use bbox index for fast candidate pre-filtering (only when full-res + index are ready)
    if (source === this.#civilizationsGeoJSON && this.#civilizationBBoxIndex.length > 0) {
      const candidates = new Set();
      for (const { bbox, feature } of this.#civilizationBBoxIndex) {
        if (lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng) {
          candidates.add(feature);
        }
      }
      for (const feature of candidates) {
        if (pointInPolygon(point, feature.geometry)) {
          return feature.properties.id ?? feature.properties.name;
        }
      }
      return null;
    }

    // Fallback: linear scan (low-res or index not yet built)
    for (const feature of source.features) {
      if (pointInPolygon(point, feature.geometry)) {
        return feature.properties.id ?? feature.properties.name;
      }
    }

    return null;
  }

  /**
   * Get civilization feature by id
   * @param {string} civilizationId
   * @returns {Object|null}
   */
  getCivilizationFeatureById(civilizationId) {
    if (!this.#civilizationsGeoJSON) return null;
    return this.#civilizationIdIndex.get(civilizationId) ?? null;
  }

  /**
   * Get civilization feature for highlighting (prefer low-res).
   * @param {string} civilizationId
   * @returns {Object|null}
   */
  getCivilizationFeatureByIdForHighlight(civilizationId) {
    const source = this.#civilizationsGeoJSON ?? this.#civilizationsGeoJSONLow;
    if (!source) return null;
    return source.features.find((f) => f.properties.id === civilizationId) ?? null;
  }

  /**
   * Highlight civilizations for Civilization mode result
   * @param {{ correctCivilizationId: string, clickedCivilizationId?: string | null }} options
   */
  highlightCivilizations({ correctCivilizationId, clickedCivilizationId }) {
    if (!this.#civilizationsGeoJSON && !this.#civilizationsGeoJSONLow) {
      logger.warn('Civilizations GeoJSON not loaded');
      return;
    }

    const map = this.#getMap();
    if (!map) return;

    this.clearCivilizationHighlights();

    const correctFeature = this.getCivilizationFeatureByIdForHighlight(correctCivilizationId);
    if (!correctFeature) {
      logger.warn(`Correct civilization not found: ${correctCivilizationId}`);
      return;
    }

    const isSame = clickedCivilizationId === correctCivilizationId;

    const correctStyle = {
      fillColor: '#22c55e',
      fillOpacity: isSame ? 0.55 : 0.45,
      color: '#16a34a',
      weight: 3,
      opacity: 1,
      interactive: false,
    };

    const correctHighlight = this.#L
      .geoJSON(correctFeature, { style: () => correctStyle, pane: 'civilizationsHighlight' })
      .addTo(map);
    this.#civilizationHighlights.push(correctHighlight);

    // In Civilization mode, only show the correct answer highlight.

    eventBus.emit(EVENTS.MAP_CIVILIZATIONS_HIGHLIGHTED, {
      correctCivilizationId,
      clickedCivilizationId,
    });
  }

  /**
   * Clear all civilization highlights
   */
  clearCivilizationHighlights() {
    const map = this.#getMap();
    this.#civilizationHighlights.forEach((layer) => {
      if (map) {
        map.removeLayer(layer);
      }
    });
    this.#civilizationHighlights = [];
    eventBus.emit(EVENTS.MAP_CIVILIZATION_HIGHLIGHTS_CLEARED, undefined);
  }

  /**
   * Destroy geo layers and clear cached data
   */
  destroy() {
    this.clearCountryHighlights();
    this.clearCivilizationHighlights();

    this.#unsubTheme?.();
    this.#unsubTheme = null;

    const map = this.#getMap();
    if (this.#countriesOutlineLayer && map) {
      map.removeLayer(this.#countriesOutlineLayer);
    }
    this.#countriesOutlineLayer = null;

    this.#countriesGeoJSON = null;
    this.#countriesGeoJSONLow = null;
    this.#countryIdIndex.clear();
    this.#countryBBoxIndex = [];

    this.#civilizationsGeoJSON = null;
    this.#civilizationsGeoJSONLow = null;
    this.#civilizationIdIndex.clear();
    this.#civilizationBBoxIndex = [];
  }
}
