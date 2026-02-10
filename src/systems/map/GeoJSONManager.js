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

/** @typedef {{ geometry: any, properties: any }} GeoFeature */
/** @typedef {{ features: GeoFeature[] }} GeoFeatureCollection */
/** @typedef {{ coordinates: [number, number], type?: 'Point' }} GeoJSONPoint */

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
  /** @type {GeoFeatureCollection | null} */
  #civilizationsGeoJSON = null;
  /** @type {GeoFeatureCollection | null} */
  #civilizationsGeoJSONLow = null;
  /** @type {Promise<boolean> | null} */
  #civilizationsFullLoadPromise = null;
  /** @type {any[]} */
  #civilizationHighlights = [];

  /**
   * @param {{ L: typeof import('leaflet'), getMap: () => any }} deps
   */
  constructor({ L, getMap }) {
    this.#L = L;
    this.#getMap = getMap;
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

      logger.info('Countries GeoJSON (low-res) loaded successfully');
      eventBus.emit(EVENTS.MAP_COUNTRIES_LOADED, undefined);
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

    return (
      this.#countriesGeoJSON.features.find(
        (f) => f.properties.ISO_A3 === countryId || f.properties.ADM0_A3 === countryId
      ) ?? null
    );
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

    return (
      this.#civilizationsGeoJSON.features.find((f) => f.properties.id === civilizationId) ?? null
    );
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

    // No base layer to remove (we create only highlight layers).
    this.#countriesGeoJSON = null;
    this.#countriesGeoJSONLow = null;

    // No base layer to remove (we create only highlight layers).
    this.#civilizationsGeoJSON = null;
    this.#civilizationsGeoJSONLow = null;
  }
}
