/**
 * GeoJSONManager - GeoJSON layers and spatial queries
 *
 * Responsibilities:
 * - Load and cache country/civilization GeoJSON layers
 * - Perform point-in-polygon lookups
 * - Highlight features for result views
 */

import { pointInPolygon } from '@lib/geo-utils/index.js';
import { getCountriesGeoJSON, getCivilizationsGeoJSON } from '../../data/geoDataLoader.js';
import { normalizeCoords } from '@lib/game-math/index.js';
import { eventBus } from '../../core/EventBus.js';
import { logger } from '../../utils/logger.js';

/** @typedef {{ geometry: any, properties: any }} GeoFeature */
/** @typedef {{ features: GeoFeature[] }} GeoFeatureCollection */

export class GeoJSONManager {
  /** @type {typeof import('leaflet')} */
  #L;
  /** @type {() => any} */
  #getMap;
  /** @type {any} */
  #countriesLayer = null;
  /** @type {GeoFeatureCollection | null} */
  #countriesGeoJSON = null;
  /** @type {any[]} */
  #countryHighlights = [];
  /** @type {any} */
  #civilizationsLayer = null;
  /** @type {GeoFeatureCollection | null} */
  #civilizationsGeoJSON = null;
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
    if (this.#countriesLayer) {
      logger.warn('Countries layer already loaded');
      return true;
    }

    const map = this.#getMap();
    if (!map) {
      logger.warn('Map not initialized');
      return false;
    }

    try {
      this.#countriesGeoJSON = await getCountriesGeoJSON();
      this.#countriesLayer = this.#L
        .geoJSON(this.#countriesGeoJSON, {
          style: () => ({
            fillColor: 'transparent',
            fillOpacity: 0,
            color: 'transparent',
            weight: 0,
            interactive: false,
          }),
        })
        .addTo(map);

