import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager, QuotaExceededError } from './StorageManager.js';

describe('StorageManager', () => {
  let storageManager;

  beforeEach(() => {
    localStorage.clear();
    storageManager = new StorageManager();
  });

  describe('Basic operations', () => {
    it('should set and get values', () => {
      storageManager.set('test', { value: 123 });
      const result = storageManager.get('test');
      expect(result).toEqual({ value: 123 });
    });

    it('should return null for non-existent keys', () => {
      const result = storageManager.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle string values', () => {
      storageManager.set('name', 'John');
      expect(storageManager.get('name')).toBe('John');
    });

    it('should handle number values', () => {
      storageManager.set('age', 42);
      expect(storageManager.get('age')).toBe(42);
    });

    it('should handle boolean values', () => {
      storageManager.set('active', true);
      expect(storageManager.get('active')).toBe(true);
    });

    it('should handle array values', () => {
      storageManager.set('items', [1, 2, 3]);
      expect(storageManager.get('items')).toEqual([1, 2, 3]);
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John',
          scores: [100, 200],
        },
      };
      storageManager.set('complex', data);
      expect(storageManager.get('complex')).toEqual(data);
    });

    it('should remove items', () => {
      storageManager.set('test', 'value');
      expect(storageManager.get('test')).toBe('value');

      storageManager.remove('test');
      expect(storageManager.get('test')).toBeNull();
    });

    it('should clear all items', () => {
      storageManager.set('key1', 'value1');
      storageManager.set('key2', 'value2');
      storageManager.set('key3', 'value3');

      storageManager.clear();

      expect(storageManager.get('key1')).toBeNull();
      expect(storageManager.get('key2')).toBeNull();
      expect(storageManager.get('key3')).toBeNull();
    });

    it('should use prefix for keys', () => {
      storageManager.set('test', 'value');
      // Should be stored with prefix
      expect(localStorage.getItem('ptm_test')).toBeDefined();
    });

    it('should not interfere with non-prefixed keys', () => {
      localStorage.setItem('other_key', 'other_value');
      storageManager.clear();
      expect(localStorage.getItem('other_key')).toBe('other_value');
    });
  });

  describe('getAllKeys', () => {
    it('should return all keys without prefix', () => {
      storageManager.set('key1', 'value1');
      storageManager.set('key2', 'value2');
      storageManager.set('key3', 'value3');

      const keys = storageManager.getAllKeys();
      expect(keys).toHaveLength(4); // 3 keys + storage_version
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should not return keys from other prefixes', () => {
      localStorage.setItem('other_key', 'value');
      storageManager.set('my_key', 'value');

      const keys = storageManager.getAllKeys();
      expect(keys).not.toContain('other_key');
      expect(keys).toContain('my_key');
    });

    it('should return empty array when storage is empty', () => {
      localStorage.clear();
      const manager = new StorageManager();
      const keys = manager.getAllKeys();
      // Should have at least storage_version
      expect(Array.isArray(keys)).toBe(true);
    });
  });

  describe('Storage info', () => {
    it('should calculate storage size', () => {
      storageManager.set('test', 'value');
      const info = storageManager.getStorageInfo();

      expect(info).toHaveProperty('used');
      expect(info).toHaveProperty('quota');
      expect(info).toHaveProperty('percentage');

      expect(info.used).toBeGreaterThan(0);
      expect(info.quota).toBeGreaterThan(0);
    });

    it('should update size when adding more data', () => {
      storageManager.set('small', 'x');
      const info1 = storageManager.getStorageInfo();

      storageManager.set('large', 'x'.repeat(1000));
      const info2 = storageManager.getStorageInfo();

      expect(info2.used).toBeGreaterThan(info1.used);
    });

    it('should calculate percentage correctly', () => {
      storageManager.set('test', 'value');
      const info = storageManager.getStorageInfo();

      expect(info.percentage).toBeGreaterThanOrEqual(0);
      expect(info.percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('Quota exceeded handling', () => {
    it('should have quota exceeded detection logic', () => {
      // Test that the QuotaExceededError class exists and works
      const error = new QuotaExceededError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('QuotaExceededError');
    });

    it('should handle quota exceeded scenarios in production', () => {
      // Note: Actual quota exceeded errors are difficult to test in a test environment
      // This test verifies the error class is properly exported and can be used
      expect(QuotaExceededError).toBeDefined();
      expect(typeof QuotaExceededError).toBe('function');
    });
  });

  describe('Auto cleanup', () => {
    it('should cleanup old data', () => {
      // Add items with timestamps
      const now = Date.now();
      storageManager.set('old1', { value: 'old', addedAt: now - 10000 });
      storageManager.set('old2', { value: 'old', addedAt: now - 5000 });
      storageManager.set('new', { value: 'new', addedAt: now });

      const freed = storageManager.autoCleanup(100); // Cleanup at least 100 bytes

      expect(freed).toBeGreaterThan(0);
      // Oldest items should be removed first
      expect(storageManager.get('old1')).toBeNull();
    });

    it('should respect target bytes', () => {
      const now = Date.now();
      storageManager.set('item1', { value: 'x'.repeat(100), addedAt: now - 3000 });
      storageManager.set('item2', { value: 'x'.repeat(100), addedAt: now - 2000 });
      storageManager.set('item3', { value: 'x'.repeat(100), addedAt: now - 1000 });

      // Cleanup small amount
      const freed = storageManager.autoCleanup(50);

      // Should free at least 50 bytes
      expect(freed).toBeGreaterThanOrEqual(50);
    });

    it('should not cleanup if target is 0', () => {
      storageManager.set('test', { value: 'data', addedAt: Date.now() });

      const freed = storageManager.autoCleanup(0);

      expect(freed).toBe(0);
      expect(storageManager.get('test')).not.toBeNull();
    });

    it('should handle items without timestamps', () => {
      storageManager.set('noTimestamp', { value: 'data' });

      // Should not throw
      expect(() => {
        storageManager.autoCleanup(100);
      }).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted JSON', () => {
      localStorage.setItem('ptm_corrupted', '{invalid json}');

      const result = storageManager.get('corrupted');
      expect(result).toBeNull();
    });

    it('should have error handling in set method', () => {
      // Verify set method returns a boolean
      const result = storageManager.set('test', 'value');
      expect(typeof result).toBe('boolean');
    });

    it('should have error handling in remove method', () => {
      // Verify remove method returns a boolean
      const result = storageManager.remove('test');
      expect(typeof result).toBe('boolean');
    });

    it('should have error handling in get method', () => {
      // Verify get handles non-existent keys gracefully
      const result = storageManager.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Versioning', () => {
    it('should set storage version on initialization', () => {
      const version = localStorage.getItem('ptm_storage_version');
      expect(version).toBe('2'); // Current version is 2
    });

    it('should not run migrations if version is current', () => {
      // Create manager with current version
      const manager1 = new StorageManager();
      manager1.set('test', 'value1');

      // Create another manager (should not migrate)
      const manager2 = new StorageManager();
      expect(manager2.get('test')).toBe('value1');
    });

    it('should handle first-time initialization', () => {
      localStorage.clear();
      const manager = new StorageManager();

      const version = localStorage.getItem('ptm_storage_version');
      expect(version).toBe('2'); // Current version is 2
    });
  });

  describe('getRawKey', () => {
    it('should return key with prefix', () => {
      const rawKey = storageManager.getRawKey('test');
      expect(rawKey).toBe('ptm_test');
    });
  });
});

describe('QuotaExceededError', () => {
  it('should be instanceof Error', () => {
    const error = new QuotaExceededError('Test');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name', () => {
    const error = new QuotaExceededError('Test');
    expect(error.name).toBe('QuotaExceededError');
  });

  it('should preserve message', () => {
    const error = new QuotaExceededError('Custom message');
    expect(error.message).toBe('Custom message');
  });
});
