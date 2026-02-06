import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCountriesGeoJSON,
  getCivilizationsGeoJSON,
  clearGeoCache,
  getCacheStats,
} from './geoDataLoader.js';

describe('geoDataLoader', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await clearGeoCache();
    // Clear fetch mocks
    global.fetch = vi.fn();
  });

  describe('getCountriesGeoJSON', () => {
    it('should fetch countries GeoJSON from network on first call', async () => {
      const mockData = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { ISO_A3: 'FRA' }, geometry: {} }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
        clone: () => ({
          json: async () => mockData,
        }),
      });

      const result = await getCountriesGeoJSON();

      expect(fetch).toHaveBeenCalledWith('/data/countries.geojson');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it('should return cached data on second call without fetching', async () => {
      const mockData = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { ISO_A3: 'USA' } }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
        clone: () => ({
          json: async () => mockData,
        }),
      });

      // First call - should fetch
      const result1 = await getCountriesGeoJSON();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call - should use memory cache
      const result2 = await getCountriesGeoJSON();
      expect(fetch).toHaveBeenCalledTimes(1); // No additional fetch
      expect(result2).toEqual(result1);
      expect(result2).toBe(result1); // Same object reference
    });

    it('should throw error if fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(getCountriesGeoJSON()).rejects.toThrow(
        'Failed to load /data/countries.geojson: 404'
      );
    });

    it('should throw error if network error occurs', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(getCountriesGeoJSON()).rejects.toThrow('Network error');
    });
  });

  describe('getCivilizationsGeoJSON', () => {
    it('should fetch civilizations GeoJSON from network on first call', async () => {
      const mockData = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { id: 'roman-empire' }, geometry: {} }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
        clone: () => ({
          json: async () => mockData,
        }),
      });

      const result = await getCivilizationsGeoJSON();

      expect(fetch).toHaveBeenCalledWith('/data/civilizations.geojson');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it('should return cached data on second call', async () => {
      const mockData = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { id: 'mongol-empire' } }],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
        clone: () => ({
          json: async () => mockData,
        }),
      });

      // First call
      const result1 = await getCivilizationsGeoJSON();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call
      const result2 = await getCivilizationsGeoJSON();
      expect(fetch).toHaveBeenCalledTimes(1); // No additional fetch
      expect(result2).toBe(result1); // Same object reference
    });
  });

  describe('cache isolation', () => {
    it('should cache countries and civilizations separately', async () => {
      const countriesData = { type: 'FeatureCollection', features: ['country'] };
      const civilizationsData = { type: 'FeatureCollection', features: ['civ'] };

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => countriesData,
          clone: () => ({ json: async () => countriesData }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => civilizationsData,
          clone: () => ({ json: async () => civilizationsData }),
        });

      const countries = await getCountriesGeoJSON();
      const civilizations = await getCivilizationsGeoJSON();

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(countries).toEqual(countriesData);
      expect(civilizations).toEqual(civilizationsData);
      expect(countries).not.toBe(civilizations);
    });
  });

  describe('clearGeoCache', () => {
    it('should clear memory cache', async () => {
      const mockData = { type: 'FeatureCollection', features: [] };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
        clone: () => ({ json: async () => mockData }),
      });

      // Load data
      await getCountriesGeoJSON();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Verify cached
      await getCountriesGeoJSON();
      expect(fetch).toHaveBeenCalledTimes(1);

      // Clear cache
      await clearGeoCache();

      // Should fetch again
      await getCountriesGeoJSON();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const stats1 = getCacheStats();
      expect(stats1.memorySize).toBe(0);
      expect(typeof stats1.hasCacheStorage).toBe('boolean');

      const mockData = { type: 'FeatureCollection', features: [] };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
        clone: () => ({ json: async () => mockData }),
      });

      await getCountriesGeoJSON();

      const stats2 = getCacheStats();
      expect(stats2.memorySize).toBe(1);

      await getCivilizationsGeoJSON();

      const stats3 = getCacheStats();
      expect(stats3.memorySize).toBe(2);
    });
  });

  describe('data integrity', () => {
    it('should preserve GeoJSON structure', async () => {
      const mockData = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { ISO_A3: 'FRA', name: 'France' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [2.5, 49.0],
                  [2.6, 49.0],
                  [2.6, 49.1],
                ],
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
        clone: () => ({ json: async () => mockData }),
      });

      const result = await getCountriesGeoJSON();

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].properties.ISO_A3).toBe('FRA');
      expect(result.features[0].geometry.type).toBe('Polygon');
    });
  });
});
