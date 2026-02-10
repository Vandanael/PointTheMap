/**
 * Mode-specific rendering strategies.
 *
 * Each game category (capital, country, stadium, civilization) defines how
 * targets are displayed, how map results are visualised after a click or
 * timeout, and what geo-data needs to be pre-loaded. The controller
 * dispatches to these strategies instead of branching on game-type.
 */

import { MAP_ANIMATIONS } from '../config/visual-constants.js';

/**
 * @typedef {Object} ModeStrategy
 * @property {string} targetType
 * @property {(round: any) => any} getTarget
 * @property {(round: any) => boolean} hasRequiredData
 * @property {(target: any, i18n: any) => string} getDisplayName
 * @property {(target: any) => string} getDisplaySubtitle
 * @property {(MAP: any) => { center: [number,number], zoom: number }} getMapView
 * @property {(round: any) => number | null} getDisplayDistance
 * @property {(mapSystem: any, round: any, clickCoords: [number,number]) => Promise<void>|void} showClickResult
 * @property {(mapSystem: any, round: any) => void} showTimeoutReveal
 * @property {(mapSystem: any) => Promise<void>} loadGeoData
 */

/** @type {ModeStrategy} */
const capitalStrategy = {
  targetType: 'capital',
  getTarget: (round) => round.capital,
  hasRequiredData: (round) => Boolean(round.capital),
  getDisplayName: (target) => target.name,
  getDisplaySubtitle: (target) => (target && 'country' in target ? target.country : ''),
  getMapView: (MAP) => ({
    center: /** @type {[number,number]} */ (MAP.CENTER),
    zoom: MAP.ZOOM,
  }),
  getDisplayDistance: (round) => round.distance,
  showClickResult: async (mapSystem, round, clickCoords) => {
    const targetCoords = /** @type {[number,number]} */ ([round.capital.lat, round.capital.lng]);
    await mapSystem.showRoundResult(
      clickCoords,
      targetCoords,
      Number.isFinite(round.distance) ? round.distance : 0
    );
  },
  showTimeoutReveal: (mapSystem, round) => {
    if (round.capital) {
      mapSystem.addCapitalMarker(
        /** @type {[number,number]} */ ([round.capital.lat, round.capital.lng])
      );
    }
  },
  loadGeoData: async () => {},
};

/** @type {ModeStrategy} */
const countryStrategy = {
  targetType: 'country',
  getTarget: (round) => round.country,
  hasRequiredData: (round) => Boolean(round.country),
  getDisplayName: (target) => target.name,
  getDisplaySubtitle: () => '',
  getMapView: (MAP) => ({
    center: /** @type {[number,number]} */ (MAP.CENTER),
    zoom: MAP.ZOOM,
  }),
  getDisplayDistance: (round) =>
    Number.isFinite(round.distance)
      ? round.distance
      : Number.isFinite(round.distanceToTargetKm)
        ? round.distanceToTargetKm
        : null,
  showClickResult: (mapSystem, round, clickCoords) => {
    mapSystem.addClickMarker(clickCoords);
    const correctCountryId = round.correctCountryId ?? round.country.countryId;
    mapSystem.highlightCountries({
      correctCountryId,
      clickedCountryId: round.clickedCountryId,
    });
    const correctFeature = mapSystem.getCountryFeatureById(correctCountryId);
    if (
      !mapSystem.flyToFeatureBounds(correctFeature, {
        animation: { duration: 2.2, easeLinearity: 0.2 },
        includePoint: clickCoords,
      })
    ) {
      mapSystem.flyTo(clickCoords, undefined, MAP_ANIMATIONS.SHOW_RESULT);
    }
  },
  showTimeoutReveal: (mapSystem, round) => {
    if (!round.country) return;
    const correctCountryId = round.country.countryId;
    mapSystem.highlightCountries({ correctCountryId, clickedCountryId: null });
    const correctFeature = mapSystem.getCountryFeatureById(correctCountryId);
    mapSystem.flyToFeatureBounds(correctFeature, {
      animation: { duration: 2.2, easeLinearity: 0.2 },
    });
  },
  loadGeoData: async (mapSystem) => {
    await mapSystem.loadCountriesGeoJSON();
  },
};

