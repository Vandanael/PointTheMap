/**
 * Focus trap for accessibility (e.g. role="dialog").
 * Keeps focus inside the container and restores it on deactivate.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** @type {HTMLElement | null} */
let _previousActiveElement = null;
/** @type {((e: KeyboardEvent) => void) | null} */
let _keydownHandler = null;
/** @type {HTMLElement | null} */
let _container = null;
/** @type {(() => void) | null} */
let _onEscape = null;

/**
 * Get focusable elements inside a container (in tab order).
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  /** @type {NodeListOf<HTMLElement>} */
  const nodes = container.querySelectorAll(FOCUSABLE_SELECTOR);
  return Array.from(nodes).filter((el) => {
    if (el.getAttribute('tabindex') === '-1') return false;
    return el.offsetParent !== null && !el.hasAttribute('hidden');
  });
}

/**
 * Activate focus trap for a dialog container.
 * Saves current focus, moves focus to first focusable element, traps Tab/Shift+Tab.
 * Optionally calls onEscape when Escape is pressed (for closing the modal).
 * @param {HTMLElement} container - The dialog element (e.g. role="dialog")
 * @param {{ onEscape?: () => void }} [options] - Optional: onEscape called when Escape is pressed
 */
export function activateFocusTrap(container, options = {}) {
  deactivateFocusTrap();
  _previousActiveElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  _container = container;
  _onEscape = options.onEscape ?? null;

  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  _keydownHandler = (e) => {
    if (!_container) return;
    if (e.key === 'Escape' && _onEscape) {
      e.preventDefault();
      e.stopPropagation();
      _onEscape();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = getFocusableElements(_container);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', _keydownHandler);
}

/**
 * Deactivate focus trap and restore focus to the element that had it before activate.
 */
export function deactivateFocusTrap() {
  if (_keydownHandler && _container) {
    _container.removeEventListener('keydown', _keydownHandler);
    _keydownHandler = null;
    _container = null;
  }
  _onEscape = null;
  if (
    _previousActiveElement &&
    typeof _previousActiveElement.focus === 'function' &&
    document.body.contains(_previousActiveElement)
  ) {
    _previousActiveElement.focus({ preventScroll: true });
  }
  _previousActiveElement = null;
}
