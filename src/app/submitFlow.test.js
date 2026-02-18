import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSubmitFlow } from './submitFlow.js';

describe('submitFlow', () => {
  /** @type {any} */
  let mockContext;

  beforeEach(() => {
    mockContext = {
      stateManager: {
        getState: vi.fn(),
        setState: vi.fn(),
      },
      api: {
        submitWithRetry: vi.fn(),
      },
      storage: {
        setLastPseudo: vi.fn(),
      },
      game: {
        checkIfNewSessionBest: vi.fn(() => false),
        updateSessionBestScore: vi.fn((state) => state),
        resetGame: vi.fn(() => ({})),
      },
      stats: {
        updateStats: vi.fn(() => ({})),
        getStats: vi.fn(() => ({})),
      },
      achievements: {
        checkAchievements: vi.fn(),
      },
      share: {
        getDailyNumber: vi.fn(() => 42),
        formatShareText: vi.fn(() => 'share text'),
        shareGameResults: vi.fn(() => Promise.resolve(true)),
      },
      analytics: {
        track: vi.fn(),
      },
      ui: {
        showFinalResults: vi.fn(),
        showPseudoLockedDialog: vi.fn(),
        showToast: vi.fn(),
        hideRoundResult: vi.fn(),
        hideQuestion: vi.fn(),
        hideGameUI: vi.fn(),
        hideGameOver: vi.fn(),
        showStart: vi.fn(),
        showError: vi.fn(),
      },
      logger: {
        debug: vi.fn(),
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      i18n: {
        t: vi.fn((key) => key),
      },
      config: {
        isCapitalCategory: vi.fn((gt) => gt === 'classic' || gt === 'daily'),
        isCountryCategory: vi.fn((gt) => gt === 'country' || gt === 'country_daily'),
        isStadiumCategory: vi.fn((gt) => gt === 'stadium' || gt === 'stadium_daily'),
        isCivilizationCategory: vi.fn((gt) => gt === 'civilization' || gt === 'civilization_daily'),
        isDailyVariant: vi.fn((gt) => gt.includes('daily')),
        MODE_IDS: {
          CLASSIC: 'classic',
          DAILY: 'daily',
          COUNTRY: 'country',
          STADIUM: 'stadium',
          CIVILIZATION: 'civilization',
          COUNTRY_DAILY: 'country_daily',
          STADIUM_DAILY: 'stadium_daily',
          CIVILIZATION_DAILY: 'civilization_daily',
        },
      },
      validationSystem: null, // skip client-side validation by default
      timerSystem: { stop: vi.fn() },
      inputSystem: { disableMapInput: vi.fn() },
      mapSystem: {
        disableClicks: vi.fn(),
        clearMap: vi.fn(),
        flyTo: vi.fn(),
      },
      MAP: { CENTER: [0, 0], ZOOM: 2 },
    };
  });

  const makeGameState = (gameType = 'classic') => ({
    token: 'test-token-12345678',
    csrfToken: 'csrf-token-123',
    gameType,
    totalScore: 10000,
    rounds: [
      {
        capital: { name: 'Paris', country: 'France', lat: 48.85, lng: 2.35 },
        status: 'completed',
        score: 4000,
        click: { lat: 48.9, lng: 2.4 },
        startTime: 1000,
        endTime: 6000,
      },
      {
        capital: { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.4 },
        status: 'timeout',
        score: 0,
        click: null,
        startTime: 7000,
        endTime: 12000,
      },
    ],
    targets: [
      { name: 'Paris', country: 'France' },
      { name: 'Berlin', country: 'Germany' },
    ],
    runtimeConfig: { roundCount: 5 },
  });

  describe('handleSubmit — success path', () => {
    it('calls api.submitWithRetry with sanitized rounds', async () => {
      const state = makeGameState('classic');
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.api.submitWithRetry.mockResolvedValue({
        score: 10000,
        rank: 5,
        isTopFifty: true,
      });

      const { handleSubmit } = createSubmitFlow(mockContext);
      await handleSubmit('TEST');

      expect(mockContext.api.submitWithRetry).toHaveBeenCalledWith(
        'test-token-12345678',
        expect.arrayContaining([
          expect.objectContaining({ capital: 'Paris', status: 'completed' }),
        ]),
        'TEST',
        'classic',
        'csrf-token-123'
      );
    });

    it('calls stats.updateStats and achievements.checkAchievements on success', async () => {
      const state = makeGameState('classic');
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.api.submitWithRetry.mockResolvedValue({
        score: 10000,
        rank: 3,
        isTopFifty: true,
      });

      const { handleSubmit } = createSubmitFlow(mockContext);
      await handleSubmit('TEST');

      expect(mockContext.stats.updateStats).toHaveBeenCalledWith(state.rounds, 'classic');
      expect(mockContext.achievements.checkAchievements).toHaveBeenCalled();
    });

    it('calls ui.showFinalResults on success', async () => {
      const state = makeGameState('classic');
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.api.submitWithRetry.mockResolvedValue({
        score: 10000,
        rank: 5,
        isTopFifty: false,
      });

      const { handleSubmit } = createSubmitFlow(mockContext);
      await handleSubmit('TEST');

      expect(mockContext.ui.showFinalResults).toHaveBeenCalledWith(
        10000,
        'TEST',
        expect.objectContaining({ score: 10000, rank: 5 }),
        false // isNewBest
      );
    });

    it('tracks game_completed and score_submitted analytics', async () => {
      const state = makeGameState('classic');
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.api.submitWithRetry.mockResolvedValue({
        score: 10000,
        rank: 5,
        isTopFifty: false,
      });

      const { handleSubmit } = createSubmitFlow(mockContext);
      await handleSubmit('TEST');

      expect(mockContext.analytics.track).toHaveBeenCalledWith(
        'game_completed',
        expect.objectContaining({ gameType: 'classic', totalScore: 10000 })
      );
      expect(mockContext.analytics.track).toHaveBeenCalledWith(
        'score_submitted',
        expect.objectContaining({ gameType: 'classic', rank: 5 })
      );
    });

    it('saves last pseudo on success', async () => {
      const state = makeGameState();
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.api.submitWithRetry.mockResolvedValue({
        score: 5000,
        rank: 10,
        isTopFifty: false,
      });

      const { handleSubmit } = createSubmitFlow(mockContext);
      await handleSubmit('ABCDE');

      expect(mockContext.storage.setLastPseudo).toHaveBeenCalledWith('ABCDE');
    });
  });

  describe('handleSubmit — country mode round sanitization', () => {
    it('includes country and countryId fields for country mode', async () => {
      const state = {
        token: 'tok-12345678',
        gameType: 'country',
        totalScore: 5000,
        rounds: [
          {
            country: { name: 'France', countryId: 'FRA' },
            status: 'completed',
            score: 3000,
            click: { lat: 48, lng: 2 },
            startTime: 1000,
            endTime: 4000,
            correctCountryId: 'FRA',
            clickedCountryId: 'FRA',
            distanceToTargetKm: 0,
          },
        ],
        targets: [{ name: 'France', countryId: 'FRA' }],
        runtimeConfig: { roundCount: 5 },
      };
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.api.submitWithRetry.mockResolvedValue({ score: 5000, rank: 1, isTopFifty: true });

      const { handleSubmit } = createSubmitFlow(mockContext);
      await handleSubmit('TEST');

      const [, rounds] = mockContext.api.submitWithRetry.mock.calls[0];
      expect(rounds[0]).toMatchObject({ country: 'France', countryId: 'FRA' });
      expect(rounds[0].capital).toBeUndefined();
    });
  });

  describe('handleSubmit — error path', () => {
    it('handles API error gracefully without throwing', async () => {
      const state = makeGameState();
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.api.submitWithRetry.mockRejectedValue(
        Object.assign(new Error('Server error'), { status: 500, data: {} })
      );

      const { handleSubmit } = createSubmitFlow(mockContext);
      // Should not throw
      await expect(handleSubmit('TEST')).resolves.toBeUndefined();
    });

    it('shows pseudo locked dialog on 409 lock error', async () => {
      const state = makeGameState();
      mockContext.stateManager.getState.mockReturnValue(state);
      // First attempt: 409 pseudo lock — second: also fails so we exhaust attempts
      const lockError = Object.assign(new Error('Locked'), {
        status: 409,
        data: {
          error: {
            code: 'pseudo_already_set_for_this_ip',
            details: { pseudo: 'LOCKE' },
          },
        },
      });
      mockContext.api.submitWithRetry
        .mockRejectedValueOnce(lockError)
        .mockRejectedValueOnce(lockError);
      mockContext.ui.showPseudoLockedDialog.mockImplementation((pseudo, cb) => cb());

      const { handleSubmit } = createSubmitFlow(mockContext);
      await handleSubmit('OTHER');

      expect(mockContext.ui.showPseudoLockedDialog).toHaveBeenCalledWith(
        'LOCKE',
        expect.any(Function)
      );
      expect(mockContext.api.submitWithRetry).toHaveBeenNthCalledWith(
        2,
        state.token,
        expect.any(Array),
        'LOCKE',
        state.gameType,
        state.csrfToken || null
      );
    });
  });

  describe('handleReplay', () => {
    it('resets game state and shows start screen', () => {
      const state = { gameType: 'classic' };
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.game.resetGame.mockReturnValue({});

      const { handleReplay } = createSubmitFlow(mockContext);
      handleReplay();

      expect(mockContext.stateManager.setState).toHaveBeenCalledWith({}, 'game:reset');
      expect(mockContext.mapSystem.clearMap).toHaveBeenCalled();
      expect(mockContext.ui.showStart).toHaveBeenCalled();
    });

    it('tracks replay_clicked analytics', () => {
      const state = { gameType: 'daily' };
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.game.resetGame.mockReturnValue({});

      const { handleReplay } = createSubmitFlow(mockContext);
      handleReplay();

      expect(mockContext.analytics.track).toHaveBeenCalledWith('replay_clicked', {
        gameType: 'daily',
      });
    });

    it('stops timer and disables inputs on replay', () => {
      const state = { gameType: 'classic' };
      mockContext.stateManager.getState.mockReturnValue(state);
      mockContext.game.resetGame.mockReturnValue({});

      const { handleReplay } = createSubmitFlow(mockContext);
      handleReplay();

      expect(mockContext.timerSystem.stop).toHaveBeenCalled();
      expect(mockContext.inputSystem.disableMapInput).toHaveBeenCalled();
      expect(mockContext.mapSystem.disableClicks).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('cleans up without errors when no share handler bound', () => {
      const { cleanup } = createSubmitFlow(mockContext);
      expect(() => cleanup()).not.toThrow();
    });
  });
});
