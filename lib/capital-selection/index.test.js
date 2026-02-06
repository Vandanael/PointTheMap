import { describe, it, expect, beforeEach } from 'vitest';
import {
  RandomSelector,
  SeededSelector,
  createSelector,
  selectCapitals,
  selectCountries,
  selectStadiums,
  selectCivilizations,
} from './index.js';

/** @typedef {{ type: "random" | "seeded", count: number, balancing: { popular: number, obscure: number }, seed?: (date: Date) => number }} TestSelectionConfig */

// Mock capitals data
/** @type {Array<{ name: string, country: string, lat: number, lng: number, popular: boolean }>} */
const mockCapitals = [
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, popular: true },
  { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, popular: true },
  { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, popular: true },
  { name: 'Reykjavik', country: 'Iceland', lat: 64.1466, lng: -21.9426, popular: false },
  { name: 'Dublin', country: 'Ireland', lat: 53.3498, lng: -6.2603, popular: false },
  { name: 'Luxembourg', country: 'Luxembourg', lat: 49.6116, lng: 6.1319, popular: false },
  { name: 'Monaco', country: 'Monaco', lat: 43.7384, lng: 7.4246, popular: false },
  { name: 'Vaduz', country: 'Liechtenstein', lat: 47.141, lng: 9.5209, popular: false },
];

/** @param {Date} date */
const dailySeed = (date) => parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''), 10);

