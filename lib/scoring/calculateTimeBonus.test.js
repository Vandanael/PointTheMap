import { describe, it, expect } from 'vitest';
import { calculateTimeBonus } from './calculateTimeBonus.js';

const defaultConfig = {
  enabled: true,
  maxBonus: 1000,
  maxBonusPercent: 0.2,
  distanceThreshold: 200,
};

describe('calculateTimeBonus (shared lib)', () => {
  it('returns 0 when featureEnabled is false', () => {
    expect(
      calculateTimeBonus({
        baseScore: 5000,
        timeRemainingMs: 5000,
        totalTimeMs: 6000,
        timeBonusConfig: defaultConfig,
        featureEnabled: false,
      })
    ).toBe(0);
  });

  it('returns 0 when timeBonusConfig is null', () => {
    expect(
      calculateTimeBonus({
        baseScore: 5000,
        timeRemainingMs: 5000,
        totalTimeMs: 6000,
        timeBonusConfig: /** @type {any} */ (null),
      })
    ).toBe(0);
  });

  it('returns 0 when config.enabled is false', () => {
    expect(
      calculateTimeBonus({
        baseScore: 5000,
        timeRemainingMs: 5000,
        totalTimeMs: 6000,
        timeBonusConfig: { ...defaultConfig, enabled: false },
      })
    ).toBe(0);
  });

  it('returns 0 when answered after half time (half-timer cutoff)', () => {
    expect(
      calculateTimeBonus({
        baseScore: 5000,
        timeRemainingMs: 2000,
        totalTimeMs: 6000,
        timeBonusConfig: defaultConfig,
      })
    ).toBe(0);
  });

  it('awards bonus when answered exactly at half time (boundary)', () => {
    // timeRemainingMs = 3000, totalTimeMs = 6000 → 3000 < 3000 is false, so bonus applies
    // timeRatio = 3000/6000 = 0.5, bonusPercent = 0.5 * 0.2 = 0.1, bonus = round(5000 * 0.1) = 500
    expect(
      calculateTimeBonus({
        baseScore: 5000,
        timeRemainingMs: 3000,
        totalTimeMs: 6000,
        timeBonusConfig: defaultConfig,
      })
    ).toBe(500);
  });

  it('returns 0 when maxBonusPercent is null', () => {
    expect(
      calculateTimeBonus({
        baseScore: 5000,
        timeRemainingMs: 5000,
        totalTimeMs: 6000,
        timeBonusConfig: { enabled: true, maxBonus: 1000, maxBonusPercent: null },
      })
    ).toBe(0);
  });

  it('returns 0 when maxBonus is null', () => {
    expect(
      calculateTimeBonus({
        baseScore: 5000,
        timeRemainingMs: 5000,
        totalTimeMs: 6000,
        timeBonusConfig: {
          enabled: true,
          maxBonus: /** @type {any} */ (null),
          maxBonusPercent: 0.2,
        },
      })
    ).toBe(0);
  });

  it('returns 0 when baseScore is 0', () => {
    expect(
      calculateTimeBonus({
        baseScore: 0,
        timeRemainingMs: 5000,
        totalTimeMs: 6000,
        timeBonusConfig: defaultConfig,
      })
    ).toBe(0);
  });

  it('caps bonus at maxBonus', () => {
    const bonus = calculateTimeBonus({
      baseScore: 5000,
      timeRemainingMs: 5000,
      totalTimeMs: 5000,
      timeBonusConfig: defaultConfig,
    });
    // 5000 * 1.0 * 0.2 = 1000, capped at 1000
    expect(bonus).toBe(1000);
  });

  it('calculates proportional bonus correctly', () => {
    // timeRatio = 4000/6000 ≈ 0.6667, bonusPercent = 0.6667 * 0.2 ≈ 0.1333
    // bonus = round(5000 * 0.1333) = round(666.67) = 667
    const bonus = calculateTimeBonus({
      baseScore: 5000,
      timeRemainingMs: 4000,
      totalTimeMs: 6000,
      timeBonusConfig: defaultConfig,
    });
    expect(bonus).toBe(667);
  });

  it('clamps timeRatio to [0,1] when timeRemaining > totalTime', () => {
    const bonus = calculateTimeBonus({
      baseScore: 5000,
      timeRemainingMs: 10000,
      totalTimeMs: 6000,
      timeBonusConfig: defaultConfig,
    });
    // timeRatio clamped to 1 → 5000 * 1 * 0.2 = 1000
    expect(bonus).toBe(1000);
  });

  it('defaults featureEnabled to true', () => {
    const bonus = calculateTimeBonus({
      baseScore: 5000,
      timeRemainingMs: 5000,
      totalTimeMs: 5000,
      timeBonusConfig: defaultConfig,
    });
    expect(bonus).toBe(1000);
  });
});
