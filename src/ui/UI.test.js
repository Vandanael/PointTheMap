import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('../services/api.js', () => ({
  api: {
    getLeaderboard: vi.fn(),
  },
}));

vi.mock('../services/storage.js', () => ({
  getLastPseudo: vi.fn(() => ''),
  getTheme: vi.fn(() => 'dark'),
  setTheme: vi.fn(),
}));

vi.mock('../i18n.js', () => ({
  toggleLang: vi.fn(() => 'en'),
  t: vi.fn((key) => key),
  getLang: vi.fn(() => 'fr'),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../core/EventBus.js', () => ({
  eventBus: {
    subscribe: vi.fn(() => vi.fn()), // Return unsubscribe function
    emit: vi.fn(),
  },
}));

vi.mock('../config.js', () => ({
  GAME: {
    TIMER_MS: 5000,
  },
}));

vi.mock('../config/visual-constants.js', () => ({
  UI_TIMING: {
    QUESTION_AUTO_CLOSE: 1500,
    ERROR_DISPLAY: 4000,
  },
}));

vi.mock('../utils/performance.js', () => ({
  debounce: vi.fn((fn) => fn),
}));

vi.mock('../systems/InputSystem.js', () => ({
  inputSystem: {
    handleStartGame: vi.fn(),
    handleNextRound: vi.fn(),
    handleSubmit: vi.fn(),
    handleReplay: vi.fn(),
  },
}));

vi.mock('../core/ErrorHandler.js', () => ({
  safeAsync: vi.fn(async (fn, context, fallback) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }),
}));

vi.mock('../systems/ValidationSystem.js', () => ({
  validationSystem: {
    validatePseudo: vi.fn(() => ({ valid: true })),
  },
}));

// Import AFTER mocks
import { UI, loadLeaderboard, _domCacheForTesting } from './UI.js';
import { api } from '../services/api.js';
import { eventBus } from '../core/EventBus.js';
import { t } from '../i18n.js';

