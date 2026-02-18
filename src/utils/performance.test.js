import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from './performance.js';

describe('Performance Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced();
      debounced();
      debounced();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced('a', 'b', 'c');

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledWith('a', 'b', 'c');
    });

    it('should reset timer on subsequent calls', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced();
      vi.advanceTimersByTime(50);
      debounced();
      vi.advanceTimersByTime(50);

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should call immediately when immediate=true', () => {
      const func = vi.fn();
      const debounced = debounce(func, 100, true);

      debounced();

      expect(func).toHaveBeenCalledTimes(1);

      debounced();
      debounced();

      expect(func).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      debounced();

      expect(func).toHaveBeenCalledTimes(2);
    });

    it('should preserve context', () => {
      let context;
      /** @this {unknown} */
      const func = function () {
        context = this;
      };
      const debounced = debounce(func, 100);

      const obj = { method: debounced };
      obj.method();

      vi.advanceTimersByTime(100);

      expect(context).toBe(obj);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle window resize with debounce', () => {
      const handler = vi.fn();
      const debouncedHandler = debounce(handler, 200);

      // Simulate rapid resize events
      for (let i = 0; i < 10; i++) {
        debouncedHandler();
        vi.advanceTimersByTime(50);
      }

      expect(handler).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle input with debounce for search', () => {
      const searchFunc = vi.fn();
      const debouncedSearch = debounce(searchFunc, 300);

      // User types "hello"
      debouncedSearch('h');
      vi.advanceTimersByTime(50);
      debouncedSearch('he');
      vi.advanceTimersByTime(50);
      debouncedSearch('hel');
      vi.advanceTimersByTime(50);
      debouncedSearch('hell');
      vi.advanceTimersByTime(50);
      debouncedSearch('hello');

      expect(searchFunc).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(searchFunc).toHaveBeenCalledTimes(1);
      expect(searchFunc).toHaveBeenCalledWith('hello');
    });
  });
});
