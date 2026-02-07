import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createGameState,
  startGame,
  playRound,
  handleTimeout,
  nextRound,
  resetGame,
  getCurrentCapital,
  isLastRound,
  getProgress,
  checkIfNewSessionBest,
  updateSessionBestScore,
  GameStatus,
} from './Game.js';

// Mock dependencies
vi.mock('../services/api.js', () => ({
  api: {
    start: vi.fn(),
  },
}));

vi.mock('./Round.js', () => ({
  createRound: vi.fn((target, roundNumber, gameType = 'capital') => ({
    capital: gameType === 'capital' ? target : null,
    country: gameType === 'country' ? target : null,
    stadium: gameType === 'stadium' ? target : null,
    civilization: gameType === 'civilization' ? target : null,
    roundNumber,
    startTime: Date.now(),
    endTime: null,
    click: null,
    distance: null,
    score: null,
    status: 'playing',
    gameType,
  })),
  recordClick: vi.fn(
    (
      round,
      clickCoords,
      gameMode,
      totalTimeAllowed,
      countryData,
      civilizationData,
      roundRules
    ) => ({
      ...round,
      endTime: Date.now(),
      click: { lat: clickCoords[0], lng: clickCoords[1] },
      distance: 100,
      score: 500,
      status: 'completed',
    })
  ),
  timeoutRound: vi.fn((round) => ({
    ...round,
    endTime: Date.now(),
    distance: null,
    score: 0,
    status: 'timeout',
  })),
}));

vi.mock('../systems/MapSystem.js', () => ({
  mapSystem: {
    getCountryAtLatLng: vi.fn(() => 'FRA'),
    getCountryFeatureById: vi.fn(() => ({
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    })),
    getCivilizationAtLatLng: vi.fn(() => 'roman_empire'),
    getCivilizationFeatureById: vi.fn(() => ({
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    })),
  },
}));

vi.mock('../features/StatsManager.js', () => ({
  getStats: vi.fn(() => ({
    bestScoreClassic: 0,
    bestScoreDaily: 0,
    bestScoreCountry: 0,
    bestScoreCivilization: 0,
  })),
}));

vi.mock('../config/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    GAME: { ...actual.GAME, ROUNDS: 10 },
  };
});

import { api } from '../services/api.js';
import { createRound, recordClick, timeoutRound } from './Round.js';

// Create mock adapters for dependency injection
const mockMapQuery = {
  getCountryAtLatLng: vi.fn(() => 'FRA'),
  getCountryFeatureById: vi.fn(() => ({
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  })),
  getCivilizationAtLatLng: vi.fn(() => 'roman_empire'),
  getCivilizationFeatureById: vi.fn(() => ({
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  })),
};

const mockRoundRules = {
  validateCoordinates: vi.fn(() => ({ valid: true })),
  calculateClickScore: vi.fn(() => ({
    distance: 0,
    score: 5000,
    timeBonus: 0,
    totalScore: 5000,
  })),
  calculateCountryClickScore: vi.fn(() => ({
    distance: 0,
    distanceToCountry: 0,
    score: 5000,
    timeBonus: 0,
    totalScore: 5000,
  })),
};

