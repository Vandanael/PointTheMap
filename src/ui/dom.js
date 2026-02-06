import { logger } from '../utils/logger.js';

// Store click handlers to allow removal before adding new ones
const _clickHandlers = new Map();

// DOM cache to avoid repeated queries
/** @type {{ _cache: Record<string, HTMLElement | null>; get(id: string): HTMLElement | null; invalidate(id?: string): void }} */
export const domCache = {
  /** @type {Record<string, HTMLElement | null>} */
  _cache: {},
  /** @param {string} id */
  get(id) {
    if (!this._cache[id] || !document.body.contains(this._cache[id])) {
      this._cache[id] = document.getElementById(id);
    }
    return this._cache[id];
  },
  /** @param {string} [id] */
  invalidate(id) {
    if (id) {
      delete this._cache[id];
    } else {
      this._cache = {};
    }
  },
};

export const app = () => {
  const el = domCache.get('app');
  if (!el) {
    logger.error('Element #app introuvable');
    return document.body; // Fallback
  }
  return el;
};

/**
 * @param {string} html
 * @param {HTMLElement} [container]
 * @returns {Element | null}
 */
export const render = (html, container = app()) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  const el = div.firstElementChild;
  if (el) container.appendChild(el);
  return el;
};

/** @param {string} id */
export const remove = (id) => {
  const el = document.getElementById(id) || domCache.get(id);
  if (el) {
    el.remove();
  }
  domCache.invalidate(id);
  _clickHandlers.delete(id);
};

/**
 * @param {string} id
 * @param {(e: Event) => void} handler
 */
export const bindClick = (id, handler) => {
  // Try cache first, then direct DOM lookup
  let el = domCache.get(id);
  if (!el) {
    el = document.getElementById(id);
    if (el) {
      domCache._cache[id] = el;
    }
  }

  if (el) {
    const previousHandler = _clickHandlers.get(id);
    if (previousHandler) {
      el.removeEventListener('click', previousHandler);
    }
    el.addEventListener('click', handler);
    _clickHandlers.set(id, handler);
  } else {
    logger.warn(`bindClick: Element #${id} not found`);
  }
};
