import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimerSystem } from './TimerSystem.js';
import { GAME } from '../config.js';

describe('TimerSystem', () => {
  let timer;

  beforeEach(() => {
    timer = new TimerSystem();
    vi.useFakeTimers();
  });

  afterEach(() => {
    timer.stop();
    vi.restoreAllMocks();
  });

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

  describe('callbacks', () => {
    it('calls onStart after grace period', () => {
      const onStart = vi.fn();
      timer.start({ onStart });

      expect(onStart).not.toHaveBeenCalled();

      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('calls onDangerZone at correct time', () => {
      const onDangerZone = vi.fn();
      timer.start({ onDangerZone });

      // Advance to start
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(onDangerZone).not.toHaveBeenCalled();

      // Advance to danger zone
      const dangerZoneTime = GAME.TIMER_MS - GAME.DANGER_ZONE_MS;
      vi.advanceTimersByTime(dangerZoneTime);
      expect(onDangerZone).toHaveBeenCalledTimes(1);
    });

    it('calls onTimeout when timer expires', () => {
      const onTimeout = vi.fn();
      timer.start({ onTimeout });

      // Advance to start
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(onTimeout).not.toHaveBeenCalled();

      // Advance to timeout
      vi.advanceTimersByTime(GAME.TIMER_MS);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('calls onTick periodically', () => {
      const onTick = vi.fn();
      timer.start({ onTick });

      // Advance to start
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);

      // Should tick every 50ms
      vi.advanceTimersByTime(50);
      expect(onTick).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(50);
      expect(onTick).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(100);
      expect(onTick).toHaveBeenCalledTimes(4); // 2 more ticks
    });

    it('passes timestamp to onTick', () => {
      const onTick = vi.fn();
      timer.start({ onTick });

      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + 50);

      expect(onTick).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('memory leak prevention', () => {
    it('stops all callbacks when stopped', () => {
      const onStart = vi.fn();
      const onDangerZone = vi.fn();
      const onTimeout = vi.fn();
      const onTick = vi.fn();

      timer.start({ onStart, onDangerZone, onTimeout, onTick });

      // Start the timer
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(onStart).toHaveBeenCalledTimes(1);

      // Stop immediately
      timer.stop();

      // Advance time further - callbacks should NOT be called
      vi.advanceTimersByTime(GAME.TIMER_MS * 2);

      expect(onDangerZone).not.toHaveBeenCalled();
      expect(onTimeout).not.toHaveBeenCalled();
      // onTick might have been called once before stop, but not after
      const tickCallsBefore = onTick.mock.calls.length;
      vi.advanceTimersByTime(1000);
      expect(onTick).toHaveBeenCalledTimes(tickCallsBefore); // No new calls
    });

    it('clears timers when starting new timer before previous completes', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      // Start first timer
      timer.start({ onTimeout: onTimeout1 });
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + 1000);

      // Start second timer (should stop first)
      timer.start({ onTimeout: onTimeout2 });

      // Complete second timer
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + GAME.TIMER_MS);

      // First timeout should NOT be called
      expect(onTimeout1).not.toHaveBeenCalled();
      // Second timeout should be called
      expect(onTimeout2).toHaveBeenCalledTimes(1);
    });

    it('does not call callbacks after stop even if timer was running', () => {
      const onTimeout = vi.fn();
      timer.start({ onTimeout });

      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      timer.stop();

      // Try to trigger the timeout
      vi.advanceTimersByTime(GAME.TIMER_MS);

      expect(onTimeout).not.toHaveBeenCalled();
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
      const onTimeout = vi.fn();
      timer.start({ onTimeout });

      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      timer.reset();

      vi.advanceTimersByTime(GAME.TIMER_MS);
      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles stop when not running', () => {
      expect(() => timer.stop()).not.toThrow();
      expect(timer.isRunning).toBe(false);
    });

    it('handles start without callbacks', () => {
      expect(() => timer.start()).not.toThrow();
      expect(timer.isRunning).toBe(true);
    });

    it('handles partial callbacks', () => {
      expect(() => timer.start({ onStart: vi.fn() })).not.toThrow();
      expect(() => timer.start({ onTimeout: vi.fn() })).not.toThrow();
      expect(() => timer.start({ onTick: vi.fn() })).not.toThrow();
    });

    it('stops automatically when timeout is reached', () => {
      const onTimeout = vi.fn();
      timer.start({ onTimeout });

      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS + GAME.TIMER_MS);

      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(timer.isRunning).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('handles rapid start/stop cycles', () => {
      const onTimeout = vi.fn();

      for (let i = 0; i < 10; i++) {
        timer.start({ onTimeout });
        vi.advanceTimersByTime(100);
        timer.stop();
      }

      // No timeouts should have been called
      expect(onTimeout).not.toHaveBeenCalled();
      expect(timer.isRunning).toBe(false);
    });

    it('handles complete game flow', () => {
      const onStart = vi.fn();
      const onDangerZone = vi.fn();
      const onTimeout = vi.fn();
      const onTick = vi.fn();

      timer.start({ onStart, onDangerZone, onTimeout, onTick });

      // Grace period
      vi.advanceTimersByTime(GAME.GRACE_PERIOD_MS);
      expect(onStart).toHaveBeenCalledTimes(1);

      // Normal time
      vi.advanceTimersByTime(GAME.TIMER_MS - GAME.DANGER_ZONE_MS);
      expect(onDangerZone).toHaveBeenCalledTimes(1);

      // Danger zone to timeout
      vi.advanceTimersByTime(GAME.DANGER_ZONE_MS);
      expect(onTimeout).toHaveBeenCalledTimes(1);
      expect(timer.isRunning).toBe(false);

      // Ticks should have been called throughout
      expect(onTick.mock.calls.length).toBeGreaterThan(50); // At least once per 50ms
    });
  });
});
