import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoundLifecycle } from './roundLifecycle.js';

describe('roundLifecycle', () => {
  /** @type {any} */
  let mockContext;

  beforeEach(() => {
    mockContext = {
      stateManager: {
        getState: vi.fn(),
        setState: vi.fn(),
      },
      eventBus: {
        emit: vi.fn(),
        subscribe: vi.fn(() => () => {}),
      },
      mapSystem: {
        clearMap: vi.fn(),
        flyTo: vi.fn(),
        flyToFeatureBounds: vi.fn(() => true),
        enableClicks: vi.fn(),
        disableClicks: vi.fn(),
        isInitialized: vi.fn(() => true),
        init: vi.fn(() => Promise.resolve(true)),
        loadCountriesGeoJSON: vi.fn(() => Promise.resolve(true)),
        loadCivilizationsGeoJSON: vi.fn(() => Promise.resolve(true)),
        isInView: vi.fn(() => false),
        getCountryFeatureById: vi.fn(() => ({})),
        getCivilizationFeatureById: vi.fn(() => ({})),
        highlightCountries: vi.fn(),
        highlightCivilizations: vi.fn(),
        showRoundResult: vi.fn().mockResolvedValue(undefined),
        addClickMarker: vi.fn(),
        addCapitalMarker: vi.fn(),
        setOnResultContinue: vi.fn(),
        clearOnResultContinue: vi.fn(),
        waitForTilesReady: vi.fn(() => Promise.resolve(true)),
        ensureFullGeoJSONForMode: vi.fn(() => Promise.resolve(true)),
        prefetchFullGeoJSONForMode: vi.fn(),
      },
      timerSystem: {
        start: vi.fn(),
        stop: vi.fn(),
      },
      inputSystem: {
        enableMapInput: vi.fn(),
        disableMapInput: vi.fn(),
      },
      scoringSystem: {},
      validationSystem: {
        validatePseudo: vi.fn(() => ({ valid: true })),
      },
      ui: {
        hideStart: vi.fn(),
        showLoader: vi.fn(),
        hideLoader: vi.fn(),
        showStart: vi.fn(),
        showToast: vi.fn(),
        showGameUI: vi.fn(),
        showQuestion: vi.fn(),
        hideQuestion: vi.fn(),
        updateGameUI: vi.fn(),
        resetTimer: vi.fn(),
        showRoundResult: vi.fn(),
        hideRoundResult: vi.fn(),
        showGameOver: vi.fn(),
        showRoundTransition: vi.fn(),
        hideRoundTransition: vi.fn(),
        hideGameUI: vi.fn(),
        hideGameOver: vi.fn(),
        showFinalResults: vi.fn(),
        showError: vi.fn(),
      },
      game: {
        playRound: vi.fn(),
        nextRound: vi.fn(),
        getCurrentTarget: vi.fn(),
        isLastRound: vi.fn(),
        getProgress: vi.fn(() => ({ current: 1, total: 5 })),
        GameStatus: {
          IDLE: 'idle',
          LOADING: 'loading',
          PLAYING: 'playing',
          ROUND_RESULT: 'round_result',
          GAME_OVER: 'game_over',
        },
      },
      analytics: {
        track: vi.fn(),
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
        TIMING: { RESULT_READ_TIME_MS: 0 }, // 0ms for fast tests
        MAP: {
          CENTER: [0, 0],
          ZOOM: 2,
          EUROPE_CENTER: [50, 10],
          EUROPE_ZOOM: 4,
          TILE_LOAD_TIMEOUT_MS: 100,
        },
        isStadiumCategory: vi.fn((gt) => gt === 'stadium' || gt === 'stadium_daily'),
        isCountryCategory: vi.fn((gt) => gt === 'country' || gt === 'country_daily'),
        isCivilizationCategory: vi.fn((gt) => gt === 'civilization' || gt === 'civilization_daily'),
      },
    };
  });

  describe('onRoundEnd', () => {
    it('should not process if status is not ROUND_RESULT', async () => {
      mockContext.stateManager.getState.mockReturnValue({
        status: 'playing',
        gameType: 'classic',
        currentRound: null,
      });

      const { onRoundEnd } = createRoundLifecycle(mockContext);
      await onRoundEnd();

      expect(mockContext.ui.showRoundResult).not.toHaveBeenCalled();
      expect(mockContext.eventBus.emit).not.toHaveBeenCalled();
    });

    it('should emit GAME_ROUND_COMPLETED event', async () => {
      const mockState = {
        status: 'round_result',
        gameType: 'classic',
        totalScore: 4200,
        currentRound: {
          capital: { name: 'Paris', country: 'France', lat: 48.85, lng: 2.35 },
          click: { lat: 48.9, lng: 2.4 },
          distance: 8,
          score: 4800,
          status: 'completed',
        },
      };

      mockContext.stateManager.getState.mockReturnValue(mockState);
      mockContext.game.isLastRound.mockReturnValue(false);
      mockContext.mapSystem.setOnResultContinue.mockImplementation((cb) => {
        setTimeout(() => cb(), 0);
      });

      const { onRoundEnd } = createRoundLifecycle(mockContext);
      await onRoundEnd();

      expect(mockContext.eventBus.emit).toHaveBeenCalledWith(
        'game:round:completed',
        expect.objectContaining({ round: mockState.currentRound })
      );
    });

    it('should handle country mode correctly', async () => {
      const mockState = {
        status: 'round_result',
        gameType: 'country',
        totalScore: 5000,
        currentRound: {
          country: { name: 'France', countryId: 'FRA' },
          correctCountryId: 'FRA',
          clickedCountryId: 'ESP',
          click: { lat: 40, lng: -3 },
          distance: 1000,
          score: 3000,
          status: 'completed',
        },
      };

      mockContext.stateManager.getState.mockReturnValue(mockState);
      mockContext.game.isLastRound.mockReturnValue(false);
      mockContext.mapSystem.setOnResultContinue.mockImplementation((cb) => {
        setTimeout(() => cb(), 0);
      });

      const { onRoundEnd } = createRoundLifecycle(mockContext);
      await onRoundEnd();

      expect(mockContext.mapSystem.highlightCountries).toHaveBeenCalledWith({
        correctCountryId: 'FRA',
        clickedCountryId: 'ESP',
      });
      expect(mockContext.ui.showRoundResult).toHaveBeenCalled();
    });

    it('should handle civilization mode correctly', async () => {
      const mockState = {
        status: 'round_result',
        gameType: 'civilization',
        totalScore: 4000,
        currentRound: {
          civilization: { id: 'roman_empire', name: 'Roman Empire' },
          correctCivilizationId: 'roman_empire',
          clickedCivilizationId: 'ancient_greece',
          click: { lat: 41, lng: 12 },
          distance: 500,
          score: 2500,
          status: 'completed',
        },
      };

      mockContext.stateManager.getState.mockReturnValue(mockState);
      mockContext.game.isLastRound.mockReturnValue(false);
      mockContext.mapSystem.setOnResultContinue.mockImplementation((cb) => {
        setTimeout(() => cb(), 0);
      });

      const { onRoundEnd } = createRoundLifecycle(mockContext);
      await onRoundEnd();

      expect(mockContext.mapSystem.highlightCivilizations).toHaveBeenCalledWith({
        correctCivilizationId: 'roman_empire',
        clickedCivilizationId: 'ancient_greece',
      });
      expect(mockContext.ui.showRoundResult).toHaveBeenCalled();
    });

    it('should handle timeout with no click', async () => {
      const mockState = {
        status: 'round_result',
        gameType: 'country',
        totalScore: 2000,
        currentRound: {
          country: { name: 'Germany', countryId: 'DEU' },
          correctCountryId: 'DEU',
          clickedCountryId: null,
          click: null,
          distance: null,
          score: 0,
          status: 'timeout',
        },
      };

      mockContext.stateManager.getState.mockReturnValue(mockState);
      mockContext.game.isLastRound.mockReturnValue(false);
      mockContext.mapSystem.setOnResultContinue.mockImplementation((cb) => {
        setTimeout(() => cb(), 0);
      });

      const { onRoundEnd } = createRoundLifecycle(mockContext);
      await onRoundEnd();

      expect(mockContext.mapSystem.highlightCountries).toHaveBeenCalledWith({
        correctCountryId: 'DEU',
        clickedCountryId: null,
      });
      expect(mockContext.ui.showRoundResult).toHaveBeenCalledWith(
        null,
        0,
        true, // isTimeout
        false,
        undefined,
        undefined
      );
    });

    it('should disableClicks and disableMapInput at round end', async () => {
      mockContext.stateManager.getState.mockReturnValue({
        status: 'round_result',
        gameType: 'classic',
        totalScore: 100,
        currentRound: {
          capital: { name: 'Paris' },
          click: { lat: 48, lng: 2 },
          score: 100,
          status: 'completed',
          distance: 5,
        },
      });
      mockContext.game.isLastRound.mockReturnValue(false);
      mockContext.mapSystem.setOnResultContinue.mockImplementation((cb) =>
        setTimeout(() => cb(), 0)
      );

      const { onRoundEnd } = createRoundLifecycle(mockContext);
      await onRoundEnd();

      expect(mockContext.mapSystem.disableClicks).toHaveBeenCalled();
      expect(mockContext.inputSystem.disableMapInput).toHaveBeenCalled();
    });
  });

  describe('handleMapClick', () => {
    it('should not process click when status is not PLAYING', async () => {
      mockContext.stateManager.getState.mockReturnValue({
        status: 'round_result',
        gameType: 'classic',
      });

      const { handleMapClick } = createRoundLifecycle(mockContext);
      await handleMapClick([48.8, 2.3]);

      expect(mockContext.timerSystem.stop).not.toHaveBeenCalled();
      expect(mockContext.mapSystem.disableClicks).not.toHaveBeenCalled();
    });

    it('should stop timer and disable inputs on valid click', async () => {
      const playingState = {
        status: 'playing',
        gameType: 'classic',
        currentRound: { roundId: 1, startTime: 1000 },
        runtimeConfig: { roundCount: 5 },
      };
      const resultState = {
        ...playingState,
        status: 'round_result',
        currentRound: {
          ...playingState.currentRound,
          click: { lat: 48.8, lng: 2.3 },
          score: 3000,
          status: 'completed',
        },
      };

      mockContext.stateManager.getState
        .mockReturnValueOnce(playingState) // initial check in handleMapClick
        .mockReturnValue(resultState); // subsequent calls in onRoundEnd
      mockContext.game.playRound.mockReturnValue(resultState);
      mockContext.game.isLastRound.mockReturnValue(false);
      mockContext.mapSystem.setOnResultContinue.mockImplementation((cb) =>
        setTimeout(() => cb(), 0)
      );

      const { handleMapClick } = createRoundLifecycle(mockContext);
      await handleMapClick([48.8, 2.3]);

      expect(mockContext.timerSystem.stop).toHaveBeenCalled();
      expect(mockContext.mapSystem.disableClicks).toHaveBeenCalled();
      expect(mockContext.inputSystem.disableMapInput).toHaveBeenCalled();
      expect(mockContext.game.playRound).toHaveBeenCalled();
    });

    it('should restore timer if GeoJSON not ready', async () => {
      mockContext.stateManager.getState.mockReturnValue({
        status: 'playing',
        gameType: 'classic',
        currentRound: { roundId: 1 },
        runtimeConfig: { roundCount: 5 },
      });
      mockContext.mapSystem.ensureFullGeoJSONForMode.mockResolvedValue(false);

      const { handleMapClick } = createRoundLifecycle(mockContext);
      await handleMapClick([48.8, 2.3]);

      expect(mockContext.timerSystem.stop).toHaveBeenCalled();
      expect(mockContext.timerSystem.start).toHaveBeenCalled(); // timer restored
      expect(mockContext.game.playRound).not.toHaveBeenCalled();
    });
  });

  describe('handleNext', () => {
    it('should not process if status is not ROUND_RESULT', () => {
      mockContext.stateManager.getState.mockReturnValue({
        status: 'playing',
        gameType: 'classic',
      });

      const { handleNext } = createRoundLifecycle(mockContext);
      handleNext();

      expect(mockContext.ui.hideRoundResult).not.toHaveBeenCalled();
    });

    it('should show game over on last round', () => {
      mockContext.stateManager.getState.mockReturnValue({
        status: 'round_result',
        gameType: 'classic',
        totalScore: 22000,
      });
      mockContext.game.isLastRound.mockReturnValue(true);

      const { handleNext } = createRoundLifecycle(mockContext);
      handleNext();

      expect(mockContext.ui.showGameOver).toHaveBeenCalledWith(22000);
    });

    it('should advance to next round when not last', () => {
      const nextState = {
        status: 'playing',
        gameType: 'classic',
        totalScore: 5000,
        currentRound: { roundId: 2 },
      };
      mockContext.stateManager.getState
        .mockReturnValueOnce({ status: 'round_result', gameType: 'classic', totalScore: 5000 })
        .mockReturnValue(nextState);
      mockContext.game.isLastRound.mockReturnValue(false);
      mockContext.game.nextRound.mockReturnValue(nextState);
      mockContext.game.getCurrentTarget.mockReturnValue({ name: 'London', country: 'UK' });
      mockContext.game.getProgress.mockReturnValue({ current: 2, total: 5 });

      const { handleNext } = createRoundLifecycle(mockContext);
      handleNext();

      expect(mockContext.stateManager.setState).toHaveBeenCalledWith(nextState, 'round:next');
      expect(mockContext.mapSystem.clearMap).toHaveBeenCalled();
    });
  });
});
