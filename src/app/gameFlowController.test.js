import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGameFlowController } from './gameFlowController.js';

describe('gameFlowController', () => {
  /** @type {any} */
  let mockDeps;
  /** @type {any} */
  let controller;

  beforeEach(() => {
    mockDeps = {
      stateManager: {
        getState: vi.fn(),
        setState: vi.fn(),
      },
      eventBus: {
        emit: vi.fn(),
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
        hideGameUI: vi.fn(),
        hideGameOver: vi.fn(),
        showFinalResults: vi.fn(),
        showPseudoLockedDialog: vi.fn(),
        showError: vi.fn(),
      },
      game: {
        startGame: vi.fn(),
        playRound: vi.fn(),
        handleTimeout: vi.fn(),
        nextRound: vi.fn(),
        getCurrentTarget: vi.fn(),
        isLastRound: vi.fn(),
        getProgress: vi.fn(),
        checkIfNewSessionBest: vi.fn(),
        updateSessionBestScore: vi.fn(),
        resetGame: vi.fn(),
        GameStatus: {
          IDLE: 'idle',
          LOADING: 'loading',
          PLAYING: 'playing',
          ROUND_RESULT: 'round_result',
          GAME_OVER: 'game_over',
        },
      },
      round: {
        getRemainingTime: vi.fn(),
      },
      api: {
        submitWithRetry: vi.fn(),
      },
      storage: {
        setLastPseudo: vi.fn(),
      },
      stats: {
        updateStats: vi.fn(),
        getStats: vi.fn(),
      },
      achievements: {
        checkAchievements: vi.fn(),
      },
      share: {
        formatShareText: vi.fn(),
        shareGameResults: vi.fn(),
        getDailyNumber: vi.fn(),
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
        getLang: vi.fn(() => 'en'),
      },
      config: {
        TIMING: {
          RESULT_READ_TIME_MS: 2000,
        },
        MAP: {
          CENTER: [0, 0],
          ZOOM: 2,
          EUROPE_CENTER: [50, 10],
          EUROPE_ZOOM: 4,
        },
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
        isDailyVariant: vi.fn((gt) => gt.includes('daily')),
        isCapitalCategory: vi.fn((gt) => gt === 'classic' || gt === 'daily'),
        isStadiumCategory: vi.fn((gt) => gt === 'stadium' || gt === 'stadium_daily'),
        isCountryCategory: vi.fn((gt) => gt === 'country' || gt === 'country_daily'),
        isCivilizationCategory: vi.fn((gt) => gt === 'civilization' || gt === 'civilization_daily'),
      },
    };

    controller = createGameFlowController(mockDeps);
  });

  describe('onRoundEnd branching', () => {
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

      mockDeps.stateManager.getState.mockReturnValue(mockState);
      mockDeps.game.isLastRound.mockReturnValue(false);
      mockDeps.mapSystem.setOnResultContinue.mockImplementation((/** @type {() => void} */ cb) => {
        // Immediately resolve to skip waiting
        setTimeout(() => cb(), 0);
      });

      await controller.onRoundEnd();

      // Should highlight countries, not show markers
      expect(mockDeps.mapSystem.highlightCountries).toHaveBeenCalledWith({
        correctCountryId: 'FRA',
        clickedCountryId: 'ESP',
      });
      expect(mockDeps.mapSystem.getCountryFeatureById).toHaveBeenCalledWith('FRA');
      expect(mockDeps.mapSystem.flyToFeatureBounds).toHaveBeenCalled();
      expect(mockDeps.mapSystem.showRoundResult).not.toHaveBeenCalled();
      expect(mockDeps.ui.showRoundResult).toHaveBeenCalled();
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

      mockDeps.stateManager.getState.mockReturnValue(mockState);
      mockDeps.game.isLastRound.mockReturnValue(false);
      mockDeps.mapSystem.setOnResultContinue.mockImplementation((/** @type {() => void} */ cb) => {
        setTimeout(() => cb(), 0);
      });

      await controller.onRoundEnd();

      // Should highlight civilizations, not show markers
      expect(mockDeps.mapSystem.highlightCivilizations).toHaveBeenCalledWith({
        correctCivilizationId: 'roman_empire',
        clickedCivilizationId: 'ancient_greece',
      });
      expect(mockDeps.mapSystem.getCivilizationFeatureById).toHaveBeenCalledWith('roman_empire');
      expect(mockDeps.mapSystem.flyToFeatureBounds).toHaveBeenCalled();
      expect(mockDeps.mapSystem.showRoundResult).not.toHaveBeenCalled();
      expect(mockDeps.ui.showRoundResult).toHaveBeenCalled();
    });

    it('should handle stadium mode with markers', async () => {
      const mockState = {
        status: 'round_result',
        gameType: 'stadium',
        totalScore: 3500,
        currentRound: {
          stadium: { name: 'Camp Nou', city: 'Barcelona', country: 'Spain', lat: 41.38, lng: 2.12 },
          click: { lat: 41.5, lng: 2.2 },
          distance: 15,
          score: 4500,
          status: 'completed',
        },
      };

      mockDeps.stateManager.getState.mockReturnValue(mockState);
      mockDeps.game.isLastRound.mockReturnValue(false);
      mockDeps.mapSystem.setOnResultContinue.mockImplementation((/** @type {() => void} */ cb) => {
        setTimeout(() => cb(), 0);
      });

      await controller.onRoundEnd();

      // Should show markers and line (skipResultLine=true for stadium)
      expect(mockDeps.mapSystem.showRoundResult).toHaveBeenCalledWith(
        [41.5, 2.2],
        [41.38, 2.12],
        15
      );
      expect(mockDeps.mapSystem.highlightCountries).not.toHaveBeenCalled();
      expect(mockDeps.ui.showRoundResult).toHaveBeenCalled();
    });

    it('should handle capital mode with markers', async () => {
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

      mockDeps.stateManager.getState.mockReturnValue(mockState);
      mockDeps.game.isLastRound.mockReturnValue(false);
      mockDeps.mapSystem.setOnResultContinue.mockImplementation((/** @type {() => void} */ cb) => {
        setTimeout(() => cb(), 0);
      });

      await controller.onRoundEnd();

      // Should show markers and line (skipResultLine=true for capital)
      expect(mockDeps.mapSystem.showRoundResult).toHaveBeenCalledWith(
        [48.9, 2.4],
        [48.85, 2.35],
        8
      );
      expect(mockDeps.ui.showRoundResult).toHaveBeenCalled();
    });

    it('should handle timeout with no click - country mode', async () => {
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

      mockDeps.stateManager.getState.mockReturnValue(mockState);
      mockDeps.game.isLastRound.mockReturnValue(false);
      mockDeps.mapSystem.setOnResultContinue.mockImplementation((/** @type {() => void} */ cb) => {
        setTimeout(() => cb(), 0);
      });

      await controller.onRoundEnd();

      // Should highlight only the correct country
      expect(mockDeps.mapSystem.highlightCountries).toHaveBeenCalledWith({
        correctCountryId: 'DEU',
        clickedCountryId: null,
      });
      expect(mockDeps.mapSystem.getCountryFeatureById).toHaveBeenCalledWith('DEU');
      expect(mockDeps.mapSystem.flyToFeatureBounds).toHaveBeenCalled();
      expect(mockDeps.ui.showRoundResult).toHaveBeenCalledWith(
        null,
        0,
        true, // timeout
        false,
        undefined,
        undefined
      );
    });

    it('should not process if status is not ROUND_RESULT', async () => {
      const mockState = {
        status: 'playing',
        gameType: 'classic',
        currentRound: null,
      };

      mockDeps.stateManager.getState.mockReturnValue(mockState);

      await controller.onRoundEnd();

      // Should not call any map or UI methods
      expect(mockDeps.mapSystem.highlightCountries).not.toHaveBeenCalled();
      expect(mockDeps.mapSystem.showRoundResult).not.toHaveBeenCalled();
      expect(mockDeps.ui.showRoundResult).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup share button handler', () => {
      controller.cleanup();
      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('resumeFromState', () => {
    it('restores ROUND_RESULT state and shows round result modal', async () => {
      const savedState = {
        status: 'round_result',
        gameType: 'country',
        totalScore: 1200,
        currentRoundIndex: 1,
        rounds: [],
        currentRound: {
          country: { name: 'Germany', countryId: 'DEU' },
          correctCountryId: 'DEU',
          clickedCountryId: 'FRA',
          click: { lat: 48.85, lng: 2.35 },
          distance: 800,
          score: 2200,
          status: 'completed',
        },
      };

      mockDeps.game.getProgress.mockReturnValue({ current: 2, total: 5 });
      mockDeps.game.isLastRound.mockReturnValue(false);

      const result = await controller.resumeFromState(savedState);

      expect(result).toBe(true);
      expect(mockDeps.mapSystem.loadCountriesGeoJSON).toHaveBeenCalled();
      expect(mockDeps.stateManager.setState).toHaveBeenCalledWith(savedState, 'game:resume');
      expect(mockDeps.ui.showGameUI).toHaveBeenCalledWith(2, 5, 1200);
      expect(mockDeps.ui.showRoundResult).toHaveBeenCalledWith(
        800,
        2200,
        false,
        false,
        undefined,
        undefined
      );
    });

    it('restores GAME_OVER state and shows game over screen', async () => {
      const savedState = {
        status: 'game_over',
        gameType: 'classic',
        totalScore: 9000,
        currentRoundIndex: 4,
        rounds: [],
        currentRound: null,
      };

      const result = await controller.resumeFromState(savedState);

      expect(result).toBe(true);
      expect(mockDeps.stateManager.setState).toHaveBeenCalledWith(savedState, 'game:resume');
      expect(mockDeps.ui.showGameOver).toHaveBeenCalledWith(9000);
    });
  });
});