describe('Game.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGameState', () => {
    it('should create initial game state with correct defaults', () => {
      const state = createGameState();

      expect(state).toEqual({
        status: GameStatus.IDLE,
        token: null,
        targets: [], // Domain model field
        capitals: [],
        countries: [],
        stadiums: [],
        civilizations: [],
        rounds: [],
        currentRoundIndex: 0,
        currentRound: null,
        totalScore: 0,
        pseudo: null,
        result: null,
        error: null,
        sessionBestScore: 0,
        gameType: 'classic',
        runtimeConfig: null,
      });
    });
  });

  describe('startGame', () => {
    it('should start a new game session with classic mode', async () => {
      const mockCapitals = [
        { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
      ];

      api.start.mockResolvedValue({
        token: 'test-token-123',
        capitals: mockCapitals,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'classic');

      expect(api.start).toHaveBeenCalledWith('classic');
      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.token).toBe('test-token-123');
      expect(newState.capitals).toEqual(mockCapitals);
      expect(newState.gameType).toBe('classic');
      expect(newState.currentRound).toBeDefined();
      expect(createRound).toHaveBeenCalledWith(mockCapitals[0], 0, 'capital');
    });

    it('should start a new game session with daily mode', async () => {
      const mockCapitals = [{ name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 }];

      api.start.mockResolvedValue({
        token: 'daily-token',
        capitals: mockCapitals,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'daily');

      expect(api.start).toHaveBeenCalledWith('daily');
      expect(newState.gameType).toBe('daily');
    });

    it('should handle empty capitals array', async () => {
      api.start.mockResolvedValue({
        token: 'test-token',
        capitals: [],
      });

      const initialState = createGameState();
      const newState = await startGame(initialState);

      expect(newState.status).toBe(GameStatus.IDLE);
      expect(newState.error).toBe('error.noTargetsCapitals');
    });

    it('should handle missing capitals', async () => {
      api.start.mockResolvedValue({
        token: 'test-token',
      });

      const initialState = createGameState();
      const newState = await startGame(initialState);

      expect(newState.status).toBe(GameStatus.IDLE);
      expect(newState.error).toBe('error.noTargetsCapitals');
    });

    it('should propagate API error', async () => {
      api.start.mockRejectedValue(new Error('Network error'));

      const initialState = createGameState();
      await expect(startGame(initialState)).rejects.toThrow('Network error');
    });

    it('should default to classic mode when no gameType provided', async () => {
      const mockCapitals = [{ name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 }];

      api.start.mockResolvedValue({
        token: 'test-token',
        capitals: mockCapitals,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState);

      expect(api.start).toHaveBeenCalledWith('classic');
      expect(newState.gameType).toBe('classic');
    });

    it('should start a new game session with country mode and return playable state', async () => {
      const mockCountries = [
        { name: 'France', countryId: 'FRA', popular: true },
        { name: 'Germany', countryId: 'DEU', popular: true },
      ];

      api.start.mockResolvedValue({
        token: 'country-token',
        countries: mockCountries,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'country');

      expect(api.start).toHaveBeenCalledWith('country');
      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.gameType).toBe('country');
      expect(newState.token).toBe('country-token');
      expect(newState.countries).toEqual(mockCountries);
      expect(newState.capitals).toEqual([]);
      expect(newState.currentRound).toBeDefined();
      expect(newState.currentRound.country).toEqual(mockCountries[0]);
      expect(newState.currentRound.capital).toBeNull();
      expect(newState.runtimeConfig).toBeDefined();
      expect(newState.runtimeConfig.roundCount).toBe(5);
    });

    it('should start a new game session with stadium mode', async () => {
      const mockStadiums = [
        { name: 'Stade de France', stadiumId: 'sdf', lat: 48.9244, lng: 2.36, popular: true },
        { name: 'Wembley', stadiumId: 'wem', lat: 51.556, lng: -0.2795, popular: true },
      ];

      api.start.mockResolvedValue({
        token: 'stadium-token',
        stadiums: mockStadiums,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'stadium');

      expect(api.start).toHaveBeenCalledWith('stadium');
      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.gameType).toBe('stadium');
      expect(newState.stadiums).toEqual(mockStadiums);
      expect(newState.currentRound).toBeDefined();
      expect(newState.runtimeConfig).toBeDefined();
    });

    it('should start a new game session with civilization mode', async () => {
      const mockCivilizations = [
        { name: 'Roman Empire', civilizationId: 'roman', popular: true },
        { name: 'Ottoman Empire', civilizationId: 'ottoman', popular: true },
      ];

      api.start.mockResolvedValue({
        token: 'civ-token',
        civilizations: mockCivilizations,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'civilization');

      expect(api.start).toHaveBeenCalledWith('civilization');
      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.gameType).toBe('civilization');
      expect(newState.civilizations).toEqual(mockCivilizations);
      expect(newState.currentRound).toBeDefined();
      expect(newState.runtimeConfig).toBeDefined();
    });

    it('should start a new game session with country_daily mode', async () => {
      const mockCountries = [
        { name: 'Brazil', countryId: 'BRA', popular: true },
        { name: 'Japan', countryId: 'JPN', popular: true },
      ];

      api.start.mockResolvedValue({
        token: 'country-daily-token',
        countries: mockCountries,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'country_daily');

      expect(api.start).toHaveBeenCalledWith('country_daily');
      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.gameType).toBe('country_daily');
      expect(newState.countries).toEqual(mockCountries);
      expect(newState.currentRound).toBeDefined();
    });

    it('should start a new game session with stadium_daily mode', async () => {
      const mockStadiums = [
        { name: 'Camp Nou', stadiumId: 'camp', lat: 41.3809, lng: 2.1228, popular: true },
        { name: 'Old Trafford', stadiumId: 'ot', lat: 53.4631, lng: -2.2913, popular: true },
      ];

      api.start.mockResolvedValue({
        token: 'stadium-daily-token',
        stadiums: mockStadiums,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'stadium_daily');

      expect(api.start).toHaveBeenCalledWith('stadium_daily');
      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.gameType).toBe('stadium_daily');
      expect(newState.stadiums).toEqual(mockStadiums);
      expect(newState.currentRound).toBeDefined();
    });

    it('should start a new game session with civilization_daily mode', async () => {
      const mockCivilizations = [
        { name: 'Mongol Empire', civilizationId: 'mongol', popular: true },
        { name: 'Inca Empire', civilizationId: 'inca', popular: false },
      ];

      api.start.mockResolvedValue({
        token: 'civ-daily-token',
        civilizations: mockCivilizations,
      });

      const initialState = createGameState();
      const newState = await startGame(initialState, 'civilization_daily');

      expect(api.start).toHaveBeenCalledWith('civilization_daily');
      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.gameType).toBe('civilization_daily');
      expect(newState.civilizations).toEqual(mockCivilizations);
      expect(newState.currentRound).toBeDefined();
    });
  });

  describe('playRound', () => {
    it('should process a round with user click', () => {
      const currentRound = {
        capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        roundNumber: 0,
        startTime: Date.now(),
        endTime: null,
        click: null,
        distance: null,
        score: null,
        status: 'playing',
      };

      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        currentRound,
        totalScore: 0,
        rounds: [],
      };

      const clickCoords = [48.8, 2.3];
      const newState = playRound(state, clickCoords, mockMapQuery, mockRoundRules);

      expect(recordClick).toHaveBeenCalledWith(
        currentRound,
        clickCoords,
        state.gameType,
        undefined,
        null,
        null,
        mockRoundRules
      );
      expect(newState.status).toBe(GameStatus.ROUND_RESULT);
      expect(newState.rounds).toHaveLength(1);
      expect(newState.currentRound.status).toBe('completed');
      expect(newState.totalScore).toBe(500); // mocked score
    });

    it('should not process click if status is not PLAYING', () => {
      const state = {
        ...createGameState(),
        status: GameStatus.IDLE,
        currentRound: null,
      };

      const clickCoords = [48.8, 2.3];
      const newState = playRound(state, clickCoords, mockMapQuery, mockRoundRules);

      expect(newState).toBe(state);
      expect(recordClick).not.toHaveBeenCalled();
    });

    it('should not process click if no current round', () => {
      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        currentRound: null,
      };

      const clickCoords = [48.8, 2.3];
      const newState = playRound(state, clickCoords, mockMapQuery, mockRoundRules);

      expect(newState).toBe(state);
      expect(recordClick).not.toHaveBeenCalled();
    });

    it('should accumulate scores across rounds', () => {
      const currentRound = {
        capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        roundNumber: 1,
        startTime: Date.now(),
        endTime: null,
        click: null,
        distance: null,
        score: null,
        status: 'playing',
      };

      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        currentRound,
        totalScore: 1000, // previous rounds
        rounds: [],
      };

      const clickCoords = [48.8, 2.3];
      const newState = playRound(state, clickCoords, mockMapQuery, mockRoundRules);

      expect(newState.totalScore).toBe(1500); // 1000 + 500
    });

    it('should end round with ROUND_RESULT when playing in country mode', () => {
      const country = { name: 'France', countryId: 'FRA', popular: true };
      const currentRound = {
        capital: null,
        country,
        roundNumber: 0,
        startTime: Date.now(),
        endTime: null,
        click: null,
        distance: null,
        score: null,
        status: 'playing',
        gameType: 'country',
      };
      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        gameType: 'country',
        countries: [country],
        currentRound,
        runtimeConfig: { roundCount: 5, timerMs: 5000, graceMs: 500, dangerZoneMs: 1500 },
        rounds: [],
      };

      const newState = playRound(state, [48, 2], mockMapQuery, mockRoundRules);

      expect(newState.status).toBe(GameStatus.ROUND_RESULT);
      expect(newState.rounds).toHaveLength(1);
      expect(newState.currentRound.status).toBe('completed');
      expect(recordClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleTimeout', () => {
    it('should handle round timeout', () => {
      const currentRound = {
        capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        roundNumber: 0,
        startTime: Date.now(),
        endTime: null,
        click: null,
        distance: null,
        score: null,
        status: 'playing',
      };

      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        currentRound,
        rounds: [],
      };

      const newState = handleTimeout(state);

      expect(timeoutRound).toHaveBeenCalledWith(currentRound);
      expect(newState.status).toBe(GameStatus.ROUND_RESULT);
      expect(newState.rounds).toHaveLength(1);
      expect(newState.currentRound.status).toBe('timeout');
      expect(newState.totalScore).toBe(0);
    });

    it('should not handle timeout if status is not PLAYING', () => {
      const state = {
        ...createGameState(),
        status: GameStatus.IDLE,
        currentRound: null,
      };

      const newState = handleTimeout(state);

      expect(newState).toBe(state);
      expect(timeoutRound).not.toHaveBeenCalled();
    });

    it('should not handle timeout if no current round', () => {
      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        currentRound: null,
      };

      const newState = handleTimeout(state);

      expect(newState).toBe(state);
      expect(timeoutRound).not.toHaveBeenCalled();
    });
  });

  describe('nextRound', () => {
    it('should advance to next round', () => {
      const capitals = [
        { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
        { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405 },
      ];

      const state = {
        ...createGameState(),
        status: GameStatus.ROUND_RESULT,
        targets: capitals, // Domain model
        capitals,
        currentRoundIndex: 0,
        rounds: [
          {
            /* completed round */
          },
        ],
      };

      const newState = nextRound(state);

      expect(newState.status).toBe(GameStatus.PLAYING);
      expect(newState.currentRoundIndex).toBe(1);
      expect(createRound).toHaveBeenCalledWith(capitals[1], 1, 'capital');
      expect(newState.currentRound).toBeDefined();
    });

    it('should end game when all rounds are completed', () => {
      const state = {
        ...createGameState(),
        status: GameStatus.ROUND_RESULT,
        currentRoundIndex: 9, // last round (0-indexed, total 10 rounds)
        rounds: Array(10).fill({
          /* completed rounds */
        }),
      };

      const newState = nextRound(state);

      expect(newState.status).toBe(GameStatus.GAME_OVER);
      expect(newState.currentRound).toBeNull();
    });

    it('should transition properly between multiple rounds', () => {
      const capitals = Array(10)
        .fill(null)
        .map((_, i) => ({
          name: `Capital${i}`,
          country: `Country${i}`,
          lat: 48 + i,
          lng: 2 + i,
        }));

      let state = {
        ...createGameState(),
        status: GameStatus.ROUND_RESULT,
        targets: capitals, // Domain model
        capitals,
        currentRoundIndex: 0,
        rounds: [],
      };

      // Advance through several rounds
      for (let i = 0; i < 5; i++) {
        state = nextRound(state);
        expect(state.currentRoundIndex).toBe(i + 1);
        expect(state.status).toBe(GameStatus.PLAYING);
      }
    });
  });

  describe('resetGame', () => {
    it('should reset game to initial state', () => {
      const newState = resetGame();

      expect(newState).toEqual(createGameState());
      expect(newState.status).toBe(GameStatus.IDLE);
      expect(newState.rounds).toEqual([]);
      expect(newState.totalScore).toBe(0);
    });
  });

  describe('getCurrentCapital', () => {
    it('should return current capital from current round', () => {
      const capital = { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 };
      const state = {
        ...createGameState(),
        currentRound: {
          capital,
          roundNumber: 0,
          startTime: Date.now(),
          endTime: null,
          click: null,
          distance: null,
          score: null,
          status: 'playing',
        },
      };

      const result = getCurrentCapital(state);

      expect(result).toEqual(capital);
    });

    it('should return null when no current round', () => {
      const state = {
        ...createGameState(),
        currentRound: null,
      };

      const result = getCurrentCapital(state);

      expect(result).toBeNull();
    });

    it('should return null when current round has no capital', () => {
      const state = {
        ...createGameState(),
        currentRound: {
          roundNumber: 0,
          startTime: Date.now(),
        },
      };

      const result = getCurrentCapital(state);

      expect(result).toBeNull();
    });
  });

  describe('isLastRound', () => {
    it('should return true when on last round', () => {
      const state = {
        ...createGameState(),
        currentRoundIndex: 9, // 10th round (0-indexed)
      };

      expect(isLastRound(state)).toBe(true);
    });

    it('should return false when not on last round', () => {
      const state = {
        ...createGameState(),
        currentRoundIndex: 5,
      };

      expect(isLastRound(state)).toBe(false);
    });

    it('should return false on first round', () => {
      const state = {
        ...createGameState(),
        currentRoundIndex: 0,
      };

      expect(isLastRound(state)).toBe(false);
    });

    it('should handle edge case where index exceeds rounds', () => {
      const state = {
        ...createGameState(),
        currentRoundIndex: 15,
      };

      expect(isLastRound(state)).toBe(true);
    });
  });

  describe('getProgress', () => {
    it('should return correct progress for first round', () => {
      const state = {
        ...createGameState(),
        currentRoundIndex: 0,
      };

      expect(getProgress(state)).toEqual({
        current: 1,
        total: 10,
      });
    });

    it('should return correct progress for middle round', () => {
      const state = {
        ...createGameState(),
        currentRoundIndex: 4,
      };

      expect(getProgress(state)).toEqual({
        current: 5,
        total: 10,
      });
    });

    it('should return correct progress for last round', () => {
      const state = {
        ...createGameState(),
        currentRoundIndex: 9,
      };

      expect(getProgress(state)).toEqual({
        current: 10,
        total: 10,
      });
    });
  });

  describe('checkIfNewSessionBest', () => {
    it('should return true when new score is higher than session best', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 1000,
      };

      expect(checkIfNewSessionBest(state, 1500)).toBe(true);
    });

    it('should return false when new score is lower than session best', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 1000,
      };

      expect(checkIfNewSessionBest(state, 500)).toBe(false);
    });

    it('should return false when new score equals session best', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 1000,
      };

      expect(checkIfNewSessionBest(state, 1000)).toBe(false);
    });

    it('should return true when session best is 0', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 0,
      };

      expect(checkIfNewSessionBest(state, 100)).toBe(true);
    });
  });

  describe('updateSessionBestScore', () => {
    it('should update session best score when new score is higher', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 1000,
      };

      const newState = updateSessionBestScore(state, 1500);

      expect(newState.sessionBestScore).toBe(1500);
    });

    it('should not update session best score when new score is lower', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 1000,
      };

      const newState = updateSessionBestScore(state, 500);

      expect(newState).toBe(state);
      expect(newState.sessionBestScore).toBe(1000);
    });

    it('should not update session best score when new score equals current best', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 1000,
      };

      const newState = updateSessionBestScore(state, 1000);

      expect(newState).toBe(state);
      expect(newState.sessionBestScore).toBe(1000);
    });

    it('should update from 0 to new score', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 0,
      };

      const newState = updateSessionBestScore(state, 500);

      expect(newState.sessionBestScore).toBe(500);
    });

    it('should create new state object when updating', () => {
      const state = {
        ...createGameState(),
        sessionBestScore: 1000,
      };

      const newState = updateSessionBestScore(state, 1500);

      expect(newState).not.toBe(state);
      expect(newState.sessionBestScore).toBe(1500);
    });
  });

  describe('GameStatus constants', () => {
    it('should have correct status values', () => {
      expect(GameStatus.IDLE).toBe('idle');
      expect(GameStatus.LOADING).toBe('loading');
      expect(GameStatus.PLAYING).toBe('playing');
      expect(GameStatus.ROUND_RESULT).toBe('round_result');
      expect(GameStatus.GAME_OVER).toBe('game_over');
    });
  });

  describe('Integration: Full game flow', () => {
    it('should handle complete game flow from start to finish', async () => {
      // Classic mode has 5 rounds (from getRuntimeGameConfig)
      const roundCount = 5;
      const mockCapitals = Array(roundCount)
        .fill(null)
        .map((_, i) => ({
          name: `Capital${i}`,
          country: `Country${i}`,
          lat: 48 + i,
          lng: 2 + i,
        }));

      api.start.mockResolvedValue({
        token: 'test-token',
        capitals: mockCapitals,
      });

      // Start game
      let state = createGameState();
      state = await startGame(state);

      expect(state.status).toBe(GameStatus.PLAYING);
      expect(state.currentRoundIndex).toBe(0);
      expect(state.runtimeConfig?.roundCount).toBe(roundCount);

      // Play all rounds
      for (let i = 0; i < roundCount; i++) {
        expect(state.status).toBe(GameStatus.PLAYING);
        expect(state.currentRoundIndex).toBe(i);

        // Play round with click
        state = playRound(state, [48 + i, 2 + i], mockMapQuery, mockRoundRules);
        expect(state.status).toBe(GameStatus.ROUND_RESULT);

        // Move to next round or game over
        state = nextRound(state);
      }

      expect(state.status).toBe(GameStatus.GAME_OVER);
      expect(state.rounds).toHaveLength(roundCount);
      expect(state.totalScore).toBe(roundCount * 500); // 5 rounds * 500 points
    });

    it('should handle timeout in middle of game', async () => {
      const mockCapitals = Array(10)
        .fill(null)
        .map((_, i) => ({
          name: `Capital${i}`,
          country: `Country${i}`,
          lat: 48 + i,
          lng: 2 + i,
        }));

      api.start.mockResolvedValue({
        token: 'test-token',
        capitals: mockCapitals,
      });

      // Start game
      let state = createGameState();
      state = await startGame(state);

      // Play 3 rounds
      for (let i = 0; i < 3; i++) {
        state = playRound(state, [48 + i, 2 + i], mockMapQuery, mockRoundRules);
        state = nextRound(state);
      }

      // Timeout on 4th round
      state = handleTimeout(state);
      expect(state.status).toBe(GameStatus.ROUND_RESULT);
      expect(state.currentRound.status).toBe('timeout');
      expect(state.totalScore).toBe(1500); // 3 * 500, timeout adds 0

      // Continue playing
      state = nextRound(state);
      expect(state.status).toBe(GameStatus.PLAYING);
    });
  });

  describe('Dependency Injection: Decoupling with fake adapters', () => {
    it('should use injected mapQuery adapter for country lookups', () => {
      const country = { name: 'France', countryId: 'FRA', popular: true };
      const currentRound = {
        capital: null,
        country,
        roundNumber: 0,
        startTime: Date.now(),
        endTime: null,
        click: null,
        distance: null,
        score: null,
        status: 'playing',
        gameType: 'country',
      };

      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        gameType: 'country',
        countries: [country],
        currentRound,
        runtimeConfig: { roundCount: 5, timerMs: 5000, graceMs: 500, dangerZoneMs: 1500 },
        rounds: [],
      };

      // Create fake adapter that tracks calls
      const fakeMapQuery = {
        getCountryAtLatLng: vi.fn(() => 'FRA'),
        getCountryFeatureById: vi.fn(() => ({
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [2, 48],
                [3, 48],
                [3, 49],
                [2, 49],
                [2, 48],
              ],
            ],
          },
        })),
        getCivilizationAtLatLng: vi.fn(),
        getCivilizationFeatureById: vi.fn(),
      };

      playRound(state, [48.5, 2.5], fakeMapQuery, mockRoundRules);

      // Verify Game.js used the injected adapter
      expect(fakeMapQuery.getCountryAtLatLng).toHaveBeenCalledWith([48.5, 2.5]);
      expect(fakeMapQuery.getCountryFeatureById).toHaveBeenCalledWith('FRA');
      expect(fakeMapQuery.getCivilizationAtLatLng).not.toHaveBeenCalled();
    });

    it('should use injected roundRules adapter for scoring', () => {
      const currentRound = {
        capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        roundNumber: 0,
        startTime: Date.now(),
        endTime: null,
        click: null,
        distance: null,
        score: null,
        status: 'playing',
      };

      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        currentRound,
        totalScore: 0,
        rounds: [],
      };

      // Create fake adapter with custom scoring
      const fakeRoundRules = {
        validateCoordinates: vi.fn(() => ({ valid: true })),
        calculateClickScore: vi.fn(() => ({
          distance: 50,
          score: 4500,
          timeBonus: 300,
          totalScore: 4800,
        })),
        calculateCountryClickScore: vi.fn(),
      };

      // Temporarily replace recordClick implementation to use the fake adapter
      const originalRecordClick = recordClick.getMockImplementation();
      recordClick.mockImplementation(
        (
          round,
          clickCoords,
          gameMode,
          totalTimeAllowed,
          countryData,
          civilizationData,
          roundRules
        ) => {
          // Call the fake adapter's method
          const scoreResult = roundRules.calculateClickScore(
            clickCoords,
            [round.capital.lat, round.capital.lng],
            Date.now() - round.startTime,
            gameMode,
            totalTimeAllowed
          );
          return {
            ...round,
            endTime: Date.now(),
            click: { lat: clickCoords[0], lng: clickCoords[1] },
            distance: scoreResult.distance,
            score: scoreResult.totalScore,
            status: 'completed',
          };
        }
      );

      const clickCoords = [48.8, 2.3];
      const newState = playRound(state, clickCoords, mockMapQuery, fakeRoundRules);

      // Verify recordClick received the injected adapter
      expect(recordClick).toHaveBeenCalledWith(
        currentRound,
        clickCoords,
        state.gameType,
        undefined,
        null,
        null,
        fakeRoundRules
      );

      // Restore original mock
      recordClick.mockImplementation(originalRecordClick);
    });

    it('should use injected mapQuery adapter for civilization lookups', () => {
      const civ = { id: 'roman_empire', name: 'Roman Empire', popular: true };
      const currentRound = {
        capital: null,
        country: null,
        civilization: civ,
        roundNumber: 0,
        startTime: Date.now(),
        endTime: null,
        click: null,
        distance: null,
        score: null,
        status: 'playing',
        gameType: 'civilization',
      };

      const state = {
        ...createGameState(),
        status: GameStatus.PLAYING,
        gameType: 'civilization',
        civilizations: [civ],
        currentRound,
        runtimeConfig: { roundCount: 5, timerMs: 5000, graceMs: 500, dangerZoneMs: 1500 },
        rounds: [],
      };

      // Create fake adapter that tracks calls
      const fakeMapQuery = {
        getCountryAtLatLng: vi.fn(),
        getCountryFeatureById: vi.fn(),
        getCivilizationAtLatLng: vi.fn(() => 'roman_empire'),
        getCivilizationFeatureById: vi.fn(() => ({
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [10, 40],
                [15, 40],
                [15, 45],
                [10, 45],
                [10, 40],
              ],
            ],
          },
        })),
      };

      playRound(state, [42.5, 12.5], fakeMapQuery, mockRoundRules);

      // Verify Game.js used the injected adapter for civilization
      expect(fakeMapQuery.getCivilizationAtLatLng).toHaveBeenCalledWith([42.5, 12.5]);
      expect(fakeMapQuery.getCivilizationFeatureById).toHaveBeenCalledWith('roman_empire');
      expect(fakeMapQuery.getCountryAtLatLng).not.toHaveBeenCalled();
    });
  });
});
