import { describe, it, expect, vi } from 'vitest';
import { getModeStrategy } from './modeStrategies.js';

describe('modeStrategies', () => {
  const MAP = {
    CENTER: [20, 0],
    ZOOM: 2,
    EUROPE_CENTER: [50, 10],
    EUROPE_ZOOM: 4,
  };

  const mockMapSystem = {
    showRoundResult: vi.fn().mockResolvedValue(undefined),
    addClickMarker: vi.fn(),
    addCapitalMarker: vi.fn(),
    highlightCountries: vi.fn(),
    highlightCivilizations: vi.fn(),
    getCountryFeatureById: vi.fn(() => ({})),
    getCivilizationFeatureById: vi.fn(() => ({})),
    flyToFeatureBounds: vi.fn(() => true),
    flyTo: vi.fn(),
    loadCountriesGeoJSON: vi.fn().mockResolvedValue(undefined),
    loadCivilizationsGeoJSON: vi.fn().mockResolvedValue(undefined),
  };

  const mockI18n = {
    getCivilizationName: vi.fn((id, fallback) => `i18n:${id}`),
  };

  describe('getModeStrategy', () => {
    it('returns capital strategy for classic', () => {
      expect(getModeStrategy('classic').targetType).toBe('capital');
    });
    it('returns capital strategy for daily', () => {
      expect(getModeStrategy('daily').targetType).toBe('capital');
    });
    it('returns country strategy for country', () => {
      expect(getModeStrategy('country').targetType).toBe('country');
    });
    it('returns country strategy for country_daily', () => {
      expect(getModeStrategy('country_daily').targetType).toBe('country');
    });
    it('returns stadium strategy for stadium', () => {
      expect(getModeStrategy('stadium').targetType).toBe('stadium');
    });
    it('returns stadium strategy for stadium_daily', () => {
      expect(getModeStrategy('stadium_daily').targetType).toBe('stadium');
    });
    it('returns civilization strategy for civilization', () => {
      expect(getModeStrategy('civilization').targetType).toBe('civilization');
    });
    it('returns civilization strategy for civilization_daily', () => {
      expect(getModeStrategy('civilization_daily').targetType).toBe('civilization');
    });
    it('falls back to capital for unknown type', () => {
      expect(getModeStrategy('unknown').targetType).toBe('capital');
    });
  });

  describe('capital strategy', () => {
    const strategy = getModeStrategy('classic');
    const round = {
      capital: { name: 'Paris', country: 'France', lat: 48.85, lng: 2.35 },
      distance: 42,
    };

    it('getTarget returns capital', () => {
      expect(strategy.getTarget(round)).toBe(round.capital);
    });
    it('hasRequiredData with capital', () => {
      expect(strategy.hasRequiredData(round)).toBe(true);
      expect(strategy.hasRequiredData({})).toBe(false);
    });
    it('getDisplayName returns name', () => {
      expect(strategy.getDisplayName(round.capital, mockI18n)).toBe('Paris');
    });
    it('getDisplaySubtitle returns country', () => {
      expect(strategy.getDisplaySubtitle(round.capital)).toBe('France');
    });
    it('getMapView returns world view', () => {
      const view = strategy.getMapView(MAP);
      expect(view.center).toEqual([20, 0]);
      expect(view.zoom).toBe(2);
    });
    it('getDisplayDistance returns distance directly', () => {
      expect(strategy.getDisplayDistance(round)).toBe(42);
    });
    it('showClickResult calls showRoundResult', async () => {
      mockMapSystem.showRoundResult.mockClear();
      await strategy.showClickResult(mockMapSystem, round, [48.9, 2.4]);
      expect(mockMapSystem.showRoundResult).toHaveBeenCalledWith([48.9, 2.4], [48.85, 2.35], 42);
    });
    it('showTimeoutReveal adds capital marker', () => {
      mockMapSystem.addCapitalMarker.mockClear();
      strategy.showTimeoutReveal(mockMapSystem, round);
      expect(mockMapSystem.addCapitalMarker).toHaveBeenCalledWith([48.85, 2.35]);
    });
    it('loadGeoData is a no-op', async () => {
      await strategy.loadGeoData(mockMapSystem);
      // no calls expected
    });
  });

  describe('country strategy', () => {
    const strategy = getModeStrategy('country');
    const round = {
      country: { name: 'France', countryId: 'FRA' },
      correctCountryId: 'FRA',
      clickedCountryId: 'ESP',
      distance: 500,
      distanceToTargetKm: 600,
    };

    it('getTarget returns country', () => {
      expect(strategy.getTarget(round)).toBe(round.country);
    });
    it('hasRequiredData with country', () => {
      expect(strategy.hasRequiredData(round)).toBe(true);
      expect(strategy.hasRequiredData({})).toBe(false);
    });
    it('getDisplayName returns name', () => {
      expect(strategy.getDisplayName(round.country, mockI18n)).toBe('France');
    });
    it('getDisplaySubtitle returns empty', () => {
      expect(strategy.getDisplaySubtitle(round.country)).toBe('');
    });
    it('getMapView returns world view', () => {
      const view = strategy.getMapView(MAP);
      expect(view.center).toEqual([20, 0]);
    });
    it('getDisplayDistance prefers distance, falls back to distanceToTargetKm', () => {
      expect(strategy.getDisplayDistance(round)).toBe(500);
      expect(strategy.getDisplayDistance({ distance: null, distanceToTargetKm: 600 })).toBe(600);
      expect(strategy.getDisplayDistance({ distance: null, distanceToTargetKm: null })).toBe(null);
    });
    it('showClickResult highlights countries', () => {
      mockMapSystem.highlightCountries.mockClear();
      mockMapSystem.addClickMarker.mockClear();
      strategy.showClickResult(mockMapSystem, round, [40, -3]);
      expect(mockMapSystem.addClickMarker).toHaveBeenCalledWith([40, -3]);
      expect(mockMapSystem.highlightCountries).toHaveBeenCalledWith({
        correctCountryId: 'FRA',
        clickedCountryId: 'ESP',
      });
    });
    it('showTimeoutReveal highlights correct country', () => {
      mockMapSystem.highlightCountries.mockClear();
      strategy.showTimeoutReveal(mockMapSystem, round);
      expect(mockMapSystem.highlightCountries).toHaveBeenCalledWith({
        correctCountryId: 'FRA',
        clickedCountryId: null,
      });
    });
    it('loadGeoData loads countries GeoJSON', async () => {
      mockMapSystem.loadCountriesGeoJSON.mockClear();
      await strategy.loadGeoData(mockMapSystem);
      expect(mockMapSystem.loadCountriesGeoJSON).toHaveBeenCalled();
    });
  });

  describe('stadium strategy', () => {
    const strategy = getModeStrategy('stadium');
    const round = {
      stadium: { name: 'Wembley', city: 'London', country: 'UK', lat: 51.55, lng: -0.28 },
      distance: 15,
    };

    it('getTarget returns stadium', () => {
      expect(strategy.getTarget(round)).toBe(round.stadium);
    });
    it('hasRequiredData with stadium', () => {
      expect(strategy.hasRequiredData(round)).toBe(true);
      expect(strategy.hasRequiredData({})).toBe(false);
    });
    it('getDisplaySubtitle returns empty', () => {
      expect(strategy.getDisplaySubtitle(round.stadium)).toBe('');
    });
    it('getMapView returns Europe view', () => {
      const view = strategy.getMapView(MAP);
      expect(view.center).toEqual([50, 10]);
      expect(view.zoom).toBe(4);
    });
    it('getDisplayDistance returns distance directly', () => {
      expect(strategy.getDisplayDistance(round)).toBe(15);
    });
    it('showClickResult calls showRoundResult', async () => {
      mockMapSystem.showRoundResult.mockClear();
      await strategy.showClickResult(mockMapSystem, round, [51.5, -0.3]);
      expect(mockMapSystem.showRoundResult).toHaveBeenCalledWith([51.5, -0.3], [51.55, -0.28], 15);
    });
    it('showTimeoutReveal adds stadium marker', () => {
      mockMapSystem.addCapitalMarker.mockClear();
      strategy.showTimeoutReveal(mockMapSystem, round);
      expect(mockMapSystem.addCapitalMarker).toHaveBeenCalledWith([51.55, -0.28]);
    });
  });

  describe('civilization strategy', () => {
    const strategy = getModeStrategy('civilization');
    const round = {
      civilization: { id: 'roman_empire', name: 'Roman Empire' },
      correctCivilizationId: 'roman_empire',
      clickedCivilizationId: 'ancient_greece',
      distance: 300,
      distanceToTargetKm: 400,
    };

    it('getTarget returns civilization', () => {
      expect(strategy.getTarget(round)).toBe(round.civilization);
    });
    it('hasRequiredData with civilization', () => {
      expect(strategy.hasRequiredData(round)).toBe(true);
      expect(strategy.hasRequiredData({})).toBe(false);
    });
    it('getDisplayName uses i18n lookup', () => {
      expect(strategy.getDisplayName(round.civilization, mockI18n)).toBe('i18n:roman_empire');
      expect(mockI18n.getCivilizationName).toHaveBeenCalledWith('roman_empire', 'Roman Empire');
    });
    it('getDisplaySubtitle returns empty', () => {
      expect(strategy.getDisplaySubtitle(round.civilization)).toBe('');
    });
    it('getMapView returns world view', () => {
      const view = strategy.getMapView(MAP);
      expect(view.center).toEqual([20, 0]);
    });
    it('getDisplayDistance prefers distance, falls back to distanceToTargetKm', () => {
      expect(strategy.getDisplayDistance(round)).toBe(300);
      expect(strategy.getDisplayDistance({ distance: null, distanceToTargetKm: 400 })).toBe(400);
      expect(strategy.getDisplayDistance({ distance: null, distanceToTargetKm: null })).toBe(null);
    });
    it('showClickResult highlights civilizations', () => {
      mockMapSystem.highlightCivilizations.mockClear();
      mockMapSystem.addClickMarker.mockClear();
      strategy.showClickResult(mockMapSystem, round, [41, 12]);
      expect(mockMapSystem.addClickMarker).toHaveBeenCalledWith([41, 12]);
      expect(mockMapSystem.highlightCivilizations).toHaveBeenCalledWith({
        correctCivilizationId: 'roman_empire',
        clickedCivilizationId: 'ancient_greece',
      });
    });
    it('showTimeoutReveal highlights correct civilization', () => {
      mockMapSystem.highlightCivilizations.mockClear();
      strategy.showTimeoutReveal(mockMapSystem, round);
      expect(mockMapSystem.highlightCivilizations).toHaveBeenCalledWith({
        correctCivilizationId: 'roman_empire',
        clickedCivilizationId: null,
      });
    });
    it('loadGeoData loads civilizations GeoJSON', async () => {
      mockMapSystem.loadCivilizationsGeoJSON.mockClear();
      await strategy.loadGeoData(mockMapSystem);
      expect(mockMapSystem.loadCivilizationsGeoJSON).toHaveBeenCalled();
    });
  });
});
