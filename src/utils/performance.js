/**
 * Performance utilities - Debounce and Throttle
 */

/**
 * Debounce function - Delays execution until after wait time has elapsed since last call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - If true, trigger on leading edge instead of trailing
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300, immediate = false) {
  let timeout;

  return function executedFunction(...args) {
    const context = this;

    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle function - Limits execution to once per wait time
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Options object
 * @param {boolean} options.leading - If true, call on leading edge (default: true)
 * @param {boolean} options.trailing - If true, call on trailing edge (default: true)
 * @returns {Function} Throttled function
 */
export function throttle(func, wait = 300, options = {}) {
  let timeout;
  let previous = 0;
  let lastArgs;
  let lastContext;
  const { leading = true, trailing = true } = options;

  return function executedFunction(...args) {
    const context = this;
    const now = Date.now();

    // Store latest args for trailing call
    lastArgs = args;
    lastContext = context;

    if (!previous && !leading) previous = now;

    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = leading ? Date.now() : 0;
        timeout = null;
        func.apply(lastContext, lastArgs);
      }, remaining);
    }
  };
}

/**
 * Request Animation Frame throttle - Uses RAF for smooth animations
 * @param {Function} func - Function to throttle
 * @returns {Function} RAF-throttled function
 */
export function rafThrottle(func) {
  let rafId = null;
  let lastArgs = null;

  return function executedFunction(...args) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

/**
 * Idle callback wrapper - Executes when browser is idle
 * @param {Function} func - Function to execute
 * @param {Object} options - requestIdleCallback options
 * @returns {Function} Wrapped function
 */
export function idle(func, options = {}) {
  if (typeof requestIdleCallback !== "undefined") {
    return (...args) => {
      requestIdleCallback(() => {
        func(...args);
      }, options);
    };
  }

  // Fallback for browsers without requestIdleCallback
  return (...args) => {
    setTimeout(() => {
      func(...args);
    }, 1);
  };
}

/**
 * Batch multiple calls into one
 * @param {Function} func - Function to batch
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Batched function
 */
export function batch(func, wait = 16) {
  let pending = [];
  let timeout = null;

  return function batchedFunction(...args) {
    pending.push(args);

    if (!timeout) {
      timeout = setTimeout(() => {
        const calls = pending;
        pending = [];
        timeout = null;
        func(calls);
      }, wait);
    }
  };
}
