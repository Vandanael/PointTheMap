/**
 * Minimal integration-style test for main.js wiring: timer:timeout → handleTimeout → onRoundEnd → disableClicks + disableMapInput.
 * Mocks DOM and systems with spies; asserts behavior (input disabled once) not argument shapes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const GameStatus = { PLAYING: 'playing', ROUND_RESULT: 'round_result' };

const playingState = {
  status: GameStatus.PLAYING,
  currentRound: {
    capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
    roundNumber: 0,
    startTime: Date.now(),
    endTime: null,
    click: null,
    distance: null,
    score: null,
    status: 'playing',
  },
  runtimeConfig: { roundCount: 5, timerMs: 5000, graceMs: 1000, dangerZoneMs: 2000 },
  rounds: [],
  totalScore: 0,
};

const roundResultState = {
  status: GameStatus.ROUND_RESULT,
  currentRound: {
    capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
    roundNumber: 0,
    startTime: Date.now(),
    endTime: Date.now(),
    click: { lat: 48.8, lng: 2.3 },
    distance: 50,
    score: 4500,
    status: 'completed',
  },
  runtimeConfig: playingState.runtimeConfig,
  rounds: [],
  totalScore: 4500,
};

let mockState;
const mockStateManagerInstance = {
  getState: vi.fn(() => mockState),
  setState: vi.fn((s) => {
    mockState = s;
    return s;
  }),
  registerValidator: vi.fn(),
  subscribe: vi.fn(),
};

vi.mock('./core/StateManager.js', () => ({
  StateManager: vi.fn(function () {
    return mockStateManagerInstance;
  }),
}));

vi.mock('./game/Game.js', () => ({
  createGameState: vi.fn(() => ({ status: 'idle', currentRound: null, rounds: [], totalScore: 0 })),
  startGame: vi.fn(),
  playRound: vi.fn(),
  handleTimeout: vi.fn(() => roundResultState),
  nextRound: vi.fn(),
  getCurrentTarget: vi.fn(),
  isLastRound: vi.fn(),
  getProgress: vi.fn(),
  checkIfNewSessionBest: vi.fn(),
  updateSessionBestScore: vi.fn(),
  resetGame: vi.fn(),
  GameStatus: {
    PLAYING: 'playing',
    ROUND_RESULT: 'round_result',
    IDLE: 'idle',
    LOADING: 'loading',
    GAME_OVER: 'game_over',
  },
}));

const disableClicks = vi.fn();
const disableMapInput = vi.fn();

vi.mock('./systems/MapSystem.js', () => ({
  mapSystem: {
    init: vi.fn(() => Promise.resolve()),
    destroy: vi.fn(),
    disableClicks,
    enableClicks: vi.fn(),
    clearMap: vi.fn(),
    flyTo: vi.fn(),
    showRoundResult: vi.fn(() => Promise.resolve()),
    setOnResultContinue: vi.fn((resolve) => resolve()),
    clearOnResultContinue: vi.fn(),
  },
}));

vi.mock('./systems/InputSystem.js', () => ({
  inputSystem: {
    init: vi.fn(),
    destroy: vi.fn(),
    disableMapInput,
    enableMapInput: vi.fn(),
  },
}));

vi.mock('./systems/TimerSystem.js', () => ({
  timerSystem: {
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('./systems/ScoringSystem.js', () => ({
  scoringSystem: { init: vi.fn(), destroy: vi.fn() },
}));

vi.mock('./systems/UISystem.js', () => {
  const uiSystem = { init: vi.fn(), destroy: vi.fn() };
  return { getUISystem: vi.fn(() => uiSystem) };
});

vi.mock('./ui/UI.js', () => ({
  configureUI: vi.fn(),
  UI: {
    init: vi.fn(),
    showLoader: vi.fn(),
    hideLoader: vi.fn(),
    updateLoader: vi.fn(),
    showStart: vi.fn(),
    showGameUI: vi.fn(),
    showQuestion: vi.fn(),
    showRoundResult: vi.fn(),
    hideQuestion: vi.fn(),
    showError: vi.fn(),
    resetTimer: vi.fn(),
    showPseudoLockedDialog: vi.fn(),
    showFinalResults: vi.fn(),
  },
}));

vi.mock('./config/index.js', () => ({
  GAME: { ROUNDS: 5, TIMER_MS: 5000, GRACE_PERIOD_MS: 1000, DANGER_ZONE_MS: 2000 },
  TIMING: { RESULT_READ_TIME_MS: 2500 },
  MAP: { CENTER: [30, 10], ZOOM: 3 },
}));

vi.mock('./services/api.js', () => ({
  api: { start: vi.fn(), submit: vi.fn(), getLeaderboard: vi.fn() },
  processRetryQueue: vi.fn(() => Promise.resolve({ successful: 0, failed: 0 })),
  submitWithRetry: vi.fn(),
}));

vi.mock('./services/storage.js', () => ({
  setLastPseudo: vi.fn(),
  getRetryQueue: vi.fn(() => []),
}));

vi.mock('./services/Analytics.js', () => ({ analytics: { init: vi.fn(), track: vi.fn() } }));
vi.mock('./services/ErrorMonitoring.js', () => ({ errorMonitoring: { init: vi.fn() } }));

vi.mock('./utils/device.js', () => ({ isIOS: vi.fn(() => false) }));
vi.mock('./utils/logger.js', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./utils/performance.js', () => ({ debounce: vi.fn((fn) => fn) }));

vi.mock('./core/ErrorHandler.js', () => {
  const errorHandler = { handle: vi.fn() };
  return {
    errorHandler,
    APIError: class APIError extends Error {},
    ValidationError: class ValidationError extends Error {},
    safeAsync: vi.fn((fn) => fn()),
    handleError: vi.fn((error, context, options) => errorHandler.handle(error, context, options)),
  };
});

vi.mock('./game/Round.js', () => ({ getRemainingTime: vi.fn(() => 1000) }));

vi.mock('./features/StatsManager.js', () => ({
  updateStats: vi.fn(),
  getStats: vi.fn(() => ({})),
}));
vi.mock('./features/AchievementManager.js', () => ({ checkAchievements: vi.fn() }));
vi.mock('./features/Share.js', () => ({
  formatShareText: vi.fn(),
  shareGameResults: vi.fn(),
  getDailyNumber: vi.fn(),
}));

vi.mock('./i18n.js', () => ({
  getLang: vi.fn(() => 'en'),
  t: vi.fn((k) => k),
  getCivilizationName: vi.fn((name) => name),
}));
vi.mock('./ui/components.js', () => ({ AchievementUnlockModal: vi.fn(() => '') }));

import { eventBus } from './core/EventBus.js';
import { UI } from './ui/UI.js';
import { submitWithRetry } from './services/api.js';
import { errorHandler } from './core/ErrorHandler.js';

/** State with token/rounds/gameType for submit flow */
const submitState = {
  ...playingState,
  token: 'test-token',
  rounds: [
    {
      roundNumber: 1,
      score: 1000,
      distance: 50,
      capital: { name: 'Paris' },
      status: 'completed',
      click: { lat: 48.8, lng: 2.3 },
    },
    {
      roundNumber: 2,
      score: 900,
      distance: 80,
      capital: { name: 'London' },
      status: 'completed',
      click: { lat: 51.5, lng: -0.1 },
    },
    {
      roundNumber: 3,
      score: 800,
      distance: 120,
      capital: { name: 'Berlin' },
      status: 'completed',
      click: { lat: 52.5, lng: 13.4 },
    },
    {
      roundNumber: 4,
      score: 700,
      distance: 200,
      capital: { name: 'Rome' },
      status: 'completed',
      click: { lat: 41.9, lng: 12.5 },
    },
    {
      roundNumber: 5,
      score: 600,
      distance: 300,
      capital: { name: 'Madrid' },
      status: 'completed',
      click: { lat: 40.4, lng: -3.7 },
    },
  ],
  gameType: 'classic',
};