describe('UI - DOM Cache', () => {
  let mockElement;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DOM
    mockElement = document.createElement('div');
    mockElement.id = 'test-element';
    document.body.appendChild(mockElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    _domCacheForTesting.invalidate(); // Clear cache after each test
  });

  it('_domCache.get() should cache DOM elements on first call', () => {
    const spy = vi.spyOn(document, 'getElementById');

    const element1 = _domCacheForTesting.get('test-element');
    expect(element1).toBe(mockElement);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it('_domCache.get() should return cached element on subsequent calls', () => {
    const spy = vi.spyOn(document, 'getElementById');

    const element1 = _domCacheForTesting.get('test-element');
    const element2 = _domCacheForTesting.get('test-element');
    const element3 = _domCacheForTesting.get('test-element');

    expect(element1).toBe(element2);
    expect(element2).toBe(element3);
    expect(spy).toHaveBeenCalledTimes(1); // Only called once

    spy.mockRestore();
  });

  it('_domCache.get() should re-fetch element if it\'s no longer in DOM', () => {
    const spy = vi.spyOn(document, 'getElementById');

    // First call - element exists
    const element1 = _domCacheForTesting.get('test-element');
    expect(element1).toBe(mockElement);
    expect(spy).toHaveBeenCalledTimes(1);

    // Remove element from DOM
    document.body.removeChild(mockElement);

    // Create new element with same ID
    const newElement = document.createElement('div');
    newElement.id = 'test-element';
    document.body.appendChild(newElement);

    // Second call - should detect element is no longer in DOM and re-fetch
    const element2 = _domCacheForTesting.get('test-element');
    expect(element2).toBe(newElement);
    expect(element2).not.toBe(element1);
    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });

  it('_domCache.invalidate() should clear single element from cache', () => {
    const spy = vi.spyOn(document, 'getElementById');

    // Cache the element
    _domCacheForTesting.get('test-element');
    expect(spy).toHaveBeenCalledTimes(1);

    // Invalidate specific element
    _domCacheForTesting.invalidate('test-element');

    // Next call should query DOM again
    _domCacheForTesting.get('test-element');
    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });

  it('_domCache.invalidate() should clear entire cache when called without parameter', () => {
    const spy = vi.spyOn(document, 'getElementById');

    // Create multiple elements
    const element2 = document.createElement('div');
    element2.id = 'element-2';
    document.body.appendChild(element2);

    // Cache both elements
    _domCacheForTesting.get('test-element');
    _domCacheForTesting.get('element-2');
    expect(spy).toHaveBeenCalledTimes(2);

    // Invalidate all
    _domCacheForTesting.invalidate();

    // Both should be re-queried
    _domCacheForTesting.get('test-element');
    _domCacheForTesting.get('element-2');
    expect(spy).toHaveBeenCalledTimes(4);

    spy.mockRestore();
  });
});

describe('UI - Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UI.destroy() should unsubscribe from all EventBus subscriptions', () => {
    const mockUnsubscribe = vi.fn();
    eventBus.subscribe.mockReturnValue(mockUnsubscribe);

    // Initialize UI (creates subscriptions)
    UI.init();

    // Verify subscriptions were created
    expect(eventBus.subscribe).toHaveBeenCalled();
    const subscriptionCount = eventBus.subscribe.mock.calls.length;

    // Destroy should call all unsubscribers
    UI.destroy();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(subscriptionCount);
  });

  it('UI.destroy() should invalidate DOM cache', () => {
    const spy = vi.spyOn(_domCacheForTesting, 'invalidate');

    UI.destroy();

    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});

describe('UI - Leaderboard Timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loadLeaderboard() should resolve successfully when API responds quickly', async () => {
    const mockScores = [
      { rank: 1, pseudo: 'AAA', score: 25000, time: 25000 },
      { rank: 2, pseudo: 'BBB', score: 20000, time: 26000 },
    ];

    api.getLeaderboard.mockResolvedValue(mockScores);

    const result = await loadLeaderboard('classic');

    expect(result).toEqual(mockScores);
    expect(api.getLeaderboard).toHaveBeenCalledWith('classic');
  });

  it('loadLeaderboard() should reject with TIMEOUT after 5 seconds', async () => {
    // Mock API to never resolve
    api.getLeaderboard.mockImplementation(() => new Promise(() => {}));

    const loadPromise = loadLeaderboard('classic');

    // Fast-forward past timeout
    vi.advanceTimersByTime(5000);

    const result = await loadPromise;

    // safeAsync returns fallback (empty array) on error
    expect(result).toEqual([]);
  });

  it('loadLeaderboard() should handle network errors gracefully', async () => {
    api.getLeaderboard.mockRejectedValue(new Error('Network error'));

    const result = await loadLeaderboard('classic');

    // safeAsync returns fallback on error
    expect(result).toEqual([]);
  });

  it('showLeaderboardModal() should display retry button on timeout', async () => {
    // Setup DOM
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    // Mock timeout scenario (API returns empty, simulating timeout)
    api.getLeaderboard.mockResolvedValue([]);

    // Show modal with lazy load
    await UI.showLeaderboardModal([], 'classic', true);

    // Wait for async operations
    await vi.runAllTimersAsync();

    // Check if retry button exists
    const retryButton = document.getElementById('btn-retry-leaderboard');
    expect(retryButton).toBeTruthy();
    expect(retryButton?.textContent).toContain('error.retry');

    document.body.innerHTML = '';
  });

  it('showLeaderboardModal() should display retry button on error', async () => {
    // Setup DOM
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    // Mock error scenario
    api.getLeaderboard.mockRejectedValue(new Error('API Error'));

    await UI.showLeaderboardModal([], 'classic', true);
    await vi.runAllTimersAsync();

    const retryButton = document.getElementById('btn-retry-leaderboard');
    expect(retryButton).toBeTruthy();

    document.body.innerHTML = '';
  });

  it('retry button should reload leaderboard when clicked', async () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);

    // First call returns empty (error)
    api.getLeaderboard.mockResolvedValueOnce([]);

    await UI.showLeaderboardModal([], 'classic', true);
    await vi.runAllTimersAsync();

    const retryButton = document.getElementById('btn-retry-leaderboard');
    expect(retryButton).toBeTruthy();

    // Setup mock for retry
    const mockScores = [{ rank: 1, pseudo: 'AAA', score: 25000, time: 25000 }];
    api.getLeaderboard.mockResolvedValueOnce(mockScores);

    // Spy on showLeaderboardModal to verify it's called on retry
    const showModalSpy = vi.spyOn(UI, 'showLeaderboardModal');

    // Click retry button
    retryButton?.click();

    expect(showModalSpy).toHaveBeenCalledWith([], 'classic', true);

    showModalSpy.mockRestore();
    document.body.innerHTML = '';
  });
});
