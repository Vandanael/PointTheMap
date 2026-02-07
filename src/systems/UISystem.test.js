import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies BEFORE imports
vi.mock('../core/EventBus.js', () => ({
  eventBus: {
    subscribe: vi.fn((event, handler) => () => {}), // Return unsubscribe function
    emit: vi.fn(),
  },
}));

vi.mock('@lib/config', () => ({
  GAME: {
    TIMER_MS: 10000,
  },
  TIMING: {
    SCORE_ANIMATION_MS: 500,
  },
}));

vi.mock('../utils/format.js', () => ({
  formatScore: vi.fn((score) => score.toLocaleString()),
}));

vi.mock('./AnimationController.js', () => ({
  animateValue: vi.fn(() => ({
    stop: vi.fn(),
  })),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import AFTER mocks
import { UISystem, getUISystem } from './UISystem.js';
import { eventBus } from '../core/EventBus.js';
import { formatScore } from '../utils/format.js';
import { animateValue } from './AnimationController.js';
import { logger } from '../utils/logger.js';

/** @type {import('vitest').Mock} */
const mockSubscribe = /** @type {any} */ (eventBus.subscribe);
/** @type {import('vitest').Mock} */
const mockAnimateValue = /** @type {any} */ (animateValue);

describe('UISystem', () => {
  /** @type {UISystem} */
  let system;
  /** @type {any} */
  let mockTimerProgress;
  /** @type {any} */
  let mockScoreEl;
  /** @type {import('vitest').Mock} */
  let mockGetElementById;
  /** @type {import('vitest').Mock} */
  let mockQuerySelector;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DOM mocks
    mockTimerProgress = {
      style: { transition: '', width: '' },
      classList: { add: vi.fn(), remove: vi.fn() },
    };

    mockScoreEl = {
      textContent: '0',
      classList: { add: vi.fn(), remove: vi.fn() },
      offsetWidth: 0,
    };

    // Mock document methods
    /** @type {any} */ (global).document = {
      getElementById: vi.fn((id) => {
        if (id === 'timer-progress') return mockTimerProgress;
        return null;
      }),
      querySelector: vi.fn((selector) => {
        if (selector === '#game-header .text-yellow-400') return mockScoreEl;
        return null;
      }),
    };
    mockGetElementById = /** @type {any} */ (global.document.getElementById);
    mockQuerySelector = /** @type {any} */ (global.document.querySelector);

    // Create fresh instance
    system = new UISystem();
  });

  afterEach(() => {
    if (system) {
      system.destroy();
    }
  });

  /** @param {string} eventName */
  const getHandler = (eventName) =>
    mockSubscribe.mock.calls.find((call) => call[0] === eventName)?.[1];

  describe('Constructor', () => {
    it('should create UISystem instance', () => {
      expect(system).toBeInstanceOf(UISystem);
    });

    it('should setup event listeners', () => {
      expect(mockSubscribe).toHaveBeenCalledWith('timer:started', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('timer:danger', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('score:updated', expect.any(Function));
    });

    it('should log debug message after setup', () => {
      expect(logger.debug).toHaveBeenCalledWith('UISystem: Event listeners setup complete');
    });
  });

  describe('init', () => {
    it('should log init', () => {
      system.init();

      expect(logger.info).toHaveBeenCalledWith('UISystem initialized');
    });
  });

  describe('destroy', () => {
    it('should call all unsubscribers', () => {
      const mockUnsub1 = vi.fn();
      const mockUnsub2 = vi.fn();
      const mockUnsub3 = vi.fn();

      mockSubscribe.mockReturnValueOnce(mockUnsub1);
      mockSubscribe.mockReturnValueOnce(mockUnsub2);
      mockSubscribe.mockReturnValueOnce(mockUnsub3);

      const tempSystem = new UISystem();
      tempSystem.destroy();

      expect(mockUnsub1).toHaveBeenCalled();
      expect(mockUnsub2).toHaveBeenCalled();
      expect(mockUnsub3).toHaveBeenCalled();
    });

    it('should stop score animation if running', () => {
      const mockController = { stop: vi.fn() };
      mockAnimateValue.mockReturnValue(mockController);

      // Trigger score animation
      const scoreHandler = getHandler('score:updated');

      scoreHandler?.({ oldScore: 0, newScore: 100 });

      // Destroy should stop animation
      system.destroy();

      expect(mockController.stop).toHaveBeenCalled();
    });

    it('should log info message', () => {
      system.destroy();

      expect(logger.info).toHaveBeenCalledWith('UISystem destroyed');
    });

    it('should handle destroy when no animation is running', () => {
      expect(() => system.destroy()).not.toThrow();
    });
  });

  describe('timer:started event', () => {
    it('should update timer progress bar', () => {
      const timerHandler = getHandler('timer:started');

      timerHandler?.();

      expect(mockTimerProgress.style.transition).toBe('width 10000ms linear');
      expect(mockTimerProgress.style.width).toBe('0%');
    });

    it('should handle missing timer element', () => {
      mockGetElementById.mockReturnValue(null);

      const timerHandler = getHandler('timer:started');

      expect(() => timerHandler?.()).not.toThrow();
    });
  });

  describe('timer:danger event', () => {
    it('should add danger class to timer', () => {
      const dangerHandler = getHandler('timer:danger');

      dangerHandler?.();

      expect(mockTimerProgress.classList.add).toHaveBeenCalledWith('timer-danger');
    });

    it('should handle missing timer element', () => {
      mockGetElementById.mockReturnValue(null);

      const dangerHandler = getHandler('timer:danger');

      expect(() => dangerHandler?.()).not.toThrow();
    });
  });

  describe('score:updated event', () => {
    it('should animate score from old to new value', () => {
      const scoreHandler = mockSubscribe.mock.calls.find(
        ([event]) => event === 'score:updated'
      )?.[1];

      scoreHandler?.({ oldScore: 100, newScore: 250 });

      expect(animateValue).toHaveBeenCalledWith(mockScoreEl, 100, 250, 500, formatScore);
    });

    it('should stop previous animation before starting new one', () => {
      const mockController1 = { stop: vi.fn() };
      const mockController2 = { stop: vi.fn() };

      mockAnimateValue.mockReturnValueOnce(mockController1).mockReturnValueOnce(mockController2);

      const scoreHandler = getHandler('score:updated');

      // First animation
      scoreHandler?.({ oldScore: 0, newScore: 100 });

      // Second animation should stop first one
      scoreHandler?.({ oldScore: 100, newScore: 200 });

      expect(mockController1.stop).toHaveBeenCalled();
    });

    it('should handle missing score element', () => {
      mockQuerySelector.mockReturnValue(null);

      const scoreHandler = getHandler('score:updated');

      expect(() => scoreHandler?.({ oldScore: 0, newScore: 100 })).not.toThrow();
    });

    it('should use formatScore function', () => {
      const scoreHandler = getHandler('score:updated');

      scoreHandler?.({ oldScore: 1000, newScore: 2500 });

      expect(animateValue).toHaveBeenCalledWith(mockScoreEl, 1000, 2500, 500, formatScore);
    });

    it('should handle score decrease', () => {
      const scoreHandler = getHandler('score:updated');

      scoreHandler?.({ oldScore: 500, newScore: 250 });

      expect(animateValue).toHaveBeenCalledWith(mockScoreEl, 500, 250, 500, formatScore);
    });

    it('should handle zero to non-zero score', () => {
      const scoreHandler = getHandler('score:updated');

      scoreHandler?.({ oldScore: 0, newScore: 1000 });

      expect(animateValue).toHaveBeenCalledWith(mockScoreEl, 0, 1000, 500, formatScore);
    });
  });

  describe('Singleton instance', () => {
    it('should export singleton instance', () => {
      expect(getUISystem()).toBeInstanceOf(UISystem);
    });

    it('should have the same instance', () => {
      const instance1 = getUISystem();
      const instance2 = getUISystem();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Integration: Full event flow', () => {
    it('should handle complete timer lifecycle', () => {
      const timerStartedHandler = getHandler('timer:started');

      const timerDangerHandler = getHandler('timer:danger');

      // Simulate timer lifecycle (started -> danger)
      timerStartedHandler?.();
      expect(mockTimerProgress.style.width).toBe('0%');

      timerDangerHandler?.();
      expect(mockTimerProgress.classList.add).toHaveBeenCalledWith('timer-danger');
    });

    it('should handle multiple score updates', () => {
      const scoreHandler = mockSubscribe.mock.calls.find(
        ([event]) => event === 'score:updated'
      )?.[1];

      const mockControllers = [{ stop: vi.fn() }, { stop: vi.fn() }, { stop: vi.fn() }];

      mockAnimateValue
        .mockReturnValueOnce(mockControllers[0])
        .mockReturnValueOnce(mockControllers[1])
        .mockReturnValueOnce(mockControllers[2]);

      // Simulate multiple score updates
      scoreHandler?.({ oldScore: 0, newScore: 100 });
      scoreHandler?.({ oldScore: 100, newScore: 250 });
      scoreHandler?.({ oldScore: 250, newScore: 500 });

      // Previous animations should be stopped
      const [c0, c1, c2] = mockControllers;
      if (!c0 || !c1 || !c2) throw new Error('Expected three animation controllers');
      expect(c0.stop).toHaveBeenCalled();
      expect(c1.stop).toHaveBeenCalled();
      expect(c2.stop).not.toHaveBeenCalled(); // Current animation
    });
  });

  describe('Memory management', () => {
    it('should not leak event listeners', () => {
      /** @type {Array<import('vitest').Mock>} */
      const unsubscribers = [];

      mockSubscribe.mockImplementation(
        (/** @type {string} */ event, /** @type {Function} */ handler) => {
          const unsub = vi.fn();
          unsubscribers.push(unsub);
          return unsub;
        }
      );

      const tempSystem = new UISystem();
      tempSystem.destroy();

      // All unsubscribers should be called
      unsubscribers.forEach((unsub) => {
        expect(unsub).toHaveBeenCalled();
      });
    });

    it('should clear animation controller on destroy', () => {
      const mockController = { stop: vi.fn() };
      mockAnimateValue.mockReturnValue(mockController);

      const scoreHandler = getHandler('score:updated');

      scoreHandler?.({ oldScore: 0, newScore: 100 });

      system.destroy();

      // Animation controller should be cleared
      expect(mockController.stop).toHaveBeenCalled();
    });
  });
});
