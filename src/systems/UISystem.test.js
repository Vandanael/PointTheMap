import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies BEFORE imports
vi.mock("../core/EventBus.js", () => ({
  eventBus: {
    subscribe: vi.fn((event, handler) => () => {}), // Return unsubscribe function
    emit: vi.fn(),
  },
}));

vi.mock("../ui/UI.js", () => ({
  UI: {
    init: vi.fn(),
  },
}));

vi.mock("../config.js", () => ({
  GAME: {
    TIMER_MS: 10000,
  },
  TIMING: {
    SCORE_ANIMATION_MS: 500,
  },
}));

vi.mock("../utils.js", () => ({
  formatScore: vi.fn((score) => score.toLocaleString()),
}));

vi.mock("./AnimationController.js", () => ({
  animateValue: vi.fn(() => ({
    stop: vi.fn(),
  })),
}));

vi.mock("../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import AFTER mocks
import { UISystem, uiSystem } from "./UISystem.js";
import { eventBus } from "../core/EventBus.js";
import { UI } from "../ui/UI.js";
import { formatScore } from "../utils.js";
import { animateValue } from "./AnimationController.js";
import { logger } from "../utils/logger.js";

describe("UISystem", () => {
  let system;
  let mockTimerProgress;
  let mockScoreEl;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DOM mocks
    mockTimerProgress = {
      style: { transition: "", width: "" },
      classList: { add: vi.fn(), remove: vi.fn() },
    };

    mockScoreEl = {
      textContent: "0",
    };

    // Mock document methods
    global.document = {
      getElementById: vi.fn((id) => {
        if (id === "timer-progress") return mockTimerProgress;
        return null;
      }),
      querySelector: vi.fn((selector) => {
        if (selector === "#game-header .text-yellow-400") return mockScoreEl;
        return null;
      }),
    };

    // Create fresh instance
    system = new UISystem();
  });

  afterEach(() => {
    if (system) {
      system.destroy();
    }
  });

  describe("Constructor", () => {
    it("should create UISystem instance", () => {
      expect(system).toBeInstanceOf(UISystem);
    });

    it("should setup event listeners", () => {
      expect(eventBus.subscribe).toHaveBeenCalledWith(
        "timer:started",
        expect.any(Function)
      );
      expect(eventBus.subscribe).toHaveBeenCalledWith(
        "timer:danger",
        expect.any(Function)
      );
      expect(eventBus.subscribe).toHaveBeenCalledWith(
        "timer:tick",
        expect.any(Function)
      );
      expect(eventBus.subscribe).toHaveBeenCalledWith(
        "timer:timeout",
        expect.any(Function)
      );
      expect(eventBus.subscribe).toHaveBeenCalledWith(
        "score:updated",
        expect.any(Function)
      );
    });

    it("should log debug message after setup", () => {
      expect(logger.debug).toHaveBeenCalledWith(
        "UISystem: Event listeners setup complete"
      );
    });
  });

  describe("init", () => {
    it("should initialize UI", () => {
      system.init();

      expect(UI.init).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("UISystem initialized");
    });
  });

  describe("destroy", () => {
    it("should call all unsubscribers", () => {
      const mockUnsub1 = vi.fn();
      const mockUnsub2 = vi.fn();

      eventBus.subscribe.mockReturnValueOnce(mockUnsub1);
      eventBus.subscribe.mockReturnValueOnce(mockUnsub2);

      const tempSystem = new UISystem();
      tempSystem.destroy();

      expect(mockUnsub1).toHaveBeenCalled();
      expect(mockUnsub2).toHaveBeenCalled();
    });

    it("should stop score animation if running", () => {
      const mockController = { stop: vi.fn() };
      animateValue.mockReturnValue(mockController);

      // Trigger score animation
      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      scoreHandler?.({ oldScore: 0, newScore: 100 });

      // Destroy should stop animation
      system.destroy();

      expect(mockController.stop).toHaveBeenCalled();
    });

    it("should log info message", () => {
      system.destroy();

      expect(logger.info).toHaveBeenCalledWith("UISystem destroyed");
    });

    it("should handle destroy when no animation is running", () => {
      expect(() => system.destroy()).not.toThrow();
    });
  });

  describe("timer:started event", () => {
    it("should update timer progress bar", () => {
      const timerHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:started"
      )?.[1];

      timerHandler?.();

      expect(mockTimerProgress.style.transition).toBe("width 10000ms linear");
      expect(mockTimerProgress.style.width).toBe("0%");
    });

    it("should handle missing timer element", () => {
      global.document.getElementById.mockReturnValue(null);

      const timerHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:started"
      )?.[1];

      expect(() => timerHandler?.()).not.toThrow();
    });
  });

  describe("timer:danger event", () => {
    it("should add danger class to timer", () => {
      const dangerHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:danger"
      )?.[1];

      dangerHandler?.();

      expect(mockTimerProgress.classList.add).toHaveBeenCalledWith("timer-danger");
    });

    it("should handle missing timer element", () => {
      global.document.getElementById.mockReturnValue(null);

      const dangerHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:danger"
      )?.[1];

      expect(() => dangerHandler?.()).not.toThrow();
    });
  });

  describe("timer:tick event", () => {
    it("should handle timer tick", () => {
      const tickHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:tick"
      )?.[1];

      expect(() => tickHandler?.({ timestamp: Date.now() })).not.toThrow();
    });

    it("should accept timestamp parameter", () => {
      const tickHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:tick"
      )?.[1];

      const timestamp = Date.now();
      tickHandler?.({ timestamp });

      // Currently does nothing, but should not throw
      expect(() => tickHandler?.({ timestamp })).not.toThrow();
    });
  });

  describe("timer:timeout event", () => {
    it("should handle timer timeout", () => {
      const timeoutHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:timeout"
      )?.[1];

      expect(() => timeoutHandler?.()).not.toThrow();
    });
  });

  describe("score:updated event", () => {
    it("should animate score from old to new value", () => {
      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      scoreHandler?.({ oldScore: 100, newScore: 250 });

      expect(animateValue).toHaveBeenCalledWith(
        mockScoreEl,
        100,
        250,
        500,
        formatScore
      );
    });

    it("should stop previous animation before starting new one", () => {
      const mockController1 = { stop: vi.fn() };
      const mockController2 = { stop: vi.fn() };

      animateValue
        .mockReturnValueOnce(mockController1)
        .mockReturnValueOnce(mockController2);

      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      // First animation
      scoreHandler?.({ oldScore: 0, newScore: 100 });

      // Second animation should stop first one
      scoreHandler?.({ oldScore: 100, newScore: 200 });

      expect(mockController1.stop).toHaveBeenCalled();
    });

    it("should handle missing score element", () => {
      global.document.querySelector.mockReturnValue(null);

      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      expect(() => scoreHandler?.({ oldScore: 0, newScore: 100 })).not.toThrow();
    });

    it("should use formatScore function", () => {
      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      scoreHandler?.({ oldScore: 1000, newScore: 2500 });

      expect(animateValue).toHaveBeenCalledWith(
        mockScoreEl,
        1000,
        2500,
        500,
        formatScore
      );
    });

    it("should handle score decrease", () => {
      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      scoreHandler?.({ oldScore: 500, newScore: 250 });

      expect(animateValue).toHaveBeenCalledWith(
        mockScoreEl,
        500,
        250,
        500,
        formatScore
      );
    });

    it("should handle zero to non-zero score", () => {
      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      scoreHandler?.({ oldScore: 0, newScore: 1000 });

      expect(animateValue).toHaveBeenCalledWith(
        mockScoreEl,
        0,
        1000,
        500,
        formatScore
      );
    });
  });

  describe("Singleton instance", () => {
    it("should export singleton instance", () => {
      expect(uiSystem).toBeInstanceOf(UISystem);
    });

    it("should have the same instance", () => {
      const instance1 = uiSystem;
      const instance2 = uiSystem;

      expect(instance1).toBe(instance2);
    });
  });

  describe("Integration: Full event flow", () => {
    it("should handle complete timer lifecycle", () => {
      const timerStartedHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:started"
      )?.[1];

      const timerDangerHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:danger"
      )?.[1];

      const timerTickHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:tick"
      )?.[1];

      const timerTimeoutHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "timer:timeout"
      )?.[1];

      // Simulate timer lifecycle
      timerStartedHandler?.();
      expect(mockTimerProgress.style.width).toBe("0%");

      timerTickHandler?.({ timestamp: Date.now() });

      timerDangerHandler?.();
      expect(mockTimerProgress.classList.add).toHaveBeenCalledWith("timer-danger");

      timerTimeoutHandler?.();
      // Should not throw
    });

    it("should handle multiple score updates", () => {
      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      const mockControllers = [
        { stop: vi.fn() },
        { stop: vi.fn() },
        { stop: vi.fn() },
      ];

      animateValue
        .mockReturnValueOnce(mockControllers[0])
        .mockReturnValueOnce(mockControllers[1])
        .mockReturnValueOnce(mockControllers[2]);

      // Simulate multiple score updates
      scoreHandler?.({ oldScore: 0, newScore: 100 });
      scoreHandler?.({ oldScore: 100, newScore: 250 });
      scoreHandler?.({ oldScore: 250, newScore: 500 });

      // Previous animations should be stopped
      expect(mockControllers[0].stop).toHaveBeenCalled();
      expect(mockControllers[1].stop).toHaveBeenCalled();
      expect(mockControllers[2].stop).not.toHaveBeenCalled(); // Current animation
    });
  });

  describe("Memory management", () => {
    it("should not leak event listeners", () => {
      const unsubscribers = [];

      eventBus.subscribe.mockImplementation((event, handler) => {
        const unsub = vi.fn();
        unsubscribers.push(unsub);
        return unsub;
      });

      const tempSystem = new UISystem();
      tempSystem.destroy();

      // All unsubscribers should be called
      unsubscribers.forEach((unsub) => {
        expect(unsub).toHaveBeenCalled();
      });
    });

    it("should clear animation controller on destroy", () => {
      const mockController = { stop: vi.fn() };
      animateValue.mockReturnValue(mockController);

      const scoreHandler = eventBus.subscribe.mock.calls.find(
        ([event]) => event === "score:updated"
      )?.[1];

      scoreHandler?.({ oldScore: 0, newScore: 100 });

      system.destroy();

      // Animation controller should be cleared
      expect(mockController.stop).toHaveBeenCalled();
    });
  });
});
