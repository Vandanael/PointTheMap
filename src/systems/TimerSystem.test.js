import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerSystem } from './TimerSystem.js';
import { eventBus } from '../core/EventBus.js';
import { GAME } from '@lib/config';

describe('TimerSystem', () => {
  /** @type {TimerSystem} */
  let timer;
  /** @type {Array<() => void>} */
  let unsubscribers = [];

  beforeEach(() => {
    timer = new TimerSystem();
    vi.useFakeTimers();
    unsubscribers = [];
  });

  afterEach(() => {
    timer.stop();
    // Cleanup all event listeners
    unsubscribers.forEach((unsub) => unsub());
    unsubscribers = [];
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Helper to subscribe and track unsubscribers
  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {() => void}
   */
  const subscribe = (event, handler) => {
    const unsub = eventBus.subscribe(event, handler);
    unsubscribers.push(unsub);
    return unsub;
  };

  describe('start and stop', () => {
    it('starts in stopped state', () => {
      expect(timer.isRunning).toBe(false);
    });

    it('sets isRunning to true when started', () => {
      timer.start();
      expect(timer.isRunning).toBe(true);
    });

    it('sets isRunning to false when stopped', () => {
      timer.start();
      timer.stop();
      expect(timer.isRunning).toBe(false);
    });

    it('can be started multiple times safely', () => {
      timer.start();
      timer.start();
      timer.start();
      expect(timer.isRunning).toBe(true);
    });
  });

  describe('events', () => {
    it('emits timer:started after grace period', () => {
      const listener = vi.fn();
      subscribe('timer:started', listener);

      timer.start();
      expect(listener).not.toHaveBeenCalled();

      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits timer:danger at correct time', () => {
      const listener = vi.fn();
      subscribe('timer:danger', listener);

      timer.start();

      // Advance to start
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(listener).not.toHaveBeenCalled();

      // Advance to danger zone
      const dangerZoneTime = GAME.TIMER_MS - GAME.DANGER_ZONE_MS;
      vi.advanceTimersByTime(dangerZoneTime);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits timer:timeout when timer expires', () => {
      const listener = vi.fn();
      subscribe('timer:timeout', listener);

      timer.start();

      // Advance to start
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(listener).not.toHaveBeenCalled();

      // Advance to timeout
      vi.advanceTimersByTime(GAME.TIMER_MS);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('emits timer:tick periodically', () => {
      const listener = vi.fn();
      subscribe('timer:tick', listener);

      timer.start();

      // Advance to start
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);

      // Should tick every 50ms
      vi.advanceTimersByTime(50);
      expect(listener).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      expect(listener).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(100);
      expect(listener).toHaveBeenCalledTimes(4); // 2 more ticks
    });

    it('passes timestamp in timer:tick event', () => {
      const listener = vi.fn();
      subscribe('timer:tick', listener);

      timer.start();
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + 50);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ timestamp: expect.any(Number) })
      );
    });
  });

  describe('memory leak prevention', () => {
    it('stops emitting events when stopped', () => {
      const onStarted = vi.fn();
      const onDanger = vi.fn();
      const onTimeout = vi.fn();
      const onTick = vi.fn();

      subscribe('timer:started', onStarted);
      subscribe('timer:danger', onDanger);
      subscribe('timer:timeout', onTimeout);
      subscribe('timer:tick', onTick);

      timer.start();

      // Start the timer
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(onStarted).toHaveBeenCalledTimes(1);

      // Stop immediately
      timer.stop();

      // Advance time further - events should NOT be emitted
      vi.advanceTimersByTime(GAME.TIMER_MS * 2);

      expect(onDanger).not.toHaveBeenCalled();
      expect(onTimeout).not.toHaveBeenCalled();
      // onTick might have been called once before stop, but not after
      const tickCallsBefore = onTick.mock.calls.length;
      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledTimes(tickCallsBefore); // No new calls
    });

    it('clears timers when starting new timer before previous completes', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      const unsub1 = subscribe('timer:timeout', onTimeout1);

      // Start first timer
      timer.start();
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + 1000);

      // Unsubscribe first listener and subscribe second
      unsub1();
      subscribe('timer:timeout', onTimeout2);

      // Start second timer (should stop first)
      timer.start();

      // Complete second timer
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + GAME.TIMER_MS);

      // First timeout should NOT be called (was unsubscribed)
      expect(onTimeout1).not.toHaveBeenCalled();
      // Second timeout should be called
      expect(onTimeout2).toHaveBeenCalledTimes(1);
    });

    it('does not emit events after stop even if timer was running', () => {
      const listener = vi.fn();
      subscribe('timer:timeout', listener);

      timer.start();
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      timer.stop();

      // Try to trigger the timeout
      vi.advanceTimersByTime(GAME.TIMER_MS);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('reset is alias for stop', () => {
      timer.start();
      expect(timer.isRunning).toBe(true);

      timer.reset();
      expect(timer.isRunning).toBe(false);
    });

    it('reset clears all timers', () => {
      const listener = vi.fn();
      subscribe('timer:timeout', listener);

      timer.start();
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      timer.reset();

      vi.advanceTimersByTime(GAME.TIMER_MS);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles stop when not running', () => {
      expect(() => timer.stop()).not.toThrow();
      expect(timer.isRunning).toBe(false);
    });

    it('handles start without listeners', () => {
      expect(() => timer.start()).not.toThrow();
      expect(timer.isRunning).toBe(true);
    });

    it('handles partial listeners', () => {
      subscribe('timer:started', vi.fn());
      expect(() => timer.start()).not.toThrow();

      timer.stop();

      subscribe('timer:timeout', vi.fn());
      expect(() => timer.start()).not.toThrow();

      timer.stop();

      subscribe('timer:tick', vi.fn());
      expect(() => timer.start()).not.toThrow();
    });

    it('stops automatically when timeout is reached', () => {
      const listener = vi.fn();
      subscribe('timer:timeout', listener);

      timer.start();
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + GAME.TIMER_MS);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(timer.isRunning).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('handles rapid start/stop cycles', () => {
      const listener = vi.fn();
      subscribe('timer:timeout', listener);

      for (let i = 0; i < 10; i++) {
        timer.start();
        vi.advanceTimersByTime(100);
        timer.stop();
      }

      // No timeouts should have been emitted
      expect(listener).not.toHaveBeenCalled();
      expect(timer.isRunning).toBe(false);
    });

    it('handles complete game flow', () => {
      const onStarted = vi.fn();
      const onDanger = vi.fn();
      const onTimeout = vi.fn();
      const onTick = vi.fn();

      subscribe('timer:started', onStarted);
      subscribe('timer:danger', onDanger);
      subscribe('timer:timeout', onTimeout);
      subscribe('timer:tick', onTick);

      timer.start();

      // Grace period
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(onStarted).toHaveBeenCalledTimes(1);

      // Normal time
      vi.advanceTimersByTime(GAME.TIMER_MS - GAME.DANGER_ZONE_MS);
      expect(onDanger).toHaveBeenCalledTimes(1);

      // Danger zone to timeout
      vi.advanceTimersByTime(GAME.DANGER_ZONE_MS);
      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(timer.isRunning).toBe(false);

      // Ticks should have been emitted throughout
      expect(onTick.mock.calls.length).toBeGreaterThan(50); // At least once per 50ms
    });
  });
});
