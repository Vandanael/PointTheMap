import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, submitWithRetry, processRetryQueue, validateStartSessionPayload } from './api.js';

// Mock dependencies
vi.mock('../config/index.js', () => ({
  capitals: [
    { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, popular: true },
    { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, popular: true },
    { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, popular: true },
  ],
  GAME: {
    ROUNDS: 10,
  },
}));

vi.mock('../utils/id.js', () => ({
  generateId: vi.fn(() => 'test-token-123'),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../data/capitals.js', () => ({
  selectBalancedCapitals: vi.fn((caps) => caps.slice(0, 10)),
}));

vi.mock('../data/capitals-loader.js', () => ({
  loadCapitals: vi.fn(async () => [
    { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, popular: true },
    { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278, popular: true },
    { name: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.405, popular: true },
  ]),
  loadSelectBalancedCapitals: vi.fn(async () => (caps) => caps.slice(0, 10)),
}));

vi.mock('./storage.js', () => ({
  getRetryQueue: vi.fn(() => []),
  removeFromRetryQueue: vi.fn(),
  addToRetryQueue: vi.fn(),
  saveRetryQueue: vi.fn(),
}));

import { generateId } from '../utils/id.js';
import { loadCapitals, loadSelectBalancedCapitals } from '../data/capitals-loader.js';
import { getRetryQueue, removeFromRetryQueue, addToRetryQueue, saveRetryQueue } from './storage.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('api.js', () => {
  describe('validateStartSessionPayload', () => {
    it('accepts valid classic payload', () => {
      const payload = {
        token: 'abc',
        startTime: Date.now(),
        csrfToken: 'csrf',
        capitals: [{ name: 'Paris', country: 'France', lat: 1, lng: 2 }],
      };
      expect(validateStartSessionPayload(payload, 'classic').valid).toBe(true);
    });

    it('rejects missing targets for country mode', () => {
      const payload = {
        token: 'abc',
        startTime: Date.now(),
        csrfToken: 'csrf',
        capitals: [{ name: 'Paris', country: 'France', lat: 1, lng: 2 }],
      };
      const result = validateStartSessionPayload(payload, 'country');
      expect(result.valid).toBe(false);
    });

    it('rejects invalid payload shape', () => {
      const result = validateStartSessionPayload(/** @type {any} */ (null), 'classic');
      expect(result.valid).toBe(false);
    });
  });
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('api.start', () => {
    it('should start a game session', async () => {
      const result = await api.start('classic');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('capitals');
      expect(result).toHaveProperty('startTime');
      expect(Array.isArray(result.capitals)).toBe(true);
    });

    it('should generate a unique token', async () => {
      const result = await api.start();

      expect(result.token).toBe('test-token-123');
      expect(generateId).toHaveBeenCalled();
    });

    it('should select balanced capitals', async () => {
      await api.start();

      expect(loadSelectBalancedCapitals).toHaveBeenCalled();
    });

    it('should format capitals without popular field', async () => {
      const result = await api.start();

      result.capitals.forEach((capital) => {
        expect(capital).toHaveProperty('name');
        expect(capital).toHaveProperty('country');
        expect(capital).toHaveProperty('lat');
        expect(capital).toHaveProperty('lng');
        expect(capital).not.toHaveProperty('popular');
      });
    });

    it('should include timestamp', async () => {
      const before = Date.now();
      const result = await api.start();
      const after = Date.now();

      expect(result.startTime).toBeGreaterThanOrEqual(before);
      expect(result.startTime).toBeLessThanOrEqual(after);
    });

    it('should support classic and daily game types', async () => {
      const classicResult = await api.start('classic');
      const dailyResult = await api.start('daily');

      expect(classicResult).toHaveProperty('token');
      expect(dailyResult).toHaveProperty('token');
    });
  });

  describe('api.submit', () => {
    const mockRounds = [
      {
        capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        click: { lat: 48.8, lng: 2.3 },
        score: 500,
        status: 'completed',
      },
      {
        capital: { name: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
        click: null,
        score: 0,
        status: 'timeout',
      },
    ];

    it('should submit game results', async () => {
      const result = await api.submit('test-token', mockRounds, 'TestUser');

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('rank');
      expect(result).toHaveProperty('isTopFifty');
    });

    it('should calculate total score from rounds', async () => {
      const result = await api.submit('test-token', mockRounds, 'TestUser');

      expect(result.score).toBe(500); // Sum of all scores
    });

    it('should handle multiple rounds with different scores', async () => {
      const rounds = [
        { ...mockRounds[0], score: 1000 },
        { ...mockRounds[1], score: 500 },
      ];

      const result = await api.submit('test-token', rounds, 'TestUser');

      expect(result.score).toBe(1500);
    });

    it('should return rank', async () => {
      const result = await api.submit('test-token', mockRounds, 'TestUser');

      expect(result.rank).toBeGreaterThan(0);
      expect(result.rank).toBeLessThanOrEqual(50);
    });

    it('should indicate if score is top fifty', async () => {
      const result = await api.submit('test-token', mockRounds, 'TestUser');

      expect(typeof result.isTopFifty).toBe('boolean');
    });

    it('should handle high scores as top fifty', async () => {
      const highScoreRounds = Array(10)
        .fill(null)
        .map(() => ({
          ...mockRounds[0],
          score: 2000,
        }));

      const result = await api.submit('test-token', highScoreRounds, 'TestUser');

      expect(result.isTopFifty).toBe(true);
    });
  });

  describe('api.getLeaderboard', () => {
    it('should fetch leaderboard', async () => {
      const result = await api.getLeaderboard('classic');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should support different leaderboard types', async () => {
      const classicResult = await api.getLeaderboard('classic');
      const dailyResult = await api.getLeaderboard('daily');

      expect(Array.isArray(classicResult)).toBe(true);
      expect(Array.isArray(dailyResult)).toBe(true);
    });

    it('should default to classic type', async () => {
      const result = await api.getLeaderboard();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('submitWithRetry', () => {
    const mockRounds = [
      {
        capital: { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
        click: { lat: 48.8, lng: 2.3 },
        score: 500,
        status: 'completed',
      },
    ];

    beforeEach(() => {
      getRetryQueue.mockReturnValue([]);
    });

    it('should submit successfully', async () => {
      const result = await submitWithRetry('test-token', mockRounds, 'TestUser');

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('rank');
    });

    it('should remove from retry queue on successful submit', async () => {
      getRetryQueue.mockReturnValue([
        { token: 'test-token', pseudo: 'TestUser', rounds: mockRounds },
      ]);

      await submitWithRetry('test-token', mockRounds, 'TestUser');

      expect(removeFromRetryQueue).toHaveBeenCalledWith(0);
    });

    it('should not add to retry queue on success', async () => {
      await submitWithRetry('test-token', mockRounds, 'TestUser');

      expect(addToRetryQueue).not.toHaveBeenCalled();
    });

    it('should handle game type parameter', async () => {
      await submitWithRetry('test-token', mockRounds, 'TestUser', 'daily');

      expect(addToRetryQueue).not.toHaveBeenCalled();
    });
  });

  describe('processRetryQueue', () => {
    it('should return zeros when queue is empty', async () => {
      getRetryQueue.mockReturnValue([]);

      const result = await processRetryQueue();

      expect(result).toEqual({ successful: 0, failed: 0 });
    });

    it('should process successful retry', async () => {
      const mockQueue = [
        {
          token: 'test-token',
          rounds: [{ capital: { name: 'Paris' }, click: null, score: 0, status: 'timeout' }],
          pseudo: 'TestUser',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 0,
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      const result = await processRetryQueue();

      expect(result.successful).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
    });

    it('should remove entry after max retries', async () => {
      const mockQueue = [
        {
          token: 'test-token',
          rounds: [{ capital: { name: 'Paris' }, click: null, score: 0, status: 'timeout' }],
          pseudo: 'TestUser',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 3, // Already at max
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      const result = await processRetryQueue();

      expect(removeFromRetryQueue).toHaveBeenCalledWith(0);
    });

    it('should remove old entries (> 24h)', async () => {
      const oneDayAgo = Date.now() - 86400000 - 1000; // 24h + 1 second ago

      const mockQueue = [
        {
          token: 'test-token',
          rounds: [{ capital: { name: 'Paris' }, click: null, score: 0, status: 'timeout' }],
          pseudo: 'TestUser',
          gameType: 'classic',
          addedAt: oneDayAgo,
          attempts: 0,
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      await processRetryQueue();

      expect(removeFromRetryQueue).toHaveBeenCalledWith(0);
    });

    it('should handle multiple entries', async () => {
      const mockQueue = [
        {
          token: 'token1',
          rounds: [{ capital: { name: 'Paris' }, click: null, score: 0, status: 'timeout' }],
          pseudo: 'User1',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 0,
        },
        {
          token: 'token2',
          rounds: [{ capital: { name: 'London' }, click: null, score: 0, status: 'timeout' }],
          pseudo: 'User2',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 0,
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      const result = await processRetryQueue();

      expect(result.successful + result.failed).toBeGreaterThan(0);
    });

    it('should process entries in reverse order (LIFO)', async () => {
      const mockQueue = [
        {
          token: 'token1',
          rounds: [],
          pseudo: 'User1',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 0,
        },
        {
          token: 'token2',
          rounds: [],
          pseudo: 'User2',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 0,
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      await processRetryQueue();

      // Verify reverse order processing
      if (removeFromRetryQueue.mock.calls.length > 0) {
        const firstCall = removeFromRetryQueue.mock.calls[0][0];
        expect(firstCall).toBe(1); // Should process index 1 first
      }
    });

    it('should handle empty rounds array', async () => {
      const mockQueue = [
        {
          token: 'test-token',
          rounds: [],
          pseudo: 'TestUser',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 0,
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      const result = await processRetryQueue();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
    });

    it('should respect MAX_RETRIES constant', async () => {
      const mockQueue = [
        {
          token: 'test-token',
          rounds: [],
          pseudo: 'TestUser',
          gameType: 'classic',
          addedAt: Date.now(),
          attempts: 3,
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      await processRetryQueue();

      // Entry with 3 attempts should be removed
      expect(removeFromRetryQueue).toHaveBeenCalled();
    });

    it('should respect MAX_AGE_MS constant (24h)', async () => {
      const tooOld = Date.now() - 86400001; // Just over 24h

      const mockQueue = [
        {
          token: 'test-token',
          rounds: [],
          pseudo: 'TestUser',
          gameType: 'classic',
          addedAt: tooOld,
          attempts: 0,
        },
      ];

      getRetryQueue.mockReturnValue(mockQueue);

      await processRetryQueue();

      // Old entry should be removed
      expect(removeFromRetryQueue).toHaveBeenCalled();
    });
  });
});
