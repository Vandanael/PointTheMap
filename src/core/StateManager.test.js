import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from './StateManager.js';
import { eventBus } from './EventBus.js';

describe('StateManager', () => {
  let stateManager;

  beforeEach(() => {
    stateManager = new StateManager({ count: 0, name: 'test' });
    eventBus.clear(); // Clear event bus between tests
  });

  describe('Basic operations', () => {
    it('should return current state', () => {
      expect(stateManager.getState()).toEqual({ count: 0, name: 'test' });
    });

    it('should update state with new object', () => {
      const newState = { count: 1, name: 'updated' };
      const result = stateManager.setState(newState, 'increment');

      expect(result).toEqual(newState);
      expect(stateManager.getState()).toEqual(newState);
    });

    it('should update state with updater function', () => {
      const result = stateManager.setState(
        (prev) => ({ ...prev, count: prev.count + 1 }),
        'increment'
      );

      expect(result).toEqual({ count: 1, name: 'test' });
      expect(stateManager.getState()).toEqual({ count: 1, name: 'test' });
    });

    it('should return new state from setState', () => {
      const newState = { count: 5, name: 'test' };
      const result = stateManager.setState(newState);

      expect(result).toBe(stateManager.getState());
    });
  });

  describe('Immutability', () => {
    it('should not mutate old state', () => {
      const oldState = stateManager.getState();
      stateManager.setState({ count: 1, name: 'updated' });

      expect(oldState).toEqual({ count: 0, name: 'test' });
    });

    it('should preserve immutability with updater function', () => {
      const oldState = stateManager.getState();
      stateManager.setState((prev) => {
        prev.count = 100; // Try to mutate (bad practice but should not affect old state)
        return { ...prev };
      });

      // Old state should still be unchanged in our reference
      expect(oldState).toEqual({ count: 0, name: 'test' });
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers on state change', () => {
      const callback = vi.fn();
      stateManager.subscribe(callback);

      const newState = { count: 1, name: 'test' };
      stateManager.setState(newState, 'update');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        newState,
        { count: 0, name: 'test' },
        'update'
      );
    });

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      stateManager.subscribe(callback1);
      stateManager.subscribe(callback2);

      stateManager.setState({ count: 1, name: 'test' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = stateManager.subscribe(callback);

      stateManager.setState({ count: 1, name: 'test' });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      stateManager.setState({ count: 2, name: 'test' });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should isolate subscriber errors', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const successCallback = vi.fn();

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      stateManager.subscribe(errorCallback);
      stateManager.subscribe(successCallback);

      stateManager.setState({ count: 1, name: 'test' });

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it('should throw error for invalid callback', () => {
      expect(() => {
        stateManager.subscribe('not a function');
      }).toThrow('Callback must be a function');
    });
  });

  describe('Validation', () => {
    it('should validate state on update', () => {
      stateManager.registerValidator('count', (value) => {
        if (typeof value !== 'number') return 'count must be a number';
        if (value < 0) return 'count cannot be negative';
        return true;
      });

      expect(() => {
        stateManager.setState({ count: -5, name: 'test' });
      }).toThrow('count cannot be negative');
    });

    it('should pass validation for valid state', () => {
      stateManager.registerValidator('count', (value) => {
        return typeof value === 'number' && value >= 0 ? true : 'Invalid count';
      });

      expect(() => {
        stateManager.setState({ count: 5, name: 'test' });
      }).not.toThrow();
    });

    it('should support multiple validators', () => {
      stateManager.registerValidator('count', (value) => {
        return typeof value === 'number' || 'count must be a number';
      });

      stateManager.registerValidator('name', (value) => {
        return typeof value === 'string' || 'name must be a string';
      });

      expect(() => {
        stateManager.setState({ count: 'invalid', name: 'test' });
      }).toThrow('count must be a number');
    });

    it('should handle nested path validation', () => {
      stateManager = new StateManager({ user: { age: 25 } });

      stateManager.registerValidator('user.age', (value) => {
        return (typeof value === 'number' && value >= 0) || 'Invalid age';
      });

      expect(() => {
        stateManager.setState({ user: { age: -5 } });
      }).toThrow('Invalid age');

      expect(() => {
        stateManager.setState({ user: { age: 30 } });
      }).not.toThrow();
    });

    it('should throw error for invalid validator', () => {
      expect(() => {
        stateManager.registerValidator('count', 'not a function');
      }).toThrow('Validator must be a function');
    });

    it('should provide access to full state in validator', () => {
      const validator = vi.fn(() => true);
      stateManager.registerValidator('count', validator);

      const newState = { count: 5, name: 'test' };
      stateManager.setState(newState, 'update');

      expect(validator).toHaveBeenCalledWith(
        5,
        newState,
        { count: 0, name: 'test' }
      );
    });
  });

  describe('History', () => {
    it('should track state history', () => {
      stateManager.setState({ count: 1, name: 'test' }, 'increment');
      stateManager.setState({ count: 2, name: 'test' }, 'increment');

      const history = stateManager.getHistory();

      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('increment');
      expect(history[0].state).toEqual({ count: 1, name: 'test' });
      expect(history[1].state).toEqual({ count: 2, name: 'test' });
    });

    it('should limit history size to 50 entries', () => {
      for (let i = 1; i <= 60; i++) {
        stateManager.setState({ count: i, name: 'test' }, `update-${i}`);
      }

      const history = stateManager.getHistory();
      expect(history).toHaveLength(50);
      expect(history[0].state.count).toBe(11); // First 10 entries should be removed
      expect(history[49].state.count).toBe(60);
    });

    it('should include timestamp in history', () => {
      const before = Date.now();
      stateManager.setState({ count: 1, name: 'test' });
      const after = Date.now();

      const history = stateManager.getHistory();
      expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(history[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should clear history', () => {
      stateManager.setState({ count: 1, name: 'test' });
      stateManager.setState({ count: 2, name: 'test' });

      expect(stateManager.getHistory()).toHaveLength(2);

      stateManager.clearHistory();

      expect(stateManager.getHistory()).toHaveLength(0);
    });

    it('should restore state from history', () => {
      stateManager.setState({ count: 1, name: 'test' }, 'update-1');
      stateManager.setState({ count: 2, name: 'test' }, 'update-2');
      stateManager.setState({ count: 3, name: 'test' }, 'update-3');

      stateManager.restoreFromHistory(1); // Restore to count: 2

      expect(stateManager.getState()).toEqual({ count: 2, name: 'test' });
    });

    it('should throw error for invalid history index', () => {
      stateManager.setState({ count: 1, name: 'test' });

      expect(() => {
        stateManager.restoreFromHistory(-1);
      }).toThrow('Invalid history index: -1');

      expect(() => {
        stateManager.restoreFromHistory(10);
      }).toThrow('Invalid history index: 10');
    });

    it('should return immutable history', () => {
      stateManager.setState({ count: 1, name: 'test' });

      const history1 = stateManager.getHistory();
      const history2 = stateManager.getHistory();

      expect(history1).not.toBe(history2); // Different array instances
      expect(history1).toEqual(history2); // But same content
    });
  });

  describe('Subscriber notification shape', () => {
    it('should pass (newState, prevState, action) to subscribers', () => {
      const callback = vi.fn();
      stateManager.subscribe(callback);

      const newState = { count: 1, name: 'test' };
      stateManager.setState(newState, 'increment');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(newState, { count: 0, name: 'test' }, 'increment');
    });

    it('should pass custom action name to subscribers', () => {
      const callback = vi.fn();
      stateManager.subscribe(callback);

      stateManager.setState({ count: 1, name: 'test' }, 'custom-action');

      expect(callback).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'custom-action');
    });
  });

  describe('Edge cases', () => {
    it('should handle null state', () => {
      const manager = new StateManager(null);
      expect(manager.getState()).toBeNull();

      manager.setState({ value: 1 });
      expect(manager.getState()).toEqual({ value: 1 });
    });

    it('should handle undefined state', () => {
      const manager = new StateManager(undefined);
      expect(manager.getState()).toBeUndefined();
    });

    it('should handle primitive state', () => {
      const manager = new StateManager(42);
      expect(manager.getState()).toBe(42);

      manager.setState(100);
      expect(manager.getState()).toBe(100);
    });

    it('should handle array state', () => {
      const manager = new StateManager([1, 2, 3]);
      expect(manager.getState()).toEqual([1, 2, 3]);

      manager.setState([4, 5, 6]);
      expect(manager.getState()).toEqual([4, 5, 6]);
    });

    it('should default action name to "unknown"', () => {
      const callback = vi.fn();
      stateManager.subscribe(callback);

      stateManager.setState({ count: 1, name: 'test' });

      expect(callback).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'unknown');
    });
  });
});
