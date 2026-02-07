import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveInProgressGame,
  loadInProgressGame,
  clearInProgressGame,
} from './gameStatePersistence.js';
import { API } from '@lib/config';

describe('gameStatePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves and loads in-progress state', () => {
    const state = { status: 'playing', token: 'abc' };
    saveInProgressGame(state);
    const loaded = loadInProgressGame();
    expect(loaded?.state?.token).toBe('abc');
  });

  it('expires in-progress state after session expiry window', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);
    saveInProgressGame({ status: 'playing', token: 'abc' });

    nowSpy.mockReturnValue(API.SESSION_EXPIRY_MS + 1);
    const loaded = loadInProgressGame();
    expect(loaded).toBeNull();
  });

  it('clears in-progress state', () => {
    saveInProgressGame({ status: 'playing', token: 'abc' });
    clearInProgressGame();
    const loaded = loadInProgressGame();
    expect(loaded).toBeNull();
  });
});
