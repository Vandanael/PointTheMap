import { describe, it, expect } from 'vitest';
import {
  getGameMode,
  getRuntimeGameConfig,
  getTimeBonusConfig,
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
import { GAME } from './runtime.js';
import { SCORING } from './scoring.js';

/**
 * @template T
 * @param {T | null | undefined} value
 * @param {string} message
 * @returns {T}
 */
const assertDefined = (value, message) => {
  if (value === null || value === undefined) throw new Error(message);
  return value;
};

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
      const capitalSelection = assertDefined(mode.capitalSelection, 'Missing capitalSelection');
      expect(capitalSelection.type).toBe('random');
      expect(mode.scoring.timeBonus.enabled).toBe(true);
    });

    it('should return daily mode configuration', () => {
      const mode = getGameMode('daily');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('daily');
      expect(mode.name).toBe('Daily Challenge');
      const capitalSelection = assertDefined(mode.capitalSelection, 'Missing capitalSelection');
      expect(capitalSelection.type).toBe('seeded');
      expect(mode.scoring.timeBonus.enabled).toBe(true);
    });

    it('should return stadium mode configuration', () => {
      const mode = getGameMode('stadium');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('stadium');
      expect(mode.name).toBe('Stadium Mode');
      const stadiumSelection = assertDefined(mode.stadiumSelection, 'Missing stadiumSelection');
      expect(stadiumSelection.type).toBe('random');
      expect(mode.scoring.timeBonus.enabled).toBe(true);
    });

    it('should return country_daily mode configuration', () => {
      const mode = getGameMode('country_daily');
      expect(mode).toBeDefined();
      expect(mode.id).toBe('country_daily');
      const countrySelection = assertDefined(mode.countrySelection, 'Missing countrySelection');
      expect(countrySelection.type).toBe('seeded');
      expect(mode.scoring.timeBonus.enabled).toBe(true);
    });

    it('should throw error for invalid mode', () => {
      expect(() => getGameMode('invalid')).toThrow('Unknown game mode: invalid');
    });
  });

  describe('time bonus config invariants', () => {
    it('should define a valid timeBonus config for every game mode', () => {
      Object.entries(GAME_MODES).forEach(([modeId, mode]) => {
        expect(mode, `Missing mode for ${modeId}`).toBeDefined();
        expect(mode.scoring, `Missing scoring for ${modeId}`).toBeDefined();
        const timeBonus = mode.scoring.timeBonus;
        expect(timeBonus, `Missing timeBonus for ${modeId}`).toBeDefined();
        expect(typeof timeBonus.enabled).toBe('boolean');
        expect(Number.isFinite(timeBonus.maxBonus)).toBe(true);

        if (timeBonus.enabled) {
          expect(Number.isFinite(timeBonus.maxBonusPercent)).toBe(true);
        }
      });
    });

    it('should use canonical shared time bonus config by mode', () => {
      Object.keys(GAME_MODES).forEach((modeId) => {
        expect(getTimeBonusConfig(modeId)).toEqual(SCORING.TIME_BONUS_BY_MODE[modeId]);
      });
    });
  });

  describe('getRuntimeGameConfig', () => {
    it('should return runtime config for classic mode', () => {
      const config = getRuntimeGameConfig('classic');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(1000);
      expect(config.dangerZoneMs).toBe(2000);
    });

    it('should return runtime config for daily mode', () => {
      const config = getRuntimeGameConfig('daily');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(1000);
      expect(config.dangerZoneMs).toBe(2000);
    });

    it('should return runtime config for stadium mode', () => {
      const config = getRuntimeGameConfig('stadium');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(1000);
      expect(config.dangerZoneMs).toBe(GAME.DANGER_ZONE_MS);
    });

    it('should return runtime config for stadium_daily mode', () => {
      const config = getRuntimeGameConfig('stadium_daily');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(1000);
      expect(config.dangerZoneMs).toBe(GAME.DANGER_ZONE_MS);
    });

    it('should throw for invalid mode', () => {
      expect(() => getRuntimeGameConfig('invalid')).toThrow('Unknown game mode: invalid');
    });

    it('should return complete runtime config for civilization mode', () => {
      const config = getRuntimeGameConfig('civilization');
      expect(config.roundCount).toBe(5);
      expect(config.timerMs).toBe(5000);
      expect(config.graceMs).toBe(1000);
      expect(config.dangerZoneMs).toBe(GAME.DANGER_ZONE_MS);
    });

    it('should return complete runtime config for country mode', () => {
      const config = getRuntimeGameConfig('country');
      expect(config).toEqual({
        roundCount: 5,
        timerMs: 5000,
        graceMs: 1000,
        dangerZoneMs: GAME.DANGER_ZONE_MS,
      });
      const country = assertDefined(GAME_MODES.country, 'Missing country mode config');
      expect(config.roundCount).toBe(country.timing.roundCount);
      expect(config.timerMs).toBe(country.timing.roundTime);
      expect(config.graceMs).toBe(country.timing.gracePeriod);
    });
  });

  describe('getTimeBonusConfig', () => {
    it('should return time bonus config for valid mode', () => {
      const config = getTimeBonusConfig('daily');
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(Number.isFinite(config.maxBonus)).toBe(true);
    });

    it('should return null for invalid mode', () => {
      expect(getTimeBonusConfig('invalid')).toBe(null);
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
      const capital = assertDefined(
        modes.find((m) => m.id === 'capital'),
        'Missing capital mode'
      );
      const country = assertDefined(
        modes.find((m) => m.id === 'country'),
        'Missing country mode'
      );
      const stadium = assertDefined(
        modes.find((m) => m.id === 'stadium'),
        'Missing stadium mode'
      );
      const civilization = assertDefined(
        modes.find((m) => m.id === 'civilization'),
        'Missing civilization mode'
      );
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
    const classic = assertDefined(GAME_MODES.classic, 'Missing classic mode config');

    it('should have correct capital selection config', () => {
      const capitalSelection = assertDefined(classic.capitalSelection, 'Missing capitalSelection');
      const balancing = assertDefined(capitalSelection.balancing, 'Missing balancing');
      expect(capitalSelection.type).toBe('random');
      expect(capitalSelection.count).toBe(5);
      expect(balancing.popular).toBe(2);
      expect(balancing.obscure).toBe(3);
    });

    it('should have correct scoring config', () => {
      expect(classic.scoring.maxPerRound).toBe(5000);
      expect(classic.scoring.timeBonus.enabled).toBe(true);
    });

    it('should have correct timing config', () => {
      expect(classic.timing.roundTime).toBe(5000);
      expect(classic.timing.gracePeriod).toBe(1000);
      expect(classic.timing.roundCount).toBe(5);
    });
  });

  describe('Daily mode configuration', () => {
    const daily = assertDefined(GAME_MODES.daily, 'Missing daily mode config');

    it('should have correct capital selection config', () => {
      const capitalSelection = assertDefined(daily.capitalSelection, 'Missing capitalSelection');
      const balancing = assertDefined(capitalSelection.balancing, 'Missing balancing');
      expect(capitalSelection.type).toBe('seeded');
      expect(capitalSelection.count).toBe(5);
      expect(balancing.popular).toBe(2);
      expect(balancing.obscure).toBe(3);
      expect(capitalSelection.seed).toBeTypeOf('function');
    });

    it('should have correct scoring config with time bonus', () => {
      expect(daily.scoring.maxPerRound).toBe(5000);
      expect(daily.scoring.timeBonus.enabled).toBe(true);
      expect(daily.scoring.timeBonus.maxBonus).toBe(1000);
      expect(daily.scoring.timeBonus.maxBonusPercent).toBe(0.2);
    });

    it('should generate consistent seed from date', () => {
      const capitalSelection = assertDefined(daily.capitalSelection, 'Missing capitalSelection');
      const date = new Date('2024-01-15');
      const seed = capitalSelection.seed(date);
      // Seed is (YYYYMMDD * salt) % 999999, not raw YYYYMMDD
      expect(seed).toBe(628005);
      // Same date must produce same seed
      expect(capitalSelection.seed(new Date('2024-01-15'))).toBe(628005);
    });

    it('should generate different seeds for different dates', () => {
      const capitalSelection = assertDefined(daily.capitalSelection, 'Missing capitalSelection');
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const seed1 = capitalSelection.seed(date1);
      const seed2 = capitalSelection.seed(date2);
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('Civilization mode configuration', () => {
    const civilization = assertDefined(GAME_MODES.civilization, 'Missing civilization mode config');

    it('should have civilization selection config', () => {
      const selection = assertDefined(
        civilization.civilizationSelection,
        'Missing civilizationSelection'
      );
      const balancing = assertDefined(selection.balancing, 'Missing balancing');
      expect(selection.type).toBe('random');
      expect(selection.count).toBe(5);
      expect(balancing.popular).toBe(2);
      expect(balancing.obscure).toBe(3);
    });

    it('should return civilization mode via getGameMode', () => {
      const mode = getGameMode('civilization');
      expect(mode.id).toBe('civilization');
      expect(mode.name).toBe('Civilization Mode');
    });
  });
});
