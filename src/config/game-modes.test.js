import { describe, it, expect } from 'vitest';
import {
  getGameMode,
  getRuntimeGameConfig,
  isValidMode,
  getAllModes,
  getModeIds,
  GAME_MODES,
  MODE_IDS,
  isDailyVariant,
  isCapitalCategory,
  isStadiumCategory,
  isCountryCategory,
  isCivilizationCategory,
} from './game-modes.js';
import { GAME } from '@lib/config';

describe('Game Modes Configuration', () => {
  describe('isValidMode', () => {
    it('should return true for classic mode', () => {
      expect(isValidMode('classic')).toBe(true);
    });

    it('should return true for daily mode', () => {
      expect(isValidMode('daily')).toBe(true);
    });

    it('should return true for civilization mode', () => {
      expect(isValidMode('civilization')).toBe(true);
    });

    it('should return true for stadium mode', () => {
      expect(isValidMode('stadium')).toBe(true);
    });

    it('should return true for country_daily mode', () => {
      expect(isValidMode('country_daily')).toBe(true);
    });

    it('should return true for stadium_daily mode', () => {
      expect(isValidMode('stadium_daily')).toBe(true);
    });

    it('should return true for civilization_daily mode', () => {
      expect(isValidMode('civilization_daily')).toBe(true);
    });

    it('should return false for invalid mode', () => {
      expect(isValidMode('invalid')).toBe(false);
      expect(isValidMode('')).toBe(false);
    });
  });

  describe('getGameMode', () => {
    it('should return classic mode configuration', () => {
      const mode = getGameMode('classic');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('classic');
      expect(mode.name).toBe('Classic Mode');
      expect(mode.capitalSelection.type).toBe('random');
      expect(mode.scoring.timeBonus.enabled).toBe(false);
    });

    it('should return daily mode configuration', () => {
      const mode = getGameMode('daily');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('daily');
      expect(mode.name).toBe('Daily Challenge');
      expect(mode.capitalSelection.type).toBe('seeded');
      expect(mode.scoring.timeBonus.enabled).toBe(true);
    });

    it('should return stadium mode configuration', () => {
      const mode = getGameMode('stadium');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('stadium');
      expect(mode.name).toBe('Stadium Mode');
      expect(mode.stadiumSelection.type).toBe('random');
      expect(mode.scoring.timeBonus.enabled).toBe(false);
    });

    it('should return country_daily mode configuration', () => {
      const mode = getGameMode('country_daily');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('country_daily');
      expect(mode.countrySelection.type).toBe('seeded');
      expect(mode.scoring.timeBonus.enabled).toBe(true);
    });

    it('should throw error for invalid mode', () => {
      expect(() => getGameMode('invalid')).toThrow('Unknown game mode: invalid');
    });
  });

  describe('getRuntimeGameConfig', () => {
    it('should return runtime config for classic mode', () => {
      const config = getRuntimeGameConfig('classic');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(500);
      expect(config.dangerZoneMs).toBe(1500);
    });

    it('should return runtime config for daily mode', () => {
      const config = getRuntimeGameConfig('daily');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(500);
      expect(config.dangerZoneMs).toBe(1500);
    });

    it('should return runtime config for stadium mode', () => {
      const config = getRuntimeGameConfig('stadium');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(500);
      expect(config.dangerZoneMs).toBe(GAME.DANGER_ZONE_MS);
    });

    it('should return runtime config for stadium_daily mode', () => {
      const config = getRuntimeGameConfig('stadium_daily');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(500);
      expect(config.dangerZoneMs).toBe(GAME.DANGER_ZONE_MS);
    });

    it('should throw for invalid mode', () => {
      expect(() => getRuntimeGameConfig('invalid')).toThrow('Unknown game mode: invalid');
    });

    it('should return complete runtime config for civilization mode', () => {
      const config = getRuntimeGameConfig('civilization');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(500);
      expect(config.dangerZoneMs).toBe(GAME.DANGER_ZONE_MS);
    });

    it('should return complete runtime config for country mode', () => {
      const config = getRuntimeGameConfig('country');
      expect(config).toEqual({
        roundCount: 5,
        timerMs: 5000,
        graceMs: 500,
        dangerZoneMs: GAME.DANGER_ZONE_MS,
      });
      expect(config.roundCount).toBe(GAME_MODES.country.timing.roundCount);
      expect(config.timerMs).toBe(GAME_MODES.country.timing.roundTime);
      expect(config.graceMs).toBe(GAME_MODES.country.timing.gracePeriod);
    });
  });

  describe('getAllModes', () => {
    it('should return all available modes (capital, country, stadium, civilization)', () => {
      const modes = getAllModes();
      expect(modes).toHaveLength(4);
      expect(modes.map((m) => m.id)).toContain('capital');
      expect(modes.map((m) => m.id)).toContain('country');
      expect(modes.map((m) => m.id)).toContain('stadium');
      expect(modes.map((m) => m.id)).toContain('civilization');
      const capital = modes.find((m) => m.id === 'capital');
      const country = modes.find((m) => m.id === 'country');
      const stadium = modes.find((m) => m.id === 'stadium');
      const civilization = modes.find((m) => m.id === 'civilization');
      expect(capital.variants).toEqual(['classic', 'daily']);
      expect(country.variants).toEqual(['classic', 'daily']);
      expect(stadium.variants).toEqual(['classic', 'daily']);
      expect(civilization.variants).toEqual(['classic', 'daily']);
    });
  });

  describe('getModeIds', () => {
    it('should return all mode IDs (capital, country, stadium, civilization)', () => {
      const ids = getModeIds();
      expect(ids).toHaveLength(4);
      expect(ids).toContain('capital');
      expect(ids).toContain('country');
      expect(ids).toContain('stadium');
      expect(ids).toContain('civilization');
    });
  });

  describe('isDailyVariant', () => {
    it('should return true for all daily variants', () => {
      expect(isDailyVariant(MODE_IDS.DAILY)).toBe(true);
      expect(isDailyVariant(MODE_IDS.COUNTRY_DAILY)).toBe(true);
      expect(isDailyVariant(MODE_IDS.STADIUM_DAILY)).toBe(true);
      expect(isDailyVariant(MODE_IDS.CIVILIZATION_DAILY)).toBe(true);
    });

    it('should return false for classic variants', () => {
      expect(isDailyVariant(MODE_IDS.CLASSIC)).toBe(false);
      expect(isDailyVariant(MODE_IDS.COUNTRY)).toBe(false);
      expect(isDailyVariant(MODE_IDS.STADIUM)).toBe(false);
      expect(isDailyVariant(MODE_IDS.CIVILIZATION)).toBe(false);
    });
  });

  describe('isCapitalCategory', () => {
    it('should return true for classic and daily', () => {
      expect(isCapitalCategory(MODE_IDS.CLASSIC)).toBe(true);
      expect(isCapitalCategory(MODE_IDS.DAILY)).toBe(true);
    });

    it('should return false for other categories', () => {
      expect(isCapitalCategory(MODE_IDS.COUNTRY)).toBe(false);
      expect(isCapitalCategory(MODE_IDS.STADIUM)).toBe(false);
      expect(isCapitalCategory(MODE_IDS.CIVILIZATION)).toBe(false);
      expect(isCapitalCategory(MODE_IDS.COUNTRY_DAILY)).toBe(false);
    });
  });

  describe('isStadiumCategory', () => {
    it('should return true for stadium and stadium_daily', () => {
      expect(isStadiumCategory(MODE_IDS.STADIUM)).toBe(true);
      expect(isStadiumCategory(MODE_IDS.STADIUM_DAILY)).toBe(true);
    });

    it('should return false for other categories', () => {
      expect(isStadiumCategory(MODE_IDS.CLASSIC)).toBe(false);
      expect(isStadiumCategory(MODE_IDS.COUNTRY)).toBe(false);
      expect(isStadiumCategory(MODE_IDS.CIVILIZATION)).toBe(false);
    });
  });

  describe('isCountryCategory', () => {
    it('should return true for country and country_daily', () => {
      expect(isCountryCategory(MODE_IDS.COUNTRY)).toBe(true);
      expect(isCountryCategory(MODE_IDS.COUNTRY_DAILY)).toBe(true);
    });

    it('should return false for other categories', () => {
      expect(isCountryCategory(MODE_IDS.CLASSIC)).toBe(false);
      expect(isCountryCategory(MODE_IDS.STADIUM)).toBe(false);
      expect(isCountryCategory(MODE_IDS.CIVILIZATION)).toBe(false);
    });
  });

  describe('isCivilizationCategory', () => {
    it('should return true for civilization and civilization_daily', () => {
      expect(isCivilizationCategory(MODE_IDS.CIVILIZATION)).toBe(true);
      expect(isCivilizationCategory(MODE_IDS.CIVILIZATION_DAILY)).toBe(true);
    });

    it('should return false for other categories', () => {
      expect(isCivilizationCategory(MODE_IDS.CLASSIC)).toBe(false);
      expect(isCivilizationCategory(MODE_IDS.COUNTRY)).toBe(false);
      expect(isCivilizationCategory(MODE_IDS.STADIUM)).toBe(false);
    });
  });

  describe('Classic mode configuration', () => {
    const classic = GAME_MODES.classic;

    it('should have correct capital selection config', () => {
      expect(classic.capitalSelection.type).toBe('random');
      expect(classic.capitalSelection.count).toBe(5);
      expect(classic.capitalSelection.balancing.popular).toBe(2);
      expect(classic.capitalSelection.balancing.obscure).toBe(3);
    });

    it('should have correct scoring config', () => {
      expect(classic.scoring.maxPerRound).toBe(5000);
      expect(classic.scoring.timeBonus.enabled).toBe(false);
    });

    it('should have correct timing config', () => {
      expect(classic.timing.roundTime).toBe(5000);
      expect(classic.timing.gracePeriod).toBe(500);
      expect(classic.timing.roundCount).toBe(5);
    });
  });

  describe('Daily mode configuration', () => {
    const daily = GAME_MODES.daily;

    it('should have correct capital selection config', () => {
      expect(daily.capitalSelection.type).toBe('seeded');
      expect(daily.capitalSelection.count).toBe(5);
      expect(daily.capitalSelection.balancing.popular).toBe(2);
      expect(daily.capitalSelection.balancing.obscure).toBe(3);
      expect(daily.capitalSelection.seed).toBeTypeOf('function');
    });

    it('should have correct scoring config with time bonus', () => {
      expect(daily.scoring.maxPerRound).toBe(5000);
      expect(daily.scoring.timeBonus.enabled).toBe(true);
      expect(daily.scoring.timeBonus.maxBonus).toBe(1000);
      expect(daily.scoring.timeBonus.maxBonusPercent).toBe(0.2);
    });

    it('should generate consistent seed from date', () => {
      const date = new Date('2024-01-15');
      const seed = daily.capitalSelection.seed(date);
      // Seed is (YYYYMMDD * salt) % 999999, not raw YYYYMMDD
      expect(seed).toBe(628005);
      // Same date must produce same seed
      expect(daily.capitalSelection.seed(new Date('2024-01-15'))).toBe(628005);
    });

    it('should generate different seeds for different dates', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const seed1 = daily.capitalSelection.seed(date1);
      const seed2 = daily.capitalSelection.seed(date2);
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('Civilization mode configuration', () => {
    const civilization = GAME_MODES.civilization;

    it('should have civilization selection config', () => {
      expect(civilization.civilizationSelection.type).toBe('random');
      expect(civilization.civilizationSelection.count).toBe(5);
      expect(civilization.civilizationSelection.balancing.popular).toBe(2);
      expect(civilization.civilizationSelection.balancing.obscure).toBe(3);
    });

    it('should return civilization mode via getGameMode', () => {
      const mode = getGameMode('civilization');
      expect(mode.id).toBe('civilization');
      expect(mode.name).toBe('Civilization Mode');
    });
  });
});
