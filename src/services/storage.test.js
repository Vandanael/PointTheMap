import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('../storage/StorageManager.js', () => ({
  storageManager: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    autoCleanup: vi.fn(),
  },
  QuotaExceededError: class QuotaExceededError extends Error {
    constructor(message) {
      super(message);
      this.name = 'QuotaExceededError';
    }
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../core/EventBus.js', () => ({
  eventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(),
  },
}));

// Import AFTER mocks
import {
  storage,
  getLastPseudo,
  setLastPseudo,
  getTheme,
  setTheme,
  getRetryQueue,
  saveRetryQueue,
  addToRetryQueue,
  removeFromRetryQueue,
  QuotaExceededError,
  storageManager as mockStorageManager,
} from './storage.js';

import { logger as mockLogger } from '../utils/logger.js';
import { eventBus as mockEventBus } from '../core/EventBus.js';

describe('storage.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageManager.set.mockReturnValue(true);
  });

  describe('storage.get', () => {
    it('should get value from storage', () => {
      mockStorageManager.get.mockReturnValue('test-value');

      const result = storage.get('test-key');

      expect(mockStorageManager.get).toHaveBeenCalledWith('test-key');
      expect(result).toBe('test-value');
    });

    it('should return null for missing keys', () => {
      mockStorageManager.get.mockReturnValue(null);

      const result = storage.get('missing-key');

      expect(result).toBeNull();
    });
  });

  describe('storage.set', () => {
    it('should set value in storage', () => {
      mockStorageManager.set.mockReturnValue(true);

      const result = storage.set('test-key', 'test-value');

      expect(mockStorageManager.set).toHaveBeenCalledWith('test-key', 'test-value');
      expect(result).toBe(true);
    });

    it('should handle quota exceeded error with cleanup', () => {
      mockStorageManager.set
        .mockImplementationOnce(() => {
          throw new QuotaExceededError('Quota exceeded');
        })
        .mockReturnValueOnce(true); // Retry succeeds

      mockStorageManager.autoCleanup.mockReturnValue(1048576); // 1MB freed

      const result = storage.set('test-key', 'test-value');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Storage quota exceeded. Attempting cleanup...'
      );
      expect(mockStorageManager.autoCleanup).toHaveBeenCalledWith(1024 * 1024);
      expect(mockEventBus.emit).toHaveBeenCalledWith('storage:quota-exceeded', expect.any(Object));
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'storage:quota-recovered',
        expect.objectContaining({
          freedBytes: 1048576,
        })
      );
      expect(result).toBe(true);
    });

    it('should emit failure event when cleanup is not enough', () => {
      mockStorageManager.set
        .mockImplementationOnce(() => {
          throw new QuotaExceededError('Quota exceeded');
        })
        .mockReturnValueOnce(false); // Retry fails

      mockStorageManager.autoCleanup.mockReturnValue(1024);

      const result = storage.set('test-key', 'test-value');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'storage:quota-failed',
        expect.objectContaining({
          message: 'Unable to free enough space. Some data may not be saved.',
        })
      );
      expect(result).toBe(false);
    });

    it('should handle retry error after cleanup', () => {
      mockStorageManager.set.mockImplementation(() => {
        throw new QuotaExceededError('Quota exceeded');
      });

      mockStorageManager.autoCleanup.mockReturnValue(1024);

      const result = storage.set('test-key', 'test-value');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save after cleanup',
        expect.any(Error)
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'storage:quota-failed',
        expect.objectContaining({
          message: 'Storage full. Unable to save data.',
        })
      );
      expect(result).toBe(false);
    });

    it('should return false on non-quota errors', () => {
      mockStorageManager.set.mockImplementation(() => {
        throw new Error('Other error');
      });

      const result = storage.set('test-key', 'test-value');

      expect(result).toBe(false);
    });
  });

  describe('getLastPseudo / setLastPseudo', () => {
    it('should get last pseudo', () => {
      mockStorageManager.get.mockReturnValue('TestUser');

      const result = getLastPseudo();

      expect(mockStorageManager.get).toHaveBeenCalledWith('lastPseudo');
      expect(result).toBe('TestUser');
    });

    it('should set last pseudo', () => {
      mockStorageManager.set.mockReturnValue(true);

      const result = setLastPseudo('NewUser');

      expect(mockStorageManager.set).toHaveBeenCalledWith('lastPseudo', 'NewUser');
      expect(result).toBe(true);
    });

    it('should return null when no pseudo is stored', () => {
      mockStorageManager.get.mockReturnValue(null);

      const result = getLastPseudo();

      expect(result).toBeNull();
    });
  });

  describe('getTheme / setTheme', () => {
    it('should get theme', () => {
      mockStorageManager.get.mockReturnValue('light');

      const result = getTheme();

      expect(mockStorageManager.get).toHaveBeenCalledWith('theme');
      expect(result).toBe('light');
    });

    it('should default to dark theme when not set', () => {
      mockStorageManager.get.mockReturnValue(null);

      const result = getTheme();

      expect(result).toBe('dark');
    });

    it('should set theme', () => {
      mockStorageManager.set.mockReturnValue(true);

      const result = setTheme('light');

      expect(mockStorageManager.set).toHaveBeenCalledWith('theme', 'light');
      expect(result).toBe(true);
    });
  });

  describe('getRetryQueue', () => {
    it('should get retry queue', () => {
      const mockQueue = [{ token: 'token1', rounds: [], pseudo: 'User1', gameType: 'classic' }];

      mockStorageManager.get.mockReturnValue(mockQueue);

      const result = getRetryQueue();

      expect(mockStorageManager.get).toHaveBeenCalledWith('retry_queue');
      expect(result).toEqual(mockQueue);
    });

    it('should return empty array when no queue exists', () => {
      mockStorageManager.get.mockReturnValue(null);

      const result = getRetryQueue();

      expect(result).toEqual([]);
    });

    it('should handle corrupted queue data', () => {
      mockStorageManager.get.mockImplementation(() => {
        throw new Error('JSON parse error');
      });

      const result = getRetryQueue();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Erreur parsing retry queue:',
        expect.any(Error)
      );
      expect(mockStorageManager.remove).toHaveBeenCalledWith('retry_queue');
      expect(result).toEqual([]);
    });

    it('should handle remove failure (iOS private mode)', () => {
      mockStorageManager.get.mockImplementation(() => {
        throw new Error('JSON parse error');
      });
      mockStorageManager.remove.mockImplementation(() => {
        throw new Error('Cannot remove in private mode');
      });

      const result = getRetryQueue();

      expect(result).toEqual([]);
      // Should not throw
    });
  });

  describe('saveRetryQueue', () => {
    it('should save retry queue', () => {
      const mockQueue = [{ token: 'token1', rounds: [], pseudo: 'User1', gameType: 'classic' }];

      mockStorageManager.set.mockReturnValue(true);

      const result = saveRetryQueue(mockQueue);

      expect(mockStorageManager.set).toHaveBeenCalledWith('retry_queue', mockQueue);
      expect(result).toBe(true);
    });

    it('should handle quota exceeded with cleanup', () => {
      const mockQueue = [{ token: 'token1', rounds: [], pseudo: 'User1' }];

      mockStorageManager.set
        .mockImplementationOnce(() => {
          throw new QuotaExceededError('Quota exceeded');
        })
        .mockReturnValueOnce(true); // Retry succeeds

      mockStorageManager.autoCleanup.mockReturnValue(524288); // 512KB freed

      const result = saveRetryQueue(mockQueue);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Quota exceeded while saving retry queue. Attempting cleanup...'
      );
      expect(mockStorageManager.autoCleanup).toHaveBeenCalledWith(512 * 1024);
      expect(result).toBe(true);
    });

    it('should return false when retry fails after cleanup', () => {
      const mockQueue = [{ token: 'token1', rounds: [], pseudo: 'User1' }];

      mockStorageManager.set.mockImplementation(() => {
        throw new QuotaExceededError('Quota exceeded');
      });

      mockStorageManager.autoCleanup.mockReturnValue(1024);

      const result = saveRetryQueue(mockQueue);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save retry queue after cleanup',
        expect.any(Error)
      );
      expect(result).toBe(false);
    });

    it('should handle iOS private mode (non-quota error)', () => {
      const mockQueue = [{ token: 'token1', rounds: [], pseudo: 'User1' }];

      mockStorageManager.set.mockImplementation(() => {
        throw new Error('setItem failed (private mode)');
      });

      const result = saveRetryQueue(mockQueue);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Impossible de sauvegarder la retry queue (iOS Private Mode?)',
        expect.any(Error)
      );
      expect(result).toBe(false);
    });
  });

  describe('addToRetryQueue', () => {
    it('should add entry to retry queue', () => {
      const mockQueue = [];
      mockStorageManager.get.mockReturnValue(mockQueue);
      mockStorageManager.set.mockReturnValue(true);

      const result = addToRetryQueue(
        'test-token',
        [{ capital: { name: 'Paris' }, click: null, score: 0 }],
        'TestUser',
        'classic'
      );

      expect(mockStorageManager.set).toHaveBeenCalledWith(
        'retry_queue',
        expect.arrayContaining([
          expect.objectContaining({
            token: 'test-token',
            pseudo: 'TestUser',
            gameType: 'classic',
            attempts: 0,
          }),
        ])
      );
      expect(result).toBe(true);
    });

    it('should default to classic game type', () => {
      mockStorageManager.get.mockReturnValue([]);
      mockStorageManager.set.mockReturnValue(true);

      addToRetryQueue('test-token', [], 'TestUser');

      const savedQueue = mockStorageManager.set.mock.calls[0][1];
      expect(savedQueue[0].gameType).toBe('classic');
    });

    it('should include timestamp', () => {
      mockStorageManager.get.mockReturnValue([]);
      mockStorageManager.set.mockReturnValue(true);

      const before = Date.now();
      addToRetryQueue('test-token', [], 'TestUser');
      const after = Date.now();

      const savedQueue = mockStorageManager.set.mock.calls[0][1];
      expect(savedQueue[0].addedAt).toBeGreaterThanOrEqual(before);
      expect(savedQueue[0].addedAt).toBeLessThanOrEqual(after);
    });

    it('should initialize attempts to 0', () => {
      mockStorageManager.get.mockReturnValue([]);
      mockStorageManager.set.mockReturnValue(true);

      addToRetryQueue('test-token', [], 'TestUser');

      const savedQueue = mockStorageManager.set.mock.calls[0][1];
      expect(savedQueue[0].attempts).toBe(0);
    });

    it('should warn when save fails', () => {
      mockStorageManager.get.mockReturnValue([]);
      mockStorageManager.set.mockReturnValue(false);

      const result = addToRetryQueue('test-token', [], 'TestUser');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️ Retry queue non sauvegardée (mode privé iOS?)'
      );
      expect(result).toBe(false);
    });

    it('should append to existing queue', () => {
      const existingQueue = [{ token: 'token1', rounds: [], pseudo: 'User1', gameType: 'classic' }];

      mockStorageManager.get.mockReturnValue(existingQueue);
      mockStorageManager.set.mockReturnValue(true);

      addToRetryQueue('token2', [], 'User2');

      const savedQueue = mockStorageManager.set.mock.calls[0][1];
      expect(savedQueue).toHaveLength(2);
      expect(savedQueue[0].token).toBe('token1');
      expect(savedQueue[1].token).toBe('token2');
    });
  });

  describe('removeFromRetryQueue', () => {
    it('should remove entry from retry queue', () => {
      const mockQueue = [
        { token: 'token1', rounds: [], pseudo: 'User1' },
        { token: 'token2', rounds: [], pseudo: 'User2' },
        { token: 'token3', rounds: [], pseudo: 'User3' },
      ];

      mockStorageManager.get.mockReturnValue(mockQueue);
      mockStorageManager.set.mockReturnValue(true);

      const result = removeFromRetryQueue(1);

      expect(mockStorageManager.set).toHaveBeenCalledWith('retry_queue', [
        { token: 'token1', rounds: [], pseudo: 'User1' },
        { token: 'token3', rounds: [], pseudo: 'User3' },
      ]);
      expect(result).toBe(true);
    });

    it('should remove first entry', () => {
      const mockQueue = [
        { token: 'token1', rounds: [], pseudo: 'User1' },
        { token: 'token2', rounds: [], pseudo: 'User2' },
      ];

      mockStorageManager.get.mockReturnValue(mockQueue);
      mockStorageManager.set.mockReturnValue(true);

      removeFromRetryQueue(0);

      const savedQueue = mockStorageManager.set.mock.calls[0][1];
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].token).toBe('token2');
    });

    it('should remove last entry', () => {
      const mockQueue = [
        { token: 'token1', rounds: [], pseudo: 'User1' },
        { token: 'token2', rounds: [], pseudo: 'User2' },
      ];

      mockStorageManager.get.mockReturnValue(mockQueue);
      mockStorageManager.set.mockReturnValue(true);

      removeFromRetryQueue(1);

      const savedQueue = mockStorageManager.set.mock.calls[0][1];
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].token).toBe('token1');
    });

    it('should return false when save fails', () => {
      const mockQueue = [{ token: 'token1', rounds: [], pseudo: 'User1' }];

      mockStorageManager.get.mockReturnValue(mockQueue);
      mockStorageManager.set.mockReturnValue(false);

      const result = removeFromRetryQueue(0);

      expect(result).toBe(false);
    });

    it('should handle empty queue', () => {
      mockStorageManager.get.mockReturnValue([]);
      mockStorageManager.set.mockReturnValue(true);

      removeFromRetryQueue(0);

      const savedQueue = mockStorageManager.set.mock.calls[0][1];
      expect(savedQueue).toEqual([]);
    });
  });

  describe('Integration: Retry queue workflow', () => {
    it('should handle full workflow: add, get, remove', () => {
      let queue = [];

      // Mock storageManager to use our local queue
      mockStorageManager.get.mockImplementation(() => [...queue]);
      mockStorageManager.set.mockImplementation((key, value) => {
        queue = value;
        return true;
      });

      // Add first entry
      addToRetryQueue('token1', [], 'User1');
      expect(queue).toHaveLength(1);

      // Add second entry
      addToRetryQueue('token2', [], 'User2');
      expect(queue).toHaveLength(2);

      // Get queue
      const retrieved = getRetryQueue();
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].token).toBe('token1');
      expect(retrieved[1].token).toBe('token2');

      // Remove first entry
      removeFromRetryQueue(0);
      expect(queue).toHaveLength(1);
      expect(queue[0].token).toBe('token2');

      // Remove last entry
      removeFromRetryQueue(0);
      expect(queue).toHaveLength(0);
    });
  });
});
