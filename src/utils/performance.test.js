import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { debounce, throttle, rafThrottle, idle, batch } from "./performance.js";

describe("Performance Utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("debounce", () => {
    it("should debounce function calls", () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced();
      debounced();
      debounced();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(1);
    });

    it("should pass arguments correctly", () => {
      const func = vi.fn();
      const debounced = debounce(func, 100);

      debounced("a", "b", "c");

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledWith("a", "b", "c");
    });

    it("should reset timer on subsequent calls", () => {
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

    it("should call immediately when immediate=true", () => {
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

    it("should preserve context", () => {
      let context;
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

  describe("throttle", () => {
    it("should throttle function calls", () => {
      const func = vi.fn();
      const throttled = throttle(func, 100);

      throttled();
      throttled();
      throttled();

      expect(func).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(2);
    });

    it("should call on leading edge by default", () => {
      const func = vi.fn();
      const throttled = throttle(func, 100);

      throttled();

      expect(func).toHaveBeenCalledTimes(1);
    });

    it("should not call on leading edge when leading=false", () => {
      const func = vi.fn();
      const throttled = throttle(func, 100, { leading: false });

      throttled();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(1);
    });

    it("should not call on trailing edge when trailing=false", () => {
      const func = vi.fn();
      const throttled = throttle(func, 100, { trailing: false });

      throttled();
      expect(func).toHaveBeenCalledTimes(1);

      throttled();
      throttled();

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenCalledTimes(1);
    });

    it("should pass latest arguments", () => {
      const func = vi.fn();
      const throttled = throttle(func, 100);

      throttled("a");
      throttled("b");
      throttled("c");

      vi.advanceTimersByTime(100);

      expect(func).toHaveBeenLastCalledWith("c");
    });

    it("should preserve context", () => {
      let context;
      const func = function () {
        context = this;
      };
      const throttled = throttle(func, 100);

      const obj = { method: throttled };
      obj.method();

      expect(context).toBe(obj);
    });

    it("should handle rapid successive calls", () => {
      const func = vi.fn();
      const throttled = throttle(func, 100);

      throttled();
      expect(func).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      throttled();
      expect(func).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      expect(func).toHaveBeenCalledTimes(2);
    });
  });

  describe("rafThrottle", () => {
    it("should throttle using requestAnimationFrame", () => {
      const func = vi.fn();
      const throttled = rafThrottle(func);

      // Mock RAF
      global.requestAnimationFrame = vi.fn((cb) => {
        setTimeout(cb, 16);
        return 1;
      });

      throttled("a");
      throttled("b");
      throttled("c");

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(16);

      expect(func).toHaveBeenCalledTimes(1);
      expect(func).toHaveBeenCalledWith("c");
    });

    it("should use latest arguments", () => {
      const func = vi.fn();
      const throttled = rafThrottle(func);

      global.requestAnimationFrame = vi.fn((cb) => {
        setTimeout(cb, 16);
        return 1;
      });

      throttled(1);
      throttled(2);
      throttled(3);

      vi.advanceTimersByTime(16);

      expect(func).toHaveBeenCalledWith(3);
    });
  });

  describe("idle", () => {
    it("should use requestIdleCallback when available", () => {
      const func = vi.fn();
      global.requestIdleCallback = vi.fn((cb) => {
        setTimeout(cb, 1);
        return 1;
      });

      const idleFunc = idle(func);
      idleFunc("test");

      expect(global.requestIdleCallback).toHaveBeenCalled();

      vi.advanceTimersByTime(1);

      expect(func).toHaveBeenCalledWith("test");

      delete global.requestIdleCallback;
    });

    it("should fallback to setTimeout when requestIdleCallback unavailable", () => {
      const func = vi.fn();
      delete global.requestIdleCallback;

      const idleFunc = idle(func);
      idleFunc("test");

      vi.advanceTimersByTime(1);

      expect(func).toHaveBeenCalledWith("test");
    });
  });

  describe("batch", () => {
    it("should batch multiple calls", () => {
      const func = vi.fn();
      const batched = batch(func, 50);

      batched("a");
      batched("b");
      batched("c");

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(func).toHaveBeenCalledTimes(1);
      expect(func).toHaveBeenCalledWith([["a"], ["b"], ["c"]]);
    });

    it("should batch in separate groups", () => {
      const func = vi.fn();
      const batched = batch(func, 50);

      batched("a");
      batched("b");

      vi.advanceTimersByTime(50);

      expect(func).toHaveBeenCalledTimes(1);
      expect(func).toHaveBeenCalledWith([["a"], ["b"]]);

      batched("c");
      batched("d");

      vi.advanceTimersByTime(50);

      expect(func).toHaveBeenCalledTimes(2);
      expect(func).toHaveBeenLastCalledWith([["c"], ["d"]]);
    });

    it("should handle empty batches", () => {
      const func = vi.fn();
      const batched = batch(func, 50);

      batched();

      vi.advanceTimersByTime(50);

      expect(func).toHaveBeenCalledWith([[]]);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle window resize with debounce", () => {
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

    it("should handle scroll with throttle", () => {
      const handler = vi.fn();
      const throttledHandler = throttle(handler, 100);

      // Simulate rapid scroll events
      for (let i = 0; i < 10; i++) {
        throttledHandler();
        vi.advanceTimersByTime(10);
      }

      // Should be called on leading edge + trailing edge
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should handle input with debounce for search", () => {
      const searchFunc = vi.fn();
      const debouncedSearch = debounce(searchFunc, 300);

      // User types "hello"
      debouncedSearch("h");
      vi.advanceTimersByTime(50);
      debouncedSearch("he");
      vi.advanceTimersByTime(50);
      debouncedSearch("hel");
      vi.advanceTimersByTime(50);
      debouncedSearch("hell");
      vi.advanceTimersByTime(50);
      debouncedSearch("hello");

      expect(searchFunc).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);

      expect(searchFunc).toHaveBeenCalledTimes(1);
      expect(searchFunc).toHaveBeenCalledWith("hello");
    });
  });
});
