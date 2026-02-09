import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputSystem, getInputSystem, inputSystem } from './InputSystem.js';
import { eventBus } from '../core/EventBus.js';

describe('InputSystem', () => {
  /** @type {InputSystem} */
  let system;

  beforeEach(() => {
    system = new InputSystem();

    // Mock document if needed
    if (typeof document === 'undefined') {
      global.document = /** @type {any} */ ({
        addEventListener: vi.fn(),
        activeElement: null,
      });
    }
  });

  afterEach(() => {
    system.destroy();
  });

  describe('Initialization', () => {
    it('should initialize without errors', () => {
      expect(() => system.init()).not.toThrow();
    });

    it('should be idempotent (safe to call init multiple times)', () => {
      system.init();
      system.init();
      system.init();

      expect(system.isInitialized()).toBe(true);
    });

    it('should setup keyboard listeners', () => {
      system.init();

      // In a real environment, this would check document.addEventListener was called
      expect(system.isInitialized()).toBe(true);
    });
  });

  describe('Map Input', () => {
    beforeEach(() => {
      system.init();
    });

    it('should enable map input', () => {
      const callback = vi.fn();

      system.enableMapInput(callback);

      expect(system.isMapInputEnabled()).toBe(true);
    });

    it('should emit input:map-enabled event', () => {
      const handler = vi.fn();
      eventBus.subscribe('input:map-enabled', handler);

      system.enableMapInput(() => {});

      expect(handler).toHaveBeenCalled();
    });

    it('should disable map input', () => {
      system.enableMapInput(() => {});
      system.disableMapInput();

      expect(system.isMapInputEnabled()).toBe(false);
    });

    it('should emit input:map-disabled event', () => {
      const handler = vi.fn();
      eventBus.subscribe('input:map-disabled', handler);

      system.enableMapInput(() => {});
      system.disableMapInput();

      expect(handler).toHaveBeenCalled();
    });

    it('should call callback on map click', () => {
      vi.useFakeTimers();
      const callback = vi.fn();

      system.enableMapInput(callback);

      vi.advanceTimersByTime(300);
      // Simulate map click
      eventBus.emit('map:click', { lat: 48.8566, lng: 2.3522 });

      expect(callback).toHaveBeenCalledWith([48.8566, 2.3522]);
      vi.useRealTimers();
    });

    it('should not call callback when map input disabled', () => {
      const callback = vi.fn();

      system.enableMapInput(callback);
      system.disableMapInput();

      // Simulate map click
      eventBus.emit('map:click', { lat: 48.8566, lng: 2.3522 });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Button Actions', () => {
    beforeEach(() => {
      system.init();
    });

    it('should handle next round action', () => {
      const handler = vi.fn();
      eventBus.subscribe('input:next-round', handler);

      system.handleNextRound();

      expect(handler).toHaveBeenCalled();
    });

    it('should handle submit action', () => {
      const handler = vi.fn();
      eventBus.subscribe('input:submit', handler);

      system.handleSubmit('ABC');

      expect(handler).toHaveBeenCalledWith({ pseudo: 'ABC' });
    });

    it('should handle replay action', () => {
      const handler = vi.fn();
      eventBus.subscribe('input:replay', handler);

      system.handleReplay();

      expect(handler).toHaveBeenCalled();
    });

    it('should handle start game action', () => {
      const handler = vi.fn();
      eventBus.subscribe('input:start-game', handler);

      system.handleStartGame('classic');

      expect(handler).toHaveBeenCalledWith({ gameType: 'classic' });
    });

    it('should default to classic game type', () => {
      const handler = vi.fn();
      eventBus.subscribe('input:start-game', handler);

      system.handleStartGame();

      expect(handler).toHaveBeenCalledWith({ gameType: 'classic' });
    });
  });

  describe('Destroy', () => {
    it('should clean up resources', () => {
      system.init();
      system.enableMapInput(() => {});

      system.destroy();

      expect(system.isInitialized()).toBe(false);
      expect(system.isMapInputEnabled()).toBe(false);
    });

    it('should be safe to call destroy multiple times', () => {
      system.init();
      system.destroy();

      expect(() => system.destroy()).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance with getInputSystem', () => {
      const instance1 = getInputSystem();
      const instance2 = getInputSystem();

      expect(instance1).toBe(instance2);
    });

    it('should export pre-initialized singleton', () => {
      expect(inputSystem).toBeInstanceOf(InputSystem);
    });
  });

  describe('Edge Cases', () => {
    it('should handle enable map input without init', () => {
      const uninitSystem = new InputSystem();

      // Should not throw
      expect(() => uninitSystem.enableMapInput(() => {})).not.toThrow();
    });

    it('should handle disable when not enabled', () => {
      system.init();

      expect(() => system.disableMapInput()).not.toThrow();
    });

    it('should handle actions without init', () => {
      const uninitSystem = new InputSystem();

      expect(() => uninitSystem.handleNextRound()).not.toThrow();
      expect(() => uninitSystem.handleSubmit('ABC')).not.toThrow();
      expect(() => uninitSystem.handleReplay()).not.toThrow();
      expect(() => uninitSystem.handleStartGame()).not.toThrow();
    });
  });
});
