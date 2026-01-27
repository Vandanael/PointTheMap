import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock storage before importing modules that use i18n
vi.mock('../services/storage.js', () => ({
  storage: {
    get: vi.fn((key) => {
      if (key === 'lang') return 'en'; // Default to English for tests
      return null;
    }),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

import { ScoringSystem, getScoringSystem, scoringSystem } from './ScoringSystem.js';
import { eventBus } from '../core/EventBus.js';
import { GAME } from '../config.js';

describe('ScoringSystem', () => {
  let system;

  beforeEach(() => {
    system = new ScoringSystem();
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

    it('should emit score:calculated event when round completes', () => {
      system.init();

      const handler = vi.fn();
      eventBus.subscribe('score:calculated', handler);

      // Emit a round completed event
      eventBus.emit('game:round:completed', {
        round: {
          roundNumber: 0,
          capital: { name: 'Paris' },
          distance: 100,
          score: 3500,
        },
      });

      expect(handler).toHaveBeenCalledWith({
        round: 0,
        distance: 100,
        score: 3500,
        capital: 'Paris',
      });
    });

    it('should not emit score:calculated if round has no score', () => {
      system.init();

      const handler = vi.fn();
      eventBus.subscribe('score:calculated', handler);

      // Emit a round with null score (timeout)
      eventBus.emit('game:round:completed', {
        round: {
          roundNumber: 0,
          capital: { name: 'Paris' },
          distance: null,
          score: null,
        },
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('calculateScore', () => {
    it('should return 5000 for distance < 0.5km (perfect zone)', () => {
      expect(system.calculateScore(0)).toBe(5000);
      expect(system.calculateScore(0.5)).toBe(5000);
      expect(system.calculateScore(0.49)).toBe(5000);
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

    it('should return 0 or close to 0 for very large distances', () => {
      const score = system.calculateScore(20000);
      expect(score).toBeLessThan(10);
    });

    it('should return integer scores', () => {
      const score = system.calculateScore(123.456);
      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      // Paris to London
      const paris = [48.8566, 2.3522];
      const london = [51.5074, -0.1278];

      const distance = system.calculateDistance(paris, london);

      // Should be around 344km
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(400);
    });

    it('should return 0 for same coordinates', () => {
      const coords = [48.8566, 2.3522];
      const distance = system.calculateDistance(coords, coords);

      expect(distance).toBeLessThan(0.001);
    });

    it('should handle edge cases (antipodes)', () => {
      const point1 = [0, 0];
      const point2 = [0, 180];

      const distance = system.calculateDistance(point1, point2);

      // Half the Earth's circumference (roughly 20,000km)
      expect(distance).toBeGreaterThan(19000);
      expect(distance).toBeLessThan(21000);
    });
  });

  describe('calculateScoreWithTime', () => {
    it('should calculate score with time (currently no time bonus)', () => {
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
      const clickCoords = [48.8566, 2.3522]; // Paris
      const targetCoords = [48.8566, 2.3522]; // Same location

      const result = system.calculateClickScore(clickCoords, targetCoords, 5000);

      expect(result.score).toBe(5000); // Perfect score
      expect(result.distance).toBe(0);
    });

    it('should return 0 score if timed out', () => {
      const clickCoords = [48.8566, 2.3522];
      const targetCoords = [51.5074, -0.1278];

      const totalTime = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS;
      const result = system.calculateClickScore(
        clickCoords,
        targetCoords,
        totalTime + 1
      );

      expect(result.score).toBe(0);
      expect(result.distance).toBeNull();
    });

    it('should allow clicks within grace period', () => {
      const clickCoords = [48.8566, 2.3522];
      const targetCoords = [48.8566, 2.3522];

      const timeElapsed = GAME.TIMER_MS + GAME.GRACE_PERIOD_MS - 100;
      const result = system.calculateClickScore(clickCoords, targetCoords, timeElapsed);

      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('calculateTotalScore', () => {
    it('should sum all round scores', () => {
      const rounds = [
        { score: 5000 },
        { score: 3000 },
        { score: 2000 },
      ];

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
    it('should return "perfect" for distance < 1km', () => {
      expect(system.getScoreCategory(0)).toBe('perfect');
      expect(system.getScoreCategory(0.5)).toBe('perfect');
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
      expect(system.getCategoryLabel('invalid')).toBe('Unknown');
    });
  });

  describe('calculateTimeBonus', () => {
    it('should return 0 when feature flag is disabled', () => {
      const bonus = system.calculateTimeBonus(5000, 4000, 50);
      expect(bonus).toBe(0);
    });

    it('should return 0 for distances >= 200km even if enabled', () => {
      // Note: Feature flag is disabled, but testing the logic
      // In a real scenario, this would test with flag enabled
      const bonus = system.calculateTimeBonus(5000, 4000, 200);
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
    it('should unsubscribe from events', () => {
      system.init();

      const handler = vi.fn();
      eventBus.subscribe('score:calculated', handler);

      system.destroy();

      // Emit event after destroy
      eventBus.emit('game:round:completed', {
        round: {
          roundNumber: 0,
          capital: { name: 'Paris' },
          distance: 100,
          score: 3500,
        },
      });

      // Should not be called since system was destroyed
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow re-initialization after destroy', () => {
      system.init();
      system.destroy();
      expect(() => system.init()).not.toThrow();
    });
  });

  describe('Integration with EventBus', () => {
    it('should work with real game events', () => {
      system.init();

      const scoreHandler = vi.fn();
      eventBus.subscribe('score:calculated', scoreHandler);

      // Simulate a game round completion
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

      eventBus.emit('game:round:completed', roundData);

      expect(scoreHandler).toHaveBeenCalledWith({
        round: 2,
        distance: 15,
        score: 4800,
        capital: 'Tokyo',
      });
    });
  });
});