describe('main.js wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = playingState;
    mockStateManagerInstance.getState.mockImplementation(() => mockState);
    mockStateManagerInstance.setState.mockImplementation((s) => {
      mockState = s;
      return s;
    });
  });

  afterEach(() => {
    eventBus.clear?.();
  });

  it('when timer:timeout is emitted, handleTimeout runs once, round ends once, and input is disabled (disableClicks + disableMapInput called)', async () => {
    await import('./main.js');

    document.dispatchEvent(new Event('DOMContentLoaded'));
    // Wait for init() to complete so timer:timeout subscription is registered
    await vi.waitFor(() => {
      expect(UI.showStart).toHaveBeenCalled();
    });

    eventBus.emit('timer:timeout');

    expect(disableClicks).toHaveBeenCalledTimes(1);
    expect(disableMapInput).toHaveBeenCalledTimes(1);
  });

  it('ignores timer events from a stale roundId', async () => {
    await import('./main.js');

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await vi.waitFor(() => {
      expect(UI.showStart).toHaveBeenCalled();
    });

    mockState = {
      ...playingState,
      currentRound: { ...playingState.currentRound, roundId: 1 },
    };

    eventBus.emit('timer:timeout', { roundId: 2 });

    expect(disableClicks).not.toHaveBeenCalled();
    expect(disableMapInput).not.toHaveBeenCalled();
  });

  describe('handleSubmit (pseudo lock retry)', () => {
    /** Ensure btn-submit exists in DOM for restore assertions */
    const ensureSubmitButton = () => {
      let btn = document.getElementById('btn-submit');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'btn-submit';
        document.body.appendChild(btn);
      }
      return btn;
    };

    it('409 path triggers pseudo dialog and retries; second attempt succeeds', async () => {
      mockState = { ...submitState };
      const lockedPseudo = 'LOCKED';
      submitWithRetry
        .mockRejectedValueOnce({
          status: 409,
          data: { error: 'pseudo_already_set_for_this_ip', pseudo: lockedPseudo },
        })
        .mockResolvedValueOnce({ score: 10000, rank: 1, isTopFifty: false });

      UI.showPseudoLockedDialog.mockImplementation((_pseudo, onConfirm) => {
        onConfirm();
      });

      await import('./main.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await vi.waitFor(() => expect(UI.showStart).toHaveBeenCalled());

      eventBus.emit('input:submit', { pseudo: 'USER' });
      await vi.waitFor(() => expect(submitWithRetry).toHaveBeenCalledTimes(2));

      expect(UI.showPseudoLockedDialog).toHaveBeenCalledWith(lockedPseudo, expect.any(Function));
      expect(submitWithRetry).toHaveBeenNthCalledWith(
        1,
        'test-token',
        submitState.rounds,
        'USER',
        'classic'
      );
      expect(submitWithRetry).toHaveBeenNthCalledWith(
        2,
        'test-token',
        submitState.rounds,
        lockedPseudo,
        'classic'
      );
      expect(UI.showFinalResults).toHaveBeenCalledWith(
        10000,
        lockedPseudo,
        expect.objectContaining({ score: 10000, rank: 1, isTopFifty: false }),
        undefined
      );
    });

    it('409 then second attempt fails restores UI and surfaces error', async () => {
      mockState = { ...submitState };
      const btn = ensureSubmitButton();
      submitWithRetry
        .mockRejectedValueOnce({
          status: 409,
          data: { error: 'pseudo_already_set_for_this_ip', pseudo: 'LOCKED' },
        })
        .mockRejectedValueOnce({ status: 500, message: 'Server error' });

      UI.showPseudoLockedDialog.mockImplementation((_pseudo, onConfirm) => {
        onConfirm();
      });

      await import('./main.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await vi.waitFor(() => expect(UI.showStart).toHaveBeenCalled());

      eventBus.emit('input:submit', { pseudo: 'USER' });
      await vi.waitFor(() => expect(errorHandler.handle).toHaveBeenCalled());

      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe('save');
      expect(errorHandler.handle).toHaveBeenCalledWith(expect.any(Error), 'score:submit', {
        showToUser: true,
        fatal: false,
      });
    });

    it('non-409 error restores UI and surfaces via ErrorHandler', async () => {
      mockState = { ...submitState };
      const btn = ensureSubmitButton();
      submitWithRetry.mockRejectedValueOnce({ status: 500, message: 'Server error' });

      await import('./main.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await vi.waitFor(() => expect(UI.showStart).toHaveBeenCalled());

      eventBus.emit('input:submit', { pseudo: 'USER' });
      await vi.waitFor(() => expect(errorHandler.handle).toHaveBeenCalled());

      expect(UI.showPseudoLockedDialog).not.toHaveBeenCalled();
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe('save');
      expect(errorHandler.handle).toHaveBeenCalledWith(expect.any(Error), 'score:submit', {
        showToUser: true,
        fatal: false,
      });
    });
  });
});
