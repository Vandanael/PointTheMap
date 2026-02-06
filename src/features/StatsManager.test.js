import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStats, updateStats, resetStats } from './StatsManager.js';
import { MODE_IDS } from '../config/game-modes.js';

vi.mock('../storage/StorageManager.js', () => {
  let store = {};
  return {
    storageManager: {
      get: vi.fn((key) => store[key] ?? null),
      set: vi.fn((key, value) => { store[key] = value; }),
      _reset: () => { store = {}; },
      _store: store,
    },
  };
});

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../core/EventBus.js', () => ({
  eventBus: { emit: vi.fn() },
}));

import { storageManager } from '../storage/StorageManager.js';
import { eventBus } from '../core/EventBus.js';

const makeRounds = (distances = [10, 20, 30], scores = [4000, 3000, 2000]) =>
  distances.map((d, i) => ({ distance: d, score: scores[i] }));

describe('StatsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageManager._reset();
  });

  describe('getStats', () => {
    it('should return defaults when no stats exist', () => {
      const stats = getStats();
      expect(stats.playCount).toBe(0);
      expect(stats.bestScoreClassic).toBe(0);
      expect(stats.bestScoreDaily).toBe(0);
      expect(stats.bestScoreCountry).toBe(0);
      expect(stats.bestScoreStadium).toBe(0);
      expect(stats.bestScoreCivilization).toBe(0);
      expect(stats.bestScoreCountryDaily).toBe(0);
      expect(stats.bestScoreStadiumDaily).toBe(0);
      expect(stats.bestScoreCivilizationDaily).toBe(0);
      expect(stats.streakDaily).toBe(0);
      expect(stats.streakCountryDaily).toBe(0);
      expect(stats.streakStadiumDaily).toBe(0);
      expect(stats.streakCivilizationDaily).toBe(0);
      expect(stats.lastCountryDailyDate).toBeNull();
      expect(stats.lastStadiumDailyDate).toBeNull();
      expect(stats.lastCivilizationDailyDate).toBeNull();
    });

    it('should return existing stats from storage', () => {
      storageManager.set('stats', { playCount: 5, bestScoreClassic: 20000 });
      const stats = getStats();
      expect(stats.playCount).toBe(5);
      expect(stats.bestScoreClassic).toBe(20000);
    });
  });

  describe('resetStats', () => {
    it('should reset stats to defaults', () => {
      storageManager.set('stats', { playCount: 10, bestScoreClassic: 25000 });
      const result = resetStats();
      expect(result).toBe(true);
      expect(eventBus.emit).toHaveBeenCalledWith('stats:reset', {});
    });
  });

  describe('updateStats — classic', () => {
    it('should update bestScoreClassic', () => {
      const rounds = makeRounds();
      const stats = updateStats(rounds, MODE_IDS.CLASSIC);
      expect(stats.bestScoreClassic).toBe(9000);
      expect(stats.playCount).toBe(1);
    });

    it('should keep higher bestScoreClassic', () => {
      updateStats(makeRounds([10, 20, 30], [5000, 5000, 5000]), MODE_IDS.CLASSIC);
      const stats = updateStats(makeRounds([10, 20, 30], [1000, 1000, 1000]), MODE_IDS.CLASSIC);
      expect(stats.bestScoreClassic).toBe(15000);
    });
  });

  describe('updateStats — daily', () => {
    it('should update bestScoreDaily', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.DAILY);
      expect(stats.bestScoreDaily).toBe(9000);
    });

    it('should start daily streak at 1', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.DAILY);
      expect(stats.streakDaily).toBe(1);
      expect(stats.lastDailyDate).toBeDefined();
    });
  });

  describe('updateStats — country', () => {
    it('should update bestScoreCountry', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.COUNTRY);
      expect(stats.bestScoreCountry).toBe(9000);
    });
  });

  describe('updateStats — stadium', () => {
    it('should update bestScoreStadium', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.STADIUM);
      expect(stats.bestScoreStadium).toBe(9000);
    });
  });

  describe('updateStats — civilization', () => {
    it('should update bestScoreCivilization', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.CIVILIZATION);
      expect(stats.bestScoreCivilization).toBe(9000);
    });
  });

  describe('updateStats — country_daily', () => {
    it('should update bestScoreCountryDaily', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.COUNTRY_DAILY);
      expect(stats.bestScoreCountryDaily).toBe(9000);
    });
  });

  describe('updateStats — stadium_daily', () => {
    it('should update bestScoreStadiumDaily', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.STADIUM_DAILY);
      expect(stats.bestScoreStadiumDaily).toBe(9000);
    });
  });

  describe('updateStats — civilization_daily', () => {
    it('should update bestScoreCivilizationDaily', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.CIVILIZATION_DAILY);
      expect(stats.bestScoreCivilizationDaily).toBe(9000);
    });
  });

  describe('updateStats — country_daily streak', () => {
    it('should start country daily streak at 1', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.COUNTRY_DAILY);
      expect(stats.streakCountryDaily).toBe(1);
      expect(stats.lastCountryDailyDate).toBeDefined();
    });

    it('should not increment streak on same day', () => {
      const stats1 = updateStats(makeRounds(), MODE_IDS.COUNTRY_DAILY);
      const stats2 = updateStats(makeRounds(), MODE_IDS.COUNTRY_DAILY);
      expect(stats2.streakCountryDaily).toBe(1);
    });
  });

  describe('updateStats — stadium_daily streak', () => {
    it('should start stadium daily streak at 1', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.STADIUM_DAILY);
      expect(stats.streakStadiumDaily).toBe(1);
      expect(stats.lastStadiumDailyDate).toBeDefined();
    });
  });

  describe('updateStats — civilization_daily streak', () => {
    it('should start civilization daily streak at 1', () => {
      const stats = updateStats(makeRounds(), MODE_IDS.CIVILIZATION_DAILY);
      expect(stats.streakCivilizationDaily).toBe(1);
      expect(stats.lastCivilizationDailyDate).toBeDefined();
    });
  });

  describe('per-category streaks are independent', () => {
    it('should track daily and country_daily streaks independently', () => {
      updateStats(makeRounds(), MODE_IDS.DAILY);
      const stats = updateStats(makeRounds(), MODE_IDS.COUNTRY_DAILY);
      expect(stats.streakDaily).toBe(1);
      expect(stats.streakCountryDaily).toBe(1);
      expect(stats.lastDailyDate).toBeDefined();
      expect(stats.lastCountryDailyDate).toBeDefined();
    });
  });

  describe('incremental average', () => {
    it('should compute running average distance', () => {
      updateStats(makeRounds([30, 30, 30], [1000, 1000, 1000]), MODE_IDS.CLASSIC);
      const stats = updateStats(makeRounds([10, 10, 10], [1000, 1000, 1000]), MODE_IDS.CLASSIC);
      // avg1 = 30, avg2 = 10 → running avg = 30 + (10-30)/2 = 20
      expect(stats.averageDistance).toBeCloseTo(20, 1);
    });
  });

  describe('updateStats emits event', () => {
    it('should emit stats:updated', () => {
      updateStats(makeRounds(), MODE_IDS.CLASSIC);
      expect(eventBus.emit).toHaveBeenCalledWith('stats:updated', expect.objectContaining({ stats: expect.any(Object) }));
    });
  });
});
