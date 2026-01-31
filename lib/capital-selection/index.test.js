import { describe, it, expect, beforeEach } from 'vitest';
import {
  RandomSelector,
  SeededSelector,
  createSelector,
  selectCapitals
} from './index.js';

// Mock capitals data
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

describe('Capital Selection Strategies', () => {
  describe('RandomSelector', () => {
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
      const popularCount = result.filter(c => c.popular).length;
      const obscureCount = result.filter(c => !c.popular).length;
      expect(popularCount).toBe(2);
      expect(obscureCount).toBe(3);
    });

    it('should not select duplicates', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const result = selector.select(mockCapitals, config);
      const names = result.map(c => c.name);
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

      const selector1 = new SeededSelector(seed);
      const result1 = selector1.select(mockCapitals, config);

      const selector2 = new SeededSelector(seed);
      const result2 = selector2.select(mockCapitals, config);

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('should produce different results with different seeds', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };

      const selector1 = new SeededSelector(12345);
      const result1 = selector1.select(mockCapitals, config);

      const selector2 = new SeededSelector(54321);
      const result2 = selector2.select(mockCapitals, config);

      expect(JSON.stringify(result1)).not.toBe(JSON.stringify(result2));
    });

    it('should select correct number of capitals', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const selector = new SeededSelector(12345);
      const result = selector.select(mockCapitals, config);
      expect(result).toHaveLength(5);
    });

    it('should select correct balance of popular/obscure', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const selector = new SeededSelector(12345);
      const result = selector.select(mockCapitals, config);
      const popularCount = result.filter(c => c.popular).length;
      const obscureCount = result.filter(c => !c.popular).length;
      expect(popularCount).toBe(2);
      expect(obscureCount).toBe(3);
    });

    it('should not select duplicates', () => {
      const config = { count: 5, balancing: { popular: 2, obscure: 3 } };
      const selector = new SeededSelector(12345);
      const result = selector.select(mockCapitals, config);
      const names = result.map(c => c.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });
  });

  describe('createSelector', () => {
    it('should create RandomSelector for random type', () => {
      const config = { type: 'random' };
      const selector = createSelector(config);
      expect(selector).toBeInstanceOf(RandomSelector);
    });

    it('should create SeededSelector for seeded type', () => {
      const config = {
        type: 'seeded',
        seed: (date) => 20240115
      };
      const selector = createSelector(config);
      expect(selector).toBeInstanceOf(SeededSelector);
    });

    it('should throw error for invalid type', () => {
      const config = { type: 'invalid' };
      expect(() => createSelector(config)).toThrow('Unknown selection type: invalid');
    });

    it('should throw error for seeded type without seed function', () => {
      const config = { type: 'seeded' };
      expect(() => createSelector(config)).toThrow('Seeded selection requires a seed function');
    });

    it('should use provided date for seeded selection', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');

      const config = {
        type: 'seeded',
        seed: (date) => parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''), 10)
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
        capitalSelection: {
          type: 'random',
          count: 5,
          balancing: { popular: 2, obscure: 3 }
        }
      };

      const result = selectCapitals(modeConfig, mockCapitals);
      expect(result).toHaveLength(5);
    });

    it('should work with daily mode config', () => {
      const modeConfig = {
        capitalSelection: {
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: (date) => parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''), 10)
        }
      };

      const date = new Date('2024-01-15');
      const result = selectCapitals(modeConfig, mockCapitals, date);
      expect(result).toHaveLength(5);
    });

    it('should produce consistent results for daily mode with same date', () => {
      const modeConfig = {
        capitalSelection: {
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: (date) => parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''), 10)
        }
      };

      const date = new Date('2024-01-15');
      const result1 = selectCapitals(modeConfig, mockCapitals, date);
      const result2 = selectCapitals(modeConfig, mockCapitals, date);

      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it('should produce different results for daily mode with different dates', () => {
      const modeConfig = {
        capitalSelection: {
          type: 'seeded',
          count: 5,
          balancing: { popular: 2, obscure: 3 },
          seed: (date) => parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''), 10)
        }
      };

      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const result1 = selectCapitals(modeConfig, mockCapitals, date1);
      const result2 = selectCapitals(modeConfig, mockCapitals, date2);

      expect(JSON.stringify(result1)).not.toBe(JSON.stringify(result2));
    });
  });
});