describe('Capital Selection Strategies', () => {
  describe('RandomSelector', () => {
    /** @type {RandomSelector<(typeof mockCapitals)[number]>} */
    let selector;

    beforeEach(() => {
      selector = new RandomSelector();
    });

    it('should select correct number of capitals', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const result = selector.select(mockCapitals, config);
      expect(result).toHaveLength(5);
    });

    it('should select correct balance of popular/obscure', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const result = selector.select(mockCapitals, config);
      const popularCount = result.filter((c) => c.popular).length;
      const obscureCount = result.filter((c) => !c.popular).length;
      expect(popularCount).toBe(2);
      expect(obscureCount).toBe(3);
    });

    it('should not select duplicates', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const result = selector.select(mockCapitals, config);
      const names = result.map((c) => c.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    it('should handle fallback when insufficient capitals', () => {
      const limitedCapitals = mockCapitals.slice(0, 3);
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const result = selector.select(limitedCapitals, config);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should produce different results on multiple calls (randomness)', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const results = [];
      let allSame = true;

      // Run 10 times
      for (let i = 0; i < 10; i++) {
        results.push(selector.select(mockCapitals, config));
      }

      // Check if all results are identical (unlikely with true randomness)
      for (let i = 1; i < results.length; i++) {
        if (JSON.stringify(results[0]) !== JSON.stringify(results[i])) {
          allSame = false;
          break;
        }
      }

      // With true randomness, very unlikely all 10 selections are identical
      expect(allSame).toBe(false);
    });
  });

  describe('SeededSelector', () => {
    it('should produce deterministic results with same seed', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const seed = 12345;

      /** @type {SeededSelector<(typeof mockCapitals)[number]>} */
      const selector1 = new SeededSelector(seed);
      const result1 = selector1.select(mockCapitals, config);

      /** @type {SeededSelector<(typeof mockCapitals)[number]>} */
      const selector2 = new SeededSelector(seed);
      const result2 = selector2.select(mockCapitals, config);

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('should produce different results with different seeds', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };

      /** @type {SeededSelector<(typeof mockCapitals)[number]>} */
      const selector1 = new SeededSelector(12345);
      const result1 = selector1.select(mockCapitals, config);

      /** @type {SeededSelector<(typeof mockCapitals)[number]>} */
      const selector2 = new SeededSelector(54321);
      const result2 = selector2.select(mockCapitals, config);

      expect(JSON.stringify(result1)).not.toBe(JSON.stringify(result2));
    });

    it('should select correct number of capitals', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      /** @type {SeededSelector<(typeof mockCapitals)[number]>} */
      const selector = new SeededSelector(12345);
      const result = selector.select(mockCapitals, config);
      expect(result).toHaveLength(5);
    });

    it('should select correct balance of popular/obscure', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      /** @type {SeededSelector<(typeof mockCapitals)[number]>} */
      const selector = new SeededSelector(12345);
      const result = selector.select(mockCapitals, config);
      const popularCount = result.filter((c) => c.popular).length;
      const obscureCount = result.filter((c) => !c.popular).length;
      expect(popularCount).toBe(2);
      expect(obscureCount).toBe(3);
    });

    it('should not select duplicates', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      /** @type {SeededSelector<(typeof mockCapitals)[number]>} */
      const selector = new SeededSelector(12345);
      const result = selector.select(mockCapitals, config);
      const names = result.map((c) => c.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });
  });

  describe('createSelector', () => {
    it('should create RandomSelector for random type', () => {
      /** @type {TestSelectionConfig} */
      const config = { type: 'random', count: 5, balancing: { popular: 2, obscure: 3 } };
      const selector = createSelector(config);
      expect(selector).toBeInstanceOf(RandomSelector);
    });

    it('should create SeededSelector for seeded type', () => {
      /** @type {(date: Date) => number} */
      const seed = (date) => 20240115;
      /** @type {TestSelectionConfig} */
      const config = {
        type: 'seeded',
        count: 5,
        balancing: { popular: 2, obscure: 3 },
        seed,
      };
      const selector = createSelector(config);
      expect(selector).toBeInstanceOf(SeededSelector);
    });

    it('should throw error for invalid type', () => {
      /** @type {TestSelectionConfig} */
      const config = {
        type: /** @type {any} */ ('invalid'),
        count: 5,
        balancing: { popular: 2, obscure: 3 },
      };
      expect(() => createSelector(config)).toThrow('Unknown selection type: invalid');
    });

    it('should throw error for seeded type without seed function', () => {
      /** @type {TestSelectionConfig} */
      const config = { type: 'seeded', count: 5, balancing: { popular: 2, obscure: 3 } };
      expect(() => createSelector(config)).toThrow('Seeded selection requires a seed function');
    });

    it('should use provided date for seeded selection', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');

      /** @type {(date: Date) => number} */
      const seed = (date) => parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''), 10);
      /** @type {TestSelectionConfig} */
      const config = {
        type: 'seeded',
        count: 5,
        balancing: { popular: 2, obscure: 3 },
        seed,
      };

      const selector1 = createSelector(config, date1);
      const selector2 = createSelector(config, date2);

      expect(selector1).toBeInstanceOf(SeededSelector);
      expect(selector2).toBeInstanceOf(SeededSelector);
    });
  });

  describe('selectCapitals', () => {
    it('should work with classic mode config', () => {
      const modeConfig = {
        capitalSelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };

      const result = selectCapitals(modeConfig, mockCapitals);
      expect(result).toHaveLength(5);
    });

    it('should work with daily mode config', () => {
      const modeConfig = {
        capitalSelection: /** @type {TestSelectionConfig} */ ({
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: dailySeed,
        }),
      };

      const date = new Date('2024-01-15');
      const result = selectCapitals(modeConfig, mockCapitals, date);
      expect(result).toHaveLength(5);
    });

    it('should produce consistent results for daily mode with same date', () => {
      const modeConfig = {
        capitalSelection: /** @type {TestSelectionConfig} */ ({
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: dailySeed,
        }),
      };

      const date = new Date('2024-01-15');
      const result1 = selectCapitals(modeConfig, mockCapitals, date);
      const result2 = selectCapitals(modeConfig, mockCapitals, date);

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('should produce different results for daily mode with different dates', () => {
      const modeConfig = {
        capitalSelection: /** @type {TestSelectionConfig} */ ({
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: dailySeed,
        }),
      };

      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const result1 = selectCapitals(modeConfig, mockCapitals, date1);
      const result2 = selectCapitals(modeConfig, mockCapitals, date2);

      expect(JSON.stringify(result1)).not.toBe(JSON.stringify(result2));
    });
  });

  describe('selectCountries', () => {
    /** @type {Array<{ name: string, countryId: string, popular: boolean }>} */
    const mockCountries = [
      { name: 'France', countryId: 'FRA', popular: true },
      { name: 'Germany', countryId: 'DEU', popular: true },
      { name: 'Brazil', countryId: 'BRA', popular: true },
      { name: 'Liechtenstein', countryId: 'LIE', popular: false },
      { name: 'Andorra', countryId: 'AND', popular: false },
      { name: 'Monaco', countryId: 'MCO', popular: false },
      { name: 'San Marino', countryId: 'SMR', popular: false },
      { name: 'Palau', countryId: 'PLW', popular: false },
    ];

    it('should select correct number of countries', () => {
      const modeConfig = {
        countrySelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectCountries(modeConfig, mockCountries);
      expect(result).toHaveLength(5);
    });

    it('should respect popular/obscure balancing', () => {
      const modeConfig = {
        countrySelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectCountries(modeConfig, mockCountries);
      expect(result.filter((c) => c.popular)).toHaveLength(2);
      expect(result.filter((c) => !c.popular)).toHaveLength(3);
    });

    it('should not select duplicates', () => {
      const modeConfig = {
        countrySelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectCountries(modeConfig, mockCountries);
      const ids = result.map((c) => c.countryId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should work with seeded mode (daily variant)', () => {
      const modeConfig = {
        countrySelection: /** @type {TestSelectionConfig} */ ({
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: dailySeed,
        }),
      };
      const date = new Date('2024-06-15');
      const r1 = selectCountries(modeConfig, mockCountries, date);
      const r2 = selectCountries(modeConfig, mockCountries, date);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });

  describe('selectStadiums', () => {
    /** @type {Array<{ name: string, stadiumId: string, lat: number, lng: number, popular: boolean }>} */
    const mockStadiums = [
      { name: 'Stade de France', stadiumId: 'sdf', lat: 48.92, lng: 2.36, popular: true },
      { name: 'Wembley', stadiumId: 'wem', lat: 51.56, lng: -0.28, popular: true },
      { name: 'Camp Nou', stadiumId: 'cam', lat: 41.38, lng: 2.12, popular: true },
      { name: 'Estadio Centenario', stadiumId: 'cen', lat: -34.89, lng: -56.15, popular: false },
      { name: 'Estadio Azteca', stadiumId: 'azt', lat: 19.3, lng: -99.15, popular: false },
      { name: 'Rajamangala', stadiumId: 'raj', lat: 13.75, lng: 100.62, popular: false },
      { name: 'FNB Stadium', stadiumId: 'fnb', lat: -26.24, lng: 27.98, popular: false },
      { name: 'King Fahd', stadiumId: 'kf', lat: 24.72, lng: 46.83, popular: false },
    ];

    it('should select correct number of stadiums', () => {
      const modeConfig = {
        stadiumSelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectStadiums(modeConfig, mockStadiums);
      expect(result).toHaveLength(5);
    });

    it('should respect popular/obscure balancing', () => {
      const modeConfig = {
        stadiumSelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectStadiums(modeConfig, mockStadiums);
      expect(result.filter((s) => s.popular)).toHaveLength(2);
      expect(result.filter((s) => !s.popular)).toHaveLength(3);
    });

    it('should not select duplicates', () => {
      const modeConfig = {
        stadiumSelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectStadiums(modeConfig, mockStadiums);
      const ids = result.map((s) => s.stadiumId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should work with seeded mode (daily variant)', () => {
      const modeConfig = {
        stadiumSelection: /** @type {TestSelectionConfig} */ ({
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: dailySeed,
        }),
      };
      const date = new Date('2024-06-15');
      const r1 = selectStadiums(modeConfig, mockStadiums, date);
      const r2 = selectStadiums(modeConfig, mockStadiums, date);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });

  describe('selectCivilizations', () => {
    /** @type {Array<{ name: string, civilizationId: string, popular: boolean }>} */
    const mockCivilizations = [
      { name: 'Roman Empire', civilizationId: 'roman', popular: true },
      { name: 'Ottoman Empire', civilizationId: 'ottoman', popular: true },
      { name: 'Mongol Empire', civilizationId: 'mongol', popular: true },
      { name: 'Khmer Empire', civilizationId: 'khmer', popular: false },
      { name: 'Mali Empire', civilizationId: 'mali', popular: false },
      { name: 'Songhai Empire', civilizationId: 'songhai', popular: false },
      { name: 'Majapahit', civilizationId: 'majapahit', popular: false },
      { name: 'Axum', civilizationId: 'axum', popular: false },
    ];

    it('should select correct number of civilizations', () => {
      const modeConfig = {
        civilizationSelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectCivilizations(modeConfig, mockCivilizations);
      expect(result).toHaveLength(5);
    });

    it('should respect popular/obscure balancing', () => {
      const modeConfig = {
        civilizationSelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectCivilizations(modeConfig, mockCivilizations);
      expect(result.filter((c) => c.popular)).toHaveLength(2);
      expect(result.filter((c) => !c.popular)).toHaveLength(3);
    });

    it('should not select duplicates', () => {
      const modeConfig = {
        civilizationSelection: /** @type {TestSelectionConfig} */ ({
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
        }),
      };
      const result = selectCivilizations(modeConfig, mockCivilizations);
      const ids = result.map((c) => c.civilizationId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should work with seeded mode (daily variant)', () => {
      const modeConfig = {
        civilizationSelection: /** @type {TestSelectionConfig} */ ({
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: dailySeed,
        }),
      };
      const date = new Date('2024-06-15');
      const r1 = selectCivilizations(modeConfig, mockCivilizations, date);
      const r2 = selectCivilizations(modeConfig, mockCivilizations, date);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });
});
