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
  runtimeConfig: { roundCount: 5, timerMs: 5000, graceMs: 500, dangerZoneMs: 1500 },
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
  GameStatus: { PLAYING: 'playing', ROUND_RESULT: 'round_result', IDLE: 'idle', LOADING: 'loading', GAME_OVER: 'game_over' },
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

vi.mock('./systems/UISystem.js', () => ({
  uiSystem: { init: vi.fn(), destroy: vi.fn() },
}));

vi.mock('./ui/UI.js', () => ({
  UI: {
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
  },
}));

vi.mock('./config.js', () => ({
  GAME: { ROUNDS: 5, TIMER_MS: 5000, GRACE_PERIOD_MS: 500, DANGER_ZONE_MS: 1500 },
  TIMING: { RESULT_READ_TIME_MS: 2500 },
  MAP: { CENTER: [30, 10], ZOOM: 3 },
}));

vi.mock('./services/api.js', () => ({
  api: { start: vi.fn(), submit: vi.fn(), getLeaderboard: vi.fn() },
  processRetryQueue: vi.fn(() => Promise.resolve({ successful: 0, failed: 0 })),
  submitWithRetry: vi.fn(),
}));

vi.mock('./services/storage.js', () => ({ setLastPseudo: vi.fn(), getRetryQueue: vi.fn(() => []) }));

vi.mock('./services/Analytics.js', () => ({ analytics: { init: vi.fn(), track: vi.fn() } }));
vi.mock('./services/ErrorMonitoring.js', () => ({ errorMonitoring: { init: vi.fn() } }));

vi.mock('./utils.js', () => ({ isIOS: vi.fn(() => false) }));
vi.mock('./utils/logger.js', () => ({ logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./utils/performance.js', () => ({ debounce: vi.fn((fn) => fn) }));

vi.mock('./core/ErrorHandler.js', () => ({
  errorHandler: { handle: vi.fn() },
  APIError: class APIError extends Error {},
  safeAsync: vi.fn((fn) => fn()),
}));

vi.mock('./game/Round.js', () => ({ getRemainingTime: vi.fn(() => 1000) }));

vi.mock('./features/StatsManager.js', () => ({ updateStats: vi.fn(), getStats: vi.fn(() => ({})) }));
vi.mock('./features/AchievementManager.js', () => ({ checkAchievements: vi.fn() }));
vi.mock('./features/Share.js', () => ({ formatShareText: vi.fn(), shareGameResults: vi.fn(), getDailyNumber: vi.fn() }));

vi.mock('./i18n.js', () => ({ getLang: vi.fn(() => 'en'), t: vi.fn((k) => k) }));
vi.mock('./ui/components.js', () => ({ AchievementUnlockModal: vi.fn(() => '') }));

import { eventBus } from './core/EventBus.js';
import { UI } from './ui/UI.js';

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
});
