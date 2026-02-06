/**
 * Performance utilities - Debounce
 */

/**
 * Debounce function - Delays execution until after wait time has elapsed since last call
 * @template {(...args: any[]) => any} F
 * @param {F} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - If true, trigger on leading edge instead of trailing
 * @returns {F} Debounced function
 */
export function debounce(func, wait = 300, immediate = false) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timeout = null;

  /**
   * @this {unknown}
   * @param {...any} args
   */
  const executedFunction = function (...args) {
    const context = this;

    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };

  return /** @type {F} */ (executedFunction);
}
