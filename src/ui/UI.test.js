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

vi.mock('../config/index.js', () => ({
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

vi.mock('../core/ErrorHandler.js', () => ({
  safeAsync: vi.fn(async (fn, context, fallback) => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }),
  handleError: vi.fn(),
}));

// Import AFTER mocks
import { UI, configureUI, loadLeaderboard, _domCacheForTesting } from './UI.js';
import { api } from '../services/api.js';
import { eventBus } from '../core/EventBus.js';
import { t } from '../i18n.js';

/** @type {import('vitest').Mock} */
const mockGetLeaderboard = /** @type {any} */ (api.getLeaderboard);
/** @type {import('vitest').Mock} */
const mockSubscribe = /** @type {any} */ (eventBus.subscribe);

beforeEach(() => {
  configureUI({
    inputSystem: {
      handleStartGame: vi.fn(),
      handleNextRound: vi.fn(),
      handleSubmit: vi.fn(),
      handleReplay: vi.fn(),
    },
    validationSystem: {
      validatePseudo: vi.fn(() => ({ valid: true })),
    },
    mapSystem: {
      isInitialized: vi.fn(() => true),
      init: vi.fn(async () => {}),
      loadCountriesGeoJSON: vi.fn(async () => true),
      loadCivilizationsGeoJSON: vi.fn(async () => true),
    },
  });
});

describe('UI - DOM Cache', () => {
  /** @type {HTMLElement | null} */
  let mockElement = null;

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

  it("_domCache.get() should re-fetch element if it's no longer in DOM", () => {
    const spy = vi.spyOn(document, 'getElementById');

    // First call - element exists
    const element1 = _domCacheForTesting.get('test-element');
    expect(element1).toBe(mockElement);
    expect(spy).toHaveBeenCalledTimes(1);

    // Remove element from DOM
    if (!mockElement) {
      throw new Error('Expected mockElement to be set');
    }
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
    mockSubscribe.mockReturnValue(mockUnsubscribe);

    // Initialize UI (creates subscriptions)
    UI.init();

    // Verify subscriptions were created
    expect(mockSubscribe).toHaveBeenCalled();
    const subscriptionCount = mockSubscribe.mock.calls.length;

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

describe('UI - Map Lock Visual State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.removeAttribute('data-map-lock-label');
    document.body.classList.remove('map-locked');
  });

  afterEach(() => {
    UI.destroy();
    document.body.removeAttribute('data-map-lock-label');
    document.body.classList.remove('map-locked');
  });

  it('sets localized map lock label on init', () => {
    UI.init();
    expect(document.body.getAttribute('data-map-lock-label')).toBe('mapLockedHint');
  });

  it('toggles body map-locked class from input events', () => {
    UI.init();

    const mapDisabledCb = mockSubscribe.mock.calls.find(
      (/** @type {any[]} */ call) => call[0] === 'input:map-disabled'
    )?.[1];
    const mapEnabledCb = mockSubscribe.mock.calls.find(
      (/** @type {any[]} */ call) => call[0] === 'input:map-enabled'
    )?.[1];

    expect(mapDisabledCb).toBeTypeOf('function');
    expect(mapEnabledCb).toBeTypeOf('function');

    mapDisabledCb();
    expect(document.body.classList.contains('map-locked')).toBe(true);

    mapEnabledCb();
    expect(document.body.classList.contains('map-locked')).toBe(false);
  });
});

describe('UI - Leaderboard Timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loadLeaderboard() should resolve successfully when API responds quickly', async () => {
    const mockScores = [
      { rank: 1, pseudo: 'AAA', score: 25000, time: 25000 },
      { rank: 2, pseudo: 'BBB', score: 20000, time: 26000 },
    ];

    mockGetLeaderboard.mockResolvedValue(mockScores);

    const result = await loadLeaderboard('classic');

    expect(result).toEqual(mockScores);
    expect(mockGetLeaderboard).toHaveBeenCalledWith('classic');
  });

  it('loadLeaderboard() should reject with TIMEOUT after 10 seconds', async () => {
    // Mock API to never resolve
    mockGetLeaderboard.mockImplementation(() => new Promise(() => {}));

    const loadPromise = loadLeaderboard('classic');

    // Fast-forward past timeout (10 seconds)
    vi.advanceTimersByTime(10000);

    const result = await loadPromise;

    // safeAsync returns fallback (empty array) on error
    expect(result).toEqual([]);
  });

  it('loadLeaderboard() should handle network errors gracefully', async () => {
    mockGetLeaderboard.mockRejectedValue(new Error('Network error'));

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
    mockGetLeaderboard.mockResolvedValue([]);

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
    mockGetLeaderboard.mockRejectedValue(new Error('API Error'));

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
    mockGetLeaderboard.mockResolvedValueOnce([]);

    await UI.showLeaderboardModal([], 'classic', true);
    await vi.runAllTimersAsync();

    const retryButton = document.getElementById('btn-retry-leaderboard');
    expect(retryButton).toBeTruthy();

    // Setup mock for retry
    const mockScores = [{ rank: 1, pseudo: 'AAA', score: 25000, time: 25000 }];
    mockGetLeaderboard.mockResolvedValueOnce(mockScores);

    // Spy on showLeaderboardModal to verify it's called on retry
    const showModalSpy = vi.spyOn(UI, 'showLeaderboardModal');

    // Click retry button
    retryButton?.click();

    expect(showModalSpy).toHaveBeenCalledWith([], 'classic', true);

    showModalSpy.mockRestore();
    document.body.innerHTML = '';
  });
});

describe('UI - Resume Prompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves true when resume is clicked', async () => {
    const promise = UI.showResumePrompt();
    const resumeBtn = document.getElementById('btn-resume-continue');
    expect(resumeBtn).toBeTruthy();
    resumeBtn?.click();
    await expect(promise).resolves.toBe(true);
  });

  it('resolves false when discard is clicked', async () => {
    const promise = UI.showResumePrompt();
    const discardBtn = document.getElementById('btn-resume-discard');
    expect(discardBtn).toBeTruthy();
    discardBtn?.click();
    await expect(promise).resolves.toBe(false);
  });
});

describe('UI - Error Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const root = document.createElement('div');
    root.id = 'app';
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('showError() renders a centered error modal overlay', () => {
    UI.showError('Something went wrong');

    const modal = document.getElementById('app-error-modal');
    expect(modal).toBeTruthy();
    expect(modal?.className).toContain('fixed inset-0');
    expect(modal?.className).toContain('items-center');
    expect(modal?.className).toContain('justify-center');
    expect(modal?.textContent).toContain('Something went wrong');
    expect(modal?.textContent).not.toContain('⚠️');
    expect(modal?.textContent).not.toContain('❌');
  });
});
