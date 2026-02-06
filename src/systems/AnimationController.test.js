import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimationController, animateValue } from './AnimationController.js';

describe('AnimationController', () => {
  let controller;

  beforeEach(() => {
    controller = new AnimationController();
  });

  afterEach(() => {
    controller.stop();
  });

  describe('basic functionality', () => {
    it('starts in stopped state', () => {
      expect(controller.isRunning).toBe(false);
    });

    it('sets isRunning to true when started', () => {
      controller.start(() => true);
      expect(controller.isRunning).toBe(true);
    });

    it('sets isRunning to false when stopped', () => {
      controller.start(() => true);
      controller.stop();
      expect(controller.isRunning).toBe(false);
    });

    it('calls callback on each frame', () => {
      const callback = vi.fn(() => false); // Return false to stop after 1 frame
      controller.start(callback);

      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          expect(callback).toHaveBeenCalled();
          resolve();
        });
      });
    });
  });

  describe('animation control', () => {
    it('stops when callback returns false', () => {
      let callCount = 0;
      const callback = vi.fn(() => {
        callCount++;
        return callCount < 3; // Stop after 3 frames
      });

      controller.start(callback);

      return new Promise((resolve) => {
        setTimeout(() => {
          expect(callCount).toBe(3);
          expect(controller.isRunning).toBe(false);
          resolve();
        }, 100);
      });
    });

    it('continues when callback returns true', () => {
      const callback = vi.fn(() => true);
      controller.start(callback);

      return new Promise((resolve) => {
        setTimeout(() => {
          controller.stop();
          expect(callback.mock.calls.length).toBeGreaterThan(1);
          resolve();
        }, 50);
      });
    });

    it('can be stopped manually', () => {
      const callback = vi.fn(() => true);
      controller.start(callback);

      expect(controller.isRunning).toBe(true);
      controller.stop();
      expect(controller.isRunning).toBe(false);
    });
  });

  describe('memory leak prevention', () => {
    it('cancels animation frame on stop', () => {
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
      const callback = vi.fn(() => true);

      controller.start(callback);
      const framesBefore = cancelSpy.mock.calls.length;

      controller.stop();
      const framesAfter = cancelSpy.mock.calls.length;

      expect(framesAfter).toBeGreaterThan(framesBefore);
      cancelSpy.mockRestore();
    });

    it('does not leak frames when starting new animation', () => {
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');

      controller.start(() => true);
      const frameId1 = controller._frameId;

      controller.start(() => true);

      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });

    it('handles stop when not running', () => {
      expect(() => controller.stop()).not.toThrow();
      expect(controller.isRunning).toBe(false);
    });

    it('handles rapid start/stop cycles', () => {
      for (let i = 0; i < 10; i++) {
        controller.start(() => true);
        controller.stop();
      }

      expect(controller.isRunning).toBe(false);
    });
  });

  describe('reset', () => {
    it('reset is alias for stop', () => {
      controller.start(() => true);
      expect(controller.isRunning).toBe(true);

      controller.reset();
      expect(controller.isRunning).toBe(false);
    });
  });
});

describe('animateValue', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  it('animates from start to end value', () => {
    const controller = animateValue(element, 0, 100, 100);

    return new Promise((resolve) => {
      setTimeout(() => {
        const value = parseInt(element.textContent);
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(100);
        controller.stop();
        resolve();
      }, 50);
    });
  });

  it('reaches target value at end', () => {
    const controller = animateValue(element, 0, 100, 50);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(element.textContent).toBe('100');
        expect(controller.isRunning).toBe(false);
        resolve();
      }, 100);
    });
  });

  it('uses custom formatter', () => {
    const formatter = (v) => `$${v}`;
    const controller = animateValue(element, 0, 100, 50, formatter);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(element.textContent).toMatch(/^\$\d+$/);
        controller.stop();
        resolve();
      }, 25);
    });
  });

  it('stops if element is removed from DOM', () => {
    const controller = animateValue(element, 0, 100, 100);

    // Remove element mid-animation
    setTimeout(() => {
      element.remove();
    }, 25);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(controller.isRunning).toBe(false);
        resolve();
      }, 75);
    });
  });

  it('can be cancelled via controller', () => {
    const controller = animateValue(element, 0, 100, 100);

    setTimeout(() => {
      controller.stop();
    }, 25);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(controller.isRunning).toBe(false);
        resolve();
      }, 75);
    });
  });

  it('handles start value equal to end value', () => {
    const controller = animateValue(element, 100, 100, 50);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(element.textContent).toBe('100');
        expect(controller.isRunning).toBe(false);
        resolve();
      }, 75);
    });
  });

  it('handles negative values', () => {
    const controller = animateValue(element, -50, 50, 50);

    return new Promise((resolve) => {
      setTimeout(() => {
        expect(element.textContent).toBe('50');
        expect(controller.isRunning).toBe(false);
        resolve();
      }, 75);
    });
  });

  it('can be stopped manually', () => {
    const controller = animateValue(element, 0, 1000, 500);

    setTimeout(() => {
      controller.stop();
    }, 100);

    return new Promise((resolve) => {
      setTimeout(() => {
        const value = parseInt(element.textContent);
        expect(value).toBeLessThan(1000); // Should not reach target
        expect(controller.isRunning).toBe(false);
        resolve();
      }, 200);
    });
  });
});
