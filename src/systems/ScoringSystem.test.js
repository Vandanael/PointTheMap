import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ScoringSystem, getScoringSystem, scoringSystem } from './ScoringSystem.js';
import { getLang, toggleLang } from '../i18n.js';
import { eventBus } from '../core/EventBus.js';
import { GAME } from '@lib/config';

describe('ScoringSystem', () => {
  /** @type {ScoringSystem} */
  let system;

  beforeEach(() => {
    system = new ScoringSystem();
    // Ensure i18n defaults to English for label assertions
    try {
      localStorage.setItem('ptm_lang', JSON.stringify('en'));
    } catch {}
    if (getLang() !== 'en') {
      toggleLang();
    }
  });

  afterEach(() => {
    if (system) {
      system.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize without errors', () => {
      expect(() => system.init()).not.toThrow();
    });

    it('should be idempotent (safe to call init multiple times)', () => {
      system.init();
      system.init();
      system.init();
      // No errors should be thrown
      expect(true).toBe(true);
    });

    it('should handle game:round:completed with scored round without throwing', () => {
      system.init();

      expect(() =>
        eventBus.emit('game:round:completed', {
          round: {
            roundNumber: 0,
            capital: { name: 'Paris' },
            distance: 100,
            score: 3500,
          },
        })
      ).not.toThrow();
      // System still works after processing event
      expect(system.calculateScore(50)).toBe(4827);
    });

    it('should handle game:round:completed with null score (timeout) without throwing', () => {
      system.init();

      expect(() =>
        eventBus.emit('game:round:completed', {
          round: {
            roundNumber: 0,
            capital: { name: 'Paris' },
            distance: null,
            score: null,
          },
        })
      ).not.toThrow();
      expect(system.calculateScore(100)).toBe(4619);
    });
  });

  describe('calculateScore', () => {
    it('should return 5000 for distance < 0.1km (perfect zone)', () => {
      expect(system.calculateScore(0)).toBe(5000);
      expect(system.calculateScore(0.05)).toBe(5000);
      expect(system.calculateScore(0.09)).toBe(5000);
    });

    it('should apply smooth transition for 0.5-2km', () => {
      const score099 = system.calculateScore(0.99);
      const score1 = system.calculateScore(1);
      // Should be in transition (not max, but high)
      expect(score099).toBeLessThan(5000);
      expect(score099).toBeGreaterThan(4900);
      expect(score1).toBeLessThan(5000);
    });

    it('should return high scores for short distances', () => {
      const score50km = system.calculateScore(50);
      const score100km = system.calculateScore(100);

      expect(score50km).toBeGreaterThan(3000);
      expect(score100km).toBeGreaterThan(2000);
      expect(score50km).toBeGreaterThan(score100km);
    });

    it('should return decreasing scores for increasing distances', () => {
      const score100 = system.calculateScore(100);
      const score500 = system.calculateScore(500);
      const score1000 = system.calculateScore(1000);
      const score5000 = system.calculateScore(5000);

      expect(score100).toBeGreaterThan(score500);
      expect(score500).toBeGreaterThan(score1000);
      expect(score1000).toBeGreaterThan(score5000);
    });

    it('should return very low score for very large distances', () => {
      const score = system.calculateScore(20000);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThan(200); // Balanced formula is more forgiving
    });

    it('should return integer scores', () => {
      const score = system.calculateScore(123.456);
      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Paris to London
      /** @type {[number, number]} */
      const paris = [48.8566, 2.3522];
      /** @type {[number, number]} */
      const london = [51.5074, -0.1278];

      const distance = system.calculateDistance(paris, london);

      // Should be around 344km
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(400);
    });

    it('should return 0 for same coordinates', () => {
      /** @type {[number, number]} */
      const coords = [48.8566, 2.3522];
      const distance = system.calculateDistance(coords, coords);

      expect(distance).toBeLessThan(0.001);
    });

    it('should handle edge cases (antipodes)', () => {
      /** @type {[number, number]} */
      const point1 = [0, 0];
      /** @type {[number, number]} */
      const point2 = [0, 180];

      const distance = system.calculateDistance(point1, point2);

      // Half the Earth's circumference (roughly 20,000km)
      expect(distance).toBeGreaterThan(19000);
      expect(distance).toBeLessThan(21000);
    });
  });

  describe('calculateScoreWithTime', () => {
    it('should calculate score with time', () => {
      const result = system.calculateScoreWithTime(100, 5000);

      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('timeBonus');
      expect(result).toHaveProperty('totalScore');

      expect(result.distance).toBe(100);
      expect(result.score).toBeGreaterThan(0);
      expect(result.timeBonus).toBe(0); // No time bonus currently
      expect(result.totalScore).toBe(result.score);
    });

    it('should round distance to integer', () => {
      const result = system.calculateScoreWithTime(123.456, 5000);
      expect(Number.isInteger(result.distance)).toBe(true);
    });
  });

  describe('calculateClickScore', () => {
    beforeEach(() => {
      // Mock GAME config if needed
      vi.stubGlobal('GAME', {
        TIMER_MS: 30000,
        GRACE_PERIOD_MS: 500,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should calculate score for a valid click', () => {
      /** @type {[number, number]} */
      const clickCoords = [48.8566, 2.3522]; // Paris
      /** @type {[number, number]} */
      const targetCoords = [48.8566, 2.3522]; // Same location

      const result = system.calculateClickScore(clickCoords, targetCoords, 5000);

      expect(result.score).toBe(5000); // Perfect score
      expect(result.distance).toBe(0);
    });

    it('should return 0 score if timed out', () => {
      /** @type {[number, number]} */
      const clickCoords = [48.8566, 2.3522];
      /** @type {[number, number]} */
      const targetCoords = [51.5074, -0.1278];

      const totalTime = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
      const result = system.calculateClickScore(clickCoords, targetCoords, totalTime + 1);

      expect(result.score).toBe(0);
      expect(result.distance).toBeNull();
    });

    it('should allow clicks within grace period', () => {
      /** @type {[number, number]} */
      const clickCoords = [48.8566, 2.3522];
      /** @type {[number, number]} */
      const targetCoords = [48.8566, 2.3522];

      const timeElapsed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS - 100;
      const result = system.calculateClickScore(clickCoords, targetCoords, timeElapsed);

      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('calculateTotalScore', () => {
    it('should sum all round scores', () => {
      const rounds = [{ score: 5000 }, { score: 3000 }, { score: 2000 }];

      const total = system.calculateTotalScore(rounds);
      expect(total).toBe(10000);
    });

    it('should handle empty rounds', () => {
      const total = system.calculateTotalScore([]);
      expect(total).toBe(0);
    });

    it('should handle null scores (timeouts)', () => {
      const rounds = [
        { score: 5000 },
        { score: null }, // Timeout
        { score: 3000 },
      ];

      const total = system.calculateTotalScore(rounds);
      expect(total).toBe(8000);
    });

    it('should handle mixed valid and invalid scores', () => {
      const rounds = [
        { score: 1000 },
        { score: 0 },
        { score: null },
        { score: undefined },
        { score: 2000 },
      ];

      const total = system.calculateTotalScore(rounds);
      expect(total).toBe(3000);
    });
  });

  describe('getScoreCategory', () => {
    it('should return "perfect" for distance < 0.1km', () => {
      expect(system.getScoreCategory(0)).toBe('perfect');
      expect(system.getScoreCategory(0.05)).toBe('perfect');
      expect(system.getScoreCategory(0.09)).toBe('perfect');
    });

    it('should return "excellent" for distance < 50km', () => {
      expect(system.getScoreCategory(1)).toBe('excellent');
      expect(system.getScoreCategory(25)).toBe('excellent');
      expect(system.getScoreCategory(49)).toBe('excellent');
    });

    it('should return "good" for distance < 200km', () => {
      expect(system.getScoreCategory(50)).toBe('good');
      expect(system.getScoreCategory(100)).toBe('good');
      expect(system.getScoreCategory(199)).toBe('good');
    });

    it('should return "fair" for distance < 1000km', () => {
      expect(system.getScoreCategory(200)).toBe('fair');
      expect(system.getScoreCategory(500)).toBe('fair');
      expect(system.getScoreCategory(999)).toBe('fair');
    });

    it('should return "poor" for distance >= 1000km', () => {
      expect(system.getScoreCategory(1000)).toBe('poor');
      expect(system.getScoreCategory(5000)).toBe('poor');
      expect(system.getScoreCategory(20000)).toBe('poor');
    });
  });

  describe('getCategoryLabel', () => {
    it('should return correct labels for all categories', () => {
      expect(system.getCategoryLabel('perfect')).toBe('Perfect');
      expect(system.getCategoryLabel('excellent')).toBe('Excellent');
      expect(system.getCategoryLabel('good')).toBe('Good');
      expect(system.getCategoryLabel('fair')).toBe('Fair');
      expect(system.getCategoryLabel('poor')).toBe('Keep trying');
    });

    it('should return "Unknown" for invalid category', () => {
      expect(system.getCategoryLabel(/** @type {any} */ ('invalid'))).toBe('Unknown');
    });
  });

  describe('calculateTimeBonus', () => {
    it('should return 0 when feature flag is disabled', () => {
      const bonus = system.calculateTimeBonus(5000, 4000, 50, 'classic');
      expect(bonus).toBe(0);
    });

    it('should return 0 when answered after half time', () => {
      const bonus = system.calculateTimeBonus(5000, 6000, 2000, 'classic');
      expect(bonus).toBe(0);
    });

    it('should award max bonus for daily mode when fast', () => {
      const bonus = system.calculateTimeBonus(5000, 5000, 5000, 'daily');
      expect(bonus).toBe(1000);
    });

    it('should award max bonus for classic mode when fast', () => {
      const bonus = system.calculateTimeBonus(5000, 5000, 5000, 'classic');
      expect(bonus).toBe(1000);
    });

    it('should award bonus for country mode with same config', () => {
      const bonus = system.calculateTimeBonus(5000, 5000, 5000, 'country');
      expect(bonus).toBe(1000);
    });

    it('should return 0 for daily mode when answered after half time', () => {
      const bonus = system.calculateTimeBonus(5000, 6000, 2500, 'daily');
      expect(bonus).toBe(0);
    });
  });

  describe('getScorePercentage', () => {
    it('should return 100% for max score', () => {
      expect(system.getScorePercentage(5000)).toBe(100);
    });

    it('should return 0% for 0 score', () => {
      expect(system.getScorePercentage(0)).toBe(0);
    });

    it('should return 50% for half max score', () => {
      expect(system.getScorePercentage(2500)).toBe(50);
    });

    it('should return integer percentages', () => {
      const percentage = system.getScorePercentage(3333);
      expect(Number.isInteger(percentage)).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(system.getScorePercentage(1)).toBe(0); // Rounds to 0%
      expect(system.getScorePercentage(4999)).toBe(100); // Rounds to 100%
    });
  });

  describe('Country mode scoring', () => {
    describe('calculateCountryScore', () => {
      it('should return 5000 for inside country (distance 0)', () => {
        expect(system.calculateCountryScore(0)).toBe(5000);
      });

      it('should keep anchor values at 50km and 200km', () => {
        expect(system.calculateCountryScore(50)).toBe(4000);
        expect(system.calculateCountryScore(200)).toBe(3000);
      });

      it('should stay smooth around 50km and 200km boundaries', () => {
        const score49 = system.calculateCountryScore(49);
        const score50 = system.calculateCountryScore(50);
        const score51 = system.calculateCountryScore(51);
        const score199 = system.calculateCountryScore(199);
        const score200 = system.calculateCountryScore(200);
        const score201 = system.calculateCountryScore(201);
        expect(Math.abs(score49 - score50)).toBeLessThan(100);
        expect(Math.abs(score50 - score51)).toBeLessThan(100);
        expect(Math.abs(score199 - score200)).toBeLessThan(100);
        expect(Math.abs(score200 - score201)).toBeLessThan(100);
      });

      it('should return score in (0, 3000] for distance > 200 km (decay)', () => {
        const score = system.calculateCountryScore(500);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(3000);
        expect(Number.isFinite(score)).toBe(true);
      });

      it('should never return negative score', () => {
        expect(system.calculateCountryScore(5000)).toBeGreaterThanOrEqual(0);
        expect(system.calculateCountryScore(20000)).toBeGreaterThanOrEqual(0);
      });
    });

    describe('calculateCountryClickScore', () => {
      const minimalPolygonFeature = {
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      };
      const totalTimeAllowed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;

      it('should return totalScore above base score when click is inside country and not timed out', () => {
        const result = system.calculateCountryClickScore(
          /** @type {[number, number]} */ ([0.5, 0.5]),
          minimalPolygonFeature,
          true,
          1000,
          'country',
          totalTimeAllowed
        );
        expect(result.totalScore).toBeGreaterThan(5000);
        expect(result.score).toBe(5000);
        expect(result.distanceToCountry).toBe(0);
      });

      it('should award time bonus in country daily mode for a fast accurate click', () => {
        const result = system.calculateCountryClickScore(
          /** @type {[number, number]} */ ([0.5, 0.5]),
          minimalPolygonFeature,
          true,
          1000,
          'country_daily',
          totalTimeAllowed
        );
        expect(result.totalScore).toBeGreaterThan(5000);
        expect(result.score).toBe(5000);
      });

      it('should return totalScore 0 when timed out', () => {
        const result = system.calculateCountryClickScore(
          /** @type {[number, number]} */ ([0.5, 0.5]),
          minimalPolygonFeature,
          true,
          totalTimeAllowed + 1,
          'country',
          totalTimeAllowed
        );
        expect(result.totalScore).toBe(0);
        expect(result.score).toBe(0);
        expect(result.distance).toBeNull();
        expect(result.distanceToCountry).toBeNull();
      });

      it('should return finite non-negative score for boundary distances (range-based)', () => {
        /** @type {[number, number]} */
        const clickCoords = [48, 2];
        const resultInside = system.calculateCountryClickScore(
          clickCoords,
          minimalPolygonFeature,
          false,
          1000,
          'country',
          totalTimeAllowed
        );
        expect(resultInside.totalScore).toBeGreaterThanOrEqual(0);
        expect(resultInside.totalScore).toBeLessThanOrEqual(5000);
        expect(Number.isFinite(resultInside.totalScore)).toBe(true);
      });
    });
  });

  describe('Singleton pattern', () => {
    it('should return same instance with getScoringSystem', () => {
      const instance1 = getScoringSystem();
      const instance2 = getScoringSystem();

      expect(instance1).toBe(instance2);
    });

    it('should export pre-initialized singleton', () => {
      expect(scoringSystem).toBeInstanceOf(ScoringSystem);
    });

    it('should share state across singleton instances', () => {
      const sys1 = getScoringSystem();
      const sys2 = getScoringSystem();

      sys1.init();

      // Both should be initialized
      expect(() => sys2.destroy()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should not throw when game:round:completed is emitted after destroy', () => {
      system.init();
      system.destroy();

      expect(() =>
        eventBus.emit('game:round:completed', {
          round: {
            roundNumber: 0,
            capital: { name: 'Paris' },
            distance: 100,
            score: 3500,
          },
        })
      ).not.toThrow();
    });

    it('should allow re-initialization after destroy', () => {
      system.init();
      system.destroy();
      expect(() => system.init()).not.toThrow();
    });
  });

  describe('Integration with EventBus', () => {
    it('should process game:round:completed without throwing and keep scoring correct', () => {
      system.init();

      const roundData = {
        round: {
          roundNumber: 2,
          capital: { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
          startTime: Date.now() - 10000,
          endTime: Date.now(),
          click: { lat: 35.6, lng: 139.7 },
          distance: 15,
          score: 4800,
          status: 'completed',
        },
      };

      expect(() => eventBus.emit('game:round:completed', roundData)).not.toThrow();
      expect(system.calculateScore(0)).toBe(5000);
    });
  });
});