/** @type {ModeStrategy} */
const stadiumStrategy = {
  targetType: 'stadium',
  getTarget: (round) => round.stadium,
  hasRequiredData: (round) => Boolean(round.stadium),
  getDisplayName: (target) => target.name,
  getDisplaySubtitle: () => '',
  getMapView: (MAP) => ({
    center: /** @type {[number,number]} */ (MAP.EUROPE_CENTER),
    zoom: MAP.EUROPE_ZOOM,
  }),
  getDisplayDistance: (round) => round.distance,
  showClickResult: async (mapSystem, round, clickCoords) => {
    const targetCoords = /** @type {[number,number]} */ ([round.stadium.lat, round.stadium.lng]);
    await mapSystem.showRoundResult(
      clickCoords,
      targetCoords,
      Number.isFinite(round.distance) ? round.distance : 0
    );
  },
  showTimeoutReveal: (mapSystem, round) => {
    if (round.stadium) {
      mapSystem.addCapitalMarker(
        /** @type {[number,number]} */ ([round.stadium.lat, round.stadium.lng])
      );
    }
  },
  loadGeoData: async () => {},
};

/** @type {ModeStrategy} */
const civilizationStrategy = {
  targetType: 'civilization',
  getTarget: (round) => round.civilization,
  hasRequiredData: (round) => Boolean(round.civilization),
  getDisplayName: (target, i18n) =>
    target.id ? i18n.getCivilizationName(target.id, target.name) : target.name,
  getDisplaySubtitle: () => '',
  getMapView: (MAP) => ({
    center: /** @type {[number,number]} */ (MAP.CENTER),
    zoom: MAP.ZOOM,
  }),
  getDisplayDistance: (round) =>
    Number.isFinite(round.distance)
      ? round.distance
      : Number.isFinite(round.distanceToTargetKm)
        ? round.distanceToTargetKm
        : null,
  showClickResult: (mapSystem, round, clickCoords) => {
    mapSystem.addClickMarker(clickCoords);
    const correctCivilizationId = round.correctCivilizationId ?? round.civilization.id;
    mapSystem.highlightCivilizations({
      correctCivilizationId,
      clickedCivilizationId: round.clickedCivilizationId,
    });
    const correctFeature = mapSystem.getCivilizationFeatureById(correctCivilizationId);
    if (
      !mapSystem.flyToFeatureBounds(correctFeature, {
        animation: { duration: 2.2, easeLinearity: 0.2 },
        includePoint: clickCoords,
      })
    ) {
      mapSystem.flyTo(clickCoords, undefined, MAP_ANIMATIONS.SHOW_RESULT);
    }
  },
  showTimeoutReveal: (mapSystem, round) => {
    if (!round.civilization) return;
    const correctCivilizationId = round.civilization.id;
    mapSystem.highlightCivilizations({ correctCivilizationId, clickedCivilizationId: null });
    const correctFeature = mapSystem.getCivilizationFeatureById(correctCivilizationId);
    mapSystem.flyToFeatureBounds(correctFeature, {
      animation: { duration: 2.2, easeLinearity: 0.2 },
    });
  },
  loadGeoData: async (mapSystem) => {
    await mapSystem.loadCivilizationsGeoJSON();
  },
};

/** @type {Record<string, ModeStrategy>} */
const strategyMap = {
  classic: capitalStrategy,
  daily: capitalStrategy,
  country: countryStrategy,
  country_daily: countryStrategy,
  stadium: stadiumStrategy,
  stadium_daily: stadiumStrategy,
  civilization: civilizationStrategy,
  civilization_daily: civilizationStrategy,
};

/**
 * Get the mode strategy for a game type.
 * @param {string} gameType
 * @returns {ModeStrategy}
 */
export function getModeStrategy(gameType) {
  return strategyMap[gameType] || capitalStrategy;
}
