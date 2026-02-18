import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from './EventBus.js';
import { logger } from '../utils/logger.js';

describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('Basic operations', () => {
    it('should subscribe and emit events', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:event', handler);
      eventBus.emit('test:event', { data: 'test' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should call multiple handlers for the same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('test:event', handler1);
      eventBus.subscribe('test:event', handler2);
      eventBus.emit('test:event');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe handlers', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:event', handler);
      eventBus.unsubscribe('test:event', handler);
      eventBus.emit('test:event');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should return unsubscribe function from subscribe', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('test:event', handler);
      unsubscribe();
      eventBus.emit('test:event');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not throw when unsubscribing non-existent handler', () => {
      const handler = vi.fn();
      expect(() => {
        eventBus.unsubscribe('test:event', handler);
      }).not.toThrow();
    });

    it('should emit without subscribers', () => {
      expect(() => {
        eventBus.emit('test:event', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Once behavior', () => {
    it('should call handler exactly once', () => {
      const handler = vi.fn();
      eventBus.once('test:event', handler);
      eventBus.emit('test:event');
      eventBus.emit('test:event');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should auto-unsubscribe after first call', () => {
      const handler = vi.fn();
      eventBus.once('test:event', handler);
      eventBus.emit('test:event');

      expect(eventBus.listenerCount('test:event')).toBe(0);
    });

    it('should return unsubscribe function from once', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.once('test:event', handler);
      unsubscribe();
      eventBus.emit('test:event');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow manual unsubscribe of once handler', () => {
      const handler = vi.fn();
      eventBus.once('test:event', handler);
      eventBus.unsubscribe('test:event', handler);
      eventBus.emit('test:event');

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Wildcard support', () => {
    it('should match wildcard subscriptions', () => {
      const handler = vi.fn();
      eventBus.subscribe('timer:*', handler);
      eventBus.emit('timer:started');
      eventBus.emit('timer:stopped');

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should match nested wildcards', () => {
      const handler = vi.fn();
      eventBus.subscribe('game:*:completed', handler);
      eventBus.emit('game:round:completed');
      eventBus.emit('game:level:completed');

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should not match partial wildcards', () => {
      const handler = vi.fn();
      eventBus.subscribe('timer:*', handler);
      eventBus.emit('timers:started'); // Different namespace

      expect(handler).not.toHaveBeenCalled();
    });

    it('should call both exact and wildcard handlers', () => {
      const exactHandler = vi.fn();
      const wildcardHandler = vi.fn();
      eventBus.subscribe('timer:started', exactHandler);
      eventBus.subscribe('timer:*', wildcardHandler);
      eventBus.emit('timer:started');

      expect(exactHandler).toHaveBeenCalledTimes(1);
      expect(wildcardHandler).toHaveBeenCalledTimes(1);
    });

    it('should compile wildcard matchers once at subscribe time', () => {
      eventBus.subscribe('timer:*', vi.fn());
      eventBus.subscribe('game:*:completed', vi.fn());

      // @ts-expect-error - internal test hook
      expect(eventBus._wildcardMatchers.size).toBe(2);
      // @ts-expect-error - internal test hook
      expect(typeof eventBus._wildcardMatchers.get('timer:*')).toBe('function');
      // @ts-expect-error - internal test hook
      expect(typeof eventBus._wildcardMatchers.get('game:*:completed')).toBe('function');
    });

    it('should cleanup wildcard matcher when last wildcard listener is removed', () => {
      const handler = vi.fn();
      eventBus.subscribe('timer:*', handler);
      eventBus.unsubscribe('timer:*', handler);

      // @ts-expect-error - internal test hook
      expect(eventBus._wildcardMatchers.has('timer:*')).toBe(false);
    });
  });

  describe('Error isolation', () => {
    it('should continue executing handlers if one throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();

      eventBus.subscribe('test:event', errorHandler);
      eventBus.subscribe('test:event', successHandler);

      // Mock logger.error to avoid noise in test output
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});

      eventBus.emit('test:event');

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(successHandler).toHaveBeenCalledTimes(1);
      expect(loggerError).toHaveBeenCalled();

      loggerError.mockRestore();
    });

    it('should log error details when handler throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Test error');
      });
      const loggerError = vi.spyOn(logger, 'error').mockImplementation(() => {});

      eventBus.subscribe('test:event', errorHandler);
      eventBus.emit('test:event');

      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('EventBus: Error in handler for "test:event"'),
        expect.any(Error)
      );

      loggerError.mockRestore();
    });
  });

  describe('Memory management', () => {
    it('should cleanup empty listener sets after unsubscribe', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:event', handler);
      eventBus.unsubscribe('test:event', handler);

      // Internal listeners map should not have the event anymore
      expect(eventBus.listenerCount('test:event')).toBe(0);
    });

    it('should clear all listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('event1', handler1);
      eventBus.subscribe('event2', handler2);

      eventBus.clear();

      eventBus.emit('event1');
      eventBus.emit('event2');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(eventBus.listenerCount('event1')).toBe(0);
      expect(eventBus.listenerCount('event2')).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should throw for invalid event names', () => {
      expect(() => {
        eventBus.subscribe('', vi.fn());
      }).toThrow('Event name must be a non-empty string');

      expect(() => {
        eventBus.subscribe(null, vi.fn());
      }).toThrow('Event name must be a non-empty string');

      expect(() => {
        eventBus.emit('');
      }).toThrow('Event name must be a non-empty string');
    });

    it('should throw for invalid handlers', () => {
      expect(() => {
        eventBus.subscribe('test:event', null);
      }).toThrow('Handler must be a function');

      expect(() => {
        eventBus.subscribe('test:event', 'not a function');
      }).toThrow('Handler must be a function');

      expect(() => {
        eventBus.once('test:event', null);
      }).toThrow('Handler must be a function');
    });

    it('should handle re-entrance (emit during emit)', () => {
      const handler = vi.fn(() => {
        if (handler.mock.calls.length === 1) {
          eventBus.emit('test:event'); // Re-entrance
        }
      });

      eventBus.subscribe('test:event', handler);
      eventBus.emit('test:event');

      // Should be called twice (initial + re-entrance)
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle unsubscribe during emit', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn(() => {
        eventBus.unsubscribe('test:event', handler1);
      });

      eventBus.subscribe('test:event', handler1);
      eventBus.subscribe('test:event', handler2);

      eventBus.emit('test:event');
      eventBus.emit('test:event');

      // handler1 called once (first emit), handler2 called twice
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(2);
    });
  });

  describe('listenerCount', () => {
    it('should return correct listener count', () => {
      expect(eventBus.listenerCount('test:event')).toBe(0);

      eventBus.subscribe('test:event', vi.fn());
      expect(eventBus.listenerCount('test:event')).toBe(1);

      eventBus.subscribe('test:event', vi.fn());
      expect(eventBus.listenerCount('test:event')).toBe(2);
    });

    it('should return 0 for non-existent events', () => {
      expect(eventBus.listenerCount('non:existent')).toBe(0);
    });
  });

  describe('Data passing', () => {
    it('should pass data to handlers', () => {
      const handler = vi.fn();
      const testData = { value: 42, nested: { data: 'test' } };

      eventBus.subscribe('test:event', handler);
      eventBus.emit('test:event', testData);

      expect(handler).toHaveBeenCalledWith(testData);
    });

    it('should handle undefined data', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:event', handler);
      eventBus.emit('test:event');

      expect(handler).toHaveBeenCalledWith(undefined);
    });

    it('should handle various data types', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:event', handler);

      eventBus.emit('test:event', null);
      expect(handler).toHaveBeenLastCalledWith(null);

      eventBus.emit('test:event', 'string');
      expect(handler).toHaveBeenLastCalledWith('string');

      eventBus.emit('test:event', 42);
      expect(handler).toHaveBeenLastCalledWith(42);

      eventBus.emit('test:event', [1, 2, 3]);
      expect(handler).toHaveBeenLastCalledWith([1, 2, 3]);
    });
  });
});
