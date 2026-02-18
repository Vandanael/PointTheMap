import { describe, it, expect } from 'vitest';
import {
  leaderboardTypeFromSelection,
  selectionFromLeaderboardType,
  StartScreen,
} from './components.js';

describe('leaderboardTypeFromSelection', () => {
  it('classic + capitals → classic', () => {
    expect(leaderboardTypeFromSelection('classic', 'capitals')).toBe('classic');
  });

  it('daily + capitals → daily', () => {
    expect(leaderboardTypeFromSelection('daily', 'capitals')).toBe('daily');
  });

  it('classic + countries → country', () => {
    expect(leaderboardTypeFromSelection('classic', 'countries')).toBe('country');
  });

  it('daily + countries → country_daily', () => {
    expect(leaderboardTypeFromSelection('daily', 'countries')).toBe('country_daily');
  });

  it('classic + stadiums → stadium', () => {
    expect(leaderboardTypeFromSelection('classic', 'stadiums')).toBe('stadium');
  });

  it('daily + stadiums → stadium_daily', () => {
    expect(leaderboardTypeFromSelection('daily', 'stadiums')).toBe('stadium_daily');
  });

  it('classic + civilizations → civilization', () => {
    expect(leaderboardTypeFromSelection('classic', 'civilizations')).toBe('civilization');
  });

  it('daily + civilizations → civilization_daily', () => {
    expect(leaderboardTypeFromSelection('daily', 'civilizations')).toBe('civilization_daily');
  });

  it('invalid input → classic (fallback)', () => {
    expect(leaderboardTypeFromSelection('classic', /** @type {any} */ ('unknown'))).toBe('classic');
    expect(leaderboardTypeFromSelection(/** @type {any} */ ('invalid'), 'capitals')).toBe(
      'classic'
    );
  });
});

describe('selectionFromLeaderboardType', () => {
  it('classic → {variant: classic, category: capitals}', () => {
    expect(selectionFromLeaderboardType('classic')).toEqual({
      variant: 'classic',
      category: 'capitals',
    });
  });

  it('daily → {variant: daily, category: capitals}', () => {
    expect(selectionFromLeaderboardType('daily')).toEqual({
      variant: 'daily',
      category: 'capitals',
    });
  });

  it('country → {variant: classic, category: countries}', () => {
    expect(selectionFromLeaderboardType('country')).toEqual({
      variant: 'classic',
      category: 'countries',
    });
  });

  it('country_daily → {variant: daily, category: countries}', () => {
    expect(selectionFromLeaderboardType('country_daily')).toEqual({
      variant: 'daily',
      category: 'countries',
    });
  });

  it('stadium → {variant: classic, category: stadiums}', () => {
    expect(selectionFromLeaderboardType('stadium')).toEqual({
      variant: 'classic',
      category: 'stadiums',
    });
  });

  it('stadium_daily → {variant: daily, category: stadiums}', () => {
    expect(selectionFromLeaderboardType('stadium_daily')).toEqual({
      variant: 'daily',
      category: 'stadiums',
    });
  });

  it('civilization → {variant: classic, category: civilizations}', () => {
    expect(selectionFromLeaderboardType('civilization')).toEqual({
      variant: 'classic',
      category: 'civilizations',
    });
  });

  it('civilization_daily → {variant: daily, category: civilizations}', () => {
    expect(selectionFromLeaderboardType('civilization_daily')).toEqual({
      variant: 'daily',
      category: 'civilizations',
    });
  });

  it('unknown type → {variant: classic, category: capitals} (fallback)', () => {
    expect(selectionFromLeaderboardType('nonexistent')).toEqual({
      variant: 'classic',
      category: 'capitals',
    });
  });
});

describe('StartScreen mobile mode selector', () => {
  it('keeps classic/daily toggle outside the mobile category dropdown', () => {
    document.body.innerHTML = StartScreen();

    const mobileSelect = document.getElementById('mobile-game-mode-select');
    const modeClassic = document.getElementById('mode-classic');
    const modeDaily = document.getElementById('mode-daily');

    expect(mobileSelect).not.toBeNull();
    expect(modeClassic).not.toBeNull();
    expect(modeDaily).not.toBeNull();
    expect(mobileSelect?.contains(modeClassic)).toBe(false);
    expect(mobileSelect?.contains(modeDaily)).toBe(false);
  });

  it('renders only game categories in mobile dropdown options', () => {
    document.body.innerHTML = StartScreen();

    const mobileSelect = /** @type {HTMLSelectElement | null} */ (
      document.getElementById('mobile-game-mode-select')
    );
    expect(mobileSelect).not.toBeNull();

    const optionValues = Array.from(mobileSelect?.options || []).map((opt) => opt.value);
    expect(optionValues).toEqual(['capitals', 'countries', 'stadiums', 'civilizations']);
    expect(optionValues).not.toContain('classic');
    expect(optionValues).not.toContain('daily');
  });
});