      logger.info('Countries GeoJSON loaded successfully');
      eventBus.emit('map:countries-loaded', undefined);
      return true;
    } catch (error) {
      const err = /** @type {Error} */ (error);
      logger.error('Failed to load countries GeoJSON:', err);
      eventBus.emit('map:countries-error', { error: err.message });
      return false;
    }
  }

  /**
   * Detect which country contains the given coordinates
   * @param {[number, number]} latlng
   * @returns {string|null}
   */
  getCountryAtLatLng(latlng) {
    if (!this.#countriesGeoJSON) {
      logger.warn('Countries GeoJSON not loaded');
      return null;
    }

    const map = this.#getMap();
    const [lat, lng] = map
      ? (() => {
          const wrapped = map.wrapLatLng(this.#L.latLng(latlng));
          return [wrapped.lat, wrapped.lng];
        })()
      : normalizeCoords(latlng);
    /** @type {{ type: "Point", coordinates: [number, number] }} */
    const point = { type: 'Point', coordinates: [lng, lat] };

    for (const feature of this.#countriesGeoJSON.features) {
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
   * Highlight countries for Country mode result
   * @param {{ correctCountryId: string, clickedCountryId?: string | null }} options
   */
  highlightCountries({ correctCountryId, clickedCountryId }) {
    if (!this.#countriesLayer) {
      logger.warn('Countries layer not loaded');
      return;
    }

    const map = this.#getMap();
    if (!map) return;

    this.clearCountryHighlights();

    const correctFeature = this.getCountryFeatureById(correctCountryId);
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
      .geoJSON(correctFeature, { style: () => correctStyle })
      .addTo(map);
    this.#countryHighlights.push(correctHighlight);

    if (clickedCountryId && !isSameCountry) {
      const clickedFeature = this.getCountryFeatureById(clickedCountryId);
      if (clickedFeature) {
        const clickedStyle = {
          fillColor: '#f97316',
          fillOpacity: 0.3,
          color: '#ea580c',
          weight: 2,
          interactive: false,
        };

        const clickedHighlight = this.#L
          .geoJSON(clickedFeature, { style: () => clickedStyle })
          .addTo(map);
        this.#countryHighlights.push(clickedHighlight);
      }
    }

    eventBus.emit('map:countries-highlighted', { correctCountryId, clickedCountryId });
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
    eventBus.emit('map:country-highlights-cleared', undefined);
  }

  /**
   * Load civilizations GeoJSON layer for Civilization mode
   * @returns {Promise<boolean>}
   */
  async loadCivilizationsGeoJSON() {
    if (this.#civilizationsLayer) {
      logger.warn('Civilizations layer already loaded');
      return true;
    }

    const map = this.#getMap();
    if (!map) {
      logger.warn('Map not initialized');
      return false;
    }

    try {
      this.#civilizationsGeoJSON = await getCivilizationsGeoJSON();

      if (!map.getPane('civilizationsOverlay')) {
        const civPane = map.createPane('civilizationsOverlay');
        civPane.style.zIndex = 450;
        civPane.style.pointerEvents = 'none';
      }
      this.#civilizationsLayer = this.#L
        .geoJSON(this.#civilizationsGeoJSON, {
          style: () => ({
            fillColor: 'transparent',
            fillOpacity: 0,
            color: 'transparent',
            weight: 0,
            interactive: false,
            pane: 'civilizationsOverlay',
          }),
        })
        .addTo(map);

      logger.info('Civilizations GeoJSON loaded successfully');
      eventBus.emit('map:civilizations-loaded', undefined);
      return true;
    } catch (error) {
      const err = /** @type {Error} */ (error);
      logger.error('Failed to load civilizations GeoJSON:', err);
      eventBus.emit('map:civilizations-error', { error: err.message });
      return false;
    }
  }

  /**
   * Detect which civilization zone contains the given coordinates
   * @param {[number, number]} latlng
   * @returns {string|null}
   */
  getCivilizationAtLatLng(latlng) {
    if (!this.#civilizationsGeoJSON) {
      logger.warn('Civilizations GeoJSON not loaded');
      return null;
    }

    const map = this.#getMap();
    const [lat, lng] = map
      ? (() => {
          const wrapped = map.wrapLatLng(this.#L.latLng(latlng));
          return [wrapped.lat, wrapped.lng];
        })()
      : normalizeCoords(latlng);
    const point = { type: 'Point', coordinates: [lng, lat] };

    for (const feature of this.#civilizationsGeoJSON.features) {
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
   * Highlight civilizations for Civilization mode result
   * @param {{ correctCivilizationId: string, clickedCivilizationId?: string | null }} options
   */
  highlightCivilizations({ correctCivilizationId, clickedCivilizationId }) {
    if (!this.#civilizationsLayer) {
      logger.warn('Civilizations layer not loaded');
      return;
    }

    const map = this.#getMap();
    if (!map) return;

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
      interactive: false,
    };

    const correctHighlight = this.#L
      .geoJSON(correctFeature, { style: () => correctStyle })
      .addTo(map);
    this.#civilizationHighlights.push(correctHighlight);

    if (clickedCivilizationId && !isSame) {
      const clickedFeature = this.getCivilizationFeatureById(clickedCivilizationId);
      if (clickedFeature) {
        const clickedStyle = {
          fillColor: '#f97316',
          fillOpacity: 0.3,
          color: '#ea580c',
          weight: 2,
          interactive: false,
        };

        const clickedHighlight = this.#L
          .geoJSON(clickedFeature, { style: () => clickedStyle })
          .addTo(map);
        this.#civilizationHighlights.push(clickedHighlight);
      }
    }

    eventBus.emit('map:civilizations-highlighted', {
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
    eventBus.emit('map:civilization-highlights-cleared', undefined);
  }

  /**
   * Destroy geo layers and clear cached data
   */
  destroy() {
    const map = this.#getMap();

    this.clearCountryHighlights();
    this.clearCivilizationHighlights();

    if (map && this.#countriesLayer) {
      map.removeLayer(this.#countriesLayer);
      this.#countriesLayer = null;
    }
    this.#countriesGeoJSON = null;

    if (map && this.#civilizationsLayer) {
      map.removeLayer(this.#civilizationsLayer);
      this.#civilizationsLayer = null;
    }
    this.#civilizationsGeoJSON = null;
  }
}
