import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock i18n BEFORE imports
vi.mock('../i18n.js', () => ({
  t: vi.fn((key) => {
    const translations = {
      'error.rateLimit': 'Too many requests',
      'error.serverError': 'Server error',
      'error.connectionFailed': 'Connection failed',
      'error.networkError': 'Network error',
      'error.loadTimeout': 'Load timeout',
      'error.leaderboardUnavailable': 'Leaderboard unavailable',
      'error.submitFailed': 'Submit failed',
      'error.generic': 'An error occurred',
    };
    return translations[key] || key;
  }),
  getLang: vi.fn(() => 'en'),
}));

// Mock EventBus
vi.mock('./EventBus.js', () => ({
  eventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    fatal: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import AFTER mocks
import { errorHandler, APIError, GameError, ValidationError } from './ErrorHandler.js';
import { eventBus } from './EventBus.js';
import { t } from '../i18n.js';

describe('ErrorHandler - getUserFriendlyMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('APIError handling', () => {
    it('should return user-friendly message for APIError with status 429 (rate limit)', () => {
      const error = new APIError('Rate limit exceeded', 429);

      errorHandler.handle(error, 'test-context', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Too many requests',
        error,
        context: 'test-context',
      }));
    });

    it('should return user-friendly message for APIError with status 500 (server error)', () => {
      const error = new APIError('Internal server error', 500);

      errorHandler.handle(error, 'test-context', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Server error',
      }));
    });

    it('should return user-friendly message for APIError with status 0 (connection failed)', () => {
      const error = new APIError('Network error', 0);

      errorHandler.handle(error, 'test-context', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Connection failed',
      }));
    });
  });

  describe('Network and timeout errors', () => {
    it('should return user-friendly message for network errors (fetch failed)', () => {
      const error = new Error('Failed to fetch');

      errorHandler.handle(error, 'test-context', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Connection failed',
      }));
    });

    it('should return user-friendly message for timeout errors', () => {
      const error = new Error('TIMEOUT');

      errorHandler.handle(error, 'test-context', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Load timeout',
      }));
    });

    it('should return user-friendly message for GameError with NETWORK_ERROR code', () => {
      const error = new GameError('Network failed', 'NETWORK_ERROR');

      errorHandler.handle(error, 'test-context', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Network error',
      }));
    });
  });

  describe('Context-specific messages', () => {
    it('should return context-specific message for leaderboard:load context', () => {
      const error = new Error('Generic error');

      errorHandler.handle(error, 'leaderboard:load', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Leaderboard unavailable',
      }));
    });

    it('should return context-specific message for score:submit context', () => {
      const error = new Error('Generic error');

      errorHandler.handle(error, 'score:submit', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Submit failed',
      }));
    });
  });

  describe('Security and technical details', () => {
    it('should not expose technical details in user messages', () => {
      const technicalError = new Error('SQLException: table users not found at line 42');

      errorHandler.handle(technicalError, 'database', { showToUser: true, fatal: false });

      const emitCall = eventBus.emit.mock.calls.find(call => call[0] === 'error:show');
      const message = emitCall[1].message;

      // Should not contain technical details
      expect(message).not.toContain('SQLException');
      expect(message).not.toContain('line 42');
      expect(message).not.toContain('table users');

      // Should be a generic, user-friendly message
      expect(message).toBe('An error occurred');
    });

    it('should preserve ValidationError messages (already user-friendly)', () => {
      const error = new ValidationError('Pseudo must be 3-5 characters', 'pseudo');

      errorHandler.handle(error, 'validation', { showToUser: true, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:show', expect.objectContaining({
        message: 'Pseudo must be 3-5 characters',
      }));
    });
  });

  describe('Error tracking', () => {
    it('should emit error:occurred event for all errors', () => {
      const error = new Error('Test error');

      errorHandler.handle(error, 'test-context', { showToUser: false, fatal: false });

      expect(eventBus.emit).toHaveBeenCalledWith('error:occurred', expect.objectContaining({
        error,
        context: 'test-context',
        fatal: false,
      }));
    });
  });
});
