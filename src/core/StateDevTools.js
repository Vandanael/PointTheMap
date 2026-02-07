/**
 * StateDevTools - Development tools for state debugging
 *
 * Features:
 * - Floating panel showing state history
 * - Click to restore previous state
 * - Clear history button
 * - Only loaded in dev mode
 */

import './StateDevTools.css';
import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/dom.js';

export class StateDevTools {
  /** @type {import('./StateManager.js').StateManager} */
  #stateManager;
  /** @type {HTMLDivElement | null} */
  #panel = null;
  #isOpen = false;

  /** @param {import('./StateManager.js').StateManager} stateManager */
  constructor(stateManager) {
    this.#stateManager = stateManager;
    this.#init();
  }

  #init() {
    // Only in dev mode
    if (!import.meta.env.DEV) return;

    // Create panel
    this.#createPanel();

    // Subscribe to state changes
    this.#stateManager.subscribe(() => {
      this.#updatePanel();
    });

    // Listen for keyboard shortcut (Ctrl+Shift+S)
    document.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        this.toggle();
      }
    });
  }

  #createPanel() {
    const panel = document.createElement('div');
    panel.id = 'state-devtools';
    panel.className = 'state-devtools';
    panel.style.display = 'none';
    this.#panel = panel;

    panel.innerHTML = `
      <div class="state-devtools-header">
        <h3>State History</h3>
        <div class="state-devtools-actions">
          <button id="state-devtools-clear" title="Clear history">Clear</button>
          <button id="state-devtools-close" title="Close (Ctrl+Shift+S)">×</button>
        </div>
      </div>
      <div class="state-devtools-body">
        <div id="state-devtools-list"></div>
      </div>
    `;

    // Use event delegation for dynamic buttons
    panel.addEventListener('click', (/** @type {MouseEvent} */ e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target.classList.contains('state-devtools-restore')) {
        const index = parseInt(target.dataset.index || '0');
        this.#stateManager.restoreFromHistory(index);
      } else if (target.classList.contains('state-devtools-inspect')) {
        const index = parseInt(target.dataset.index || '0');
        const history = this.#stateManager.getHistory();
        const entry = history[index];
        logger.debug(
          `State at ${new Date(entry.timestamp).toLocaleTimeString()} (${entry.action})`
        );
        logger.debug('State:', entry.state);
        logger.debug('Previous State:', entry.prevState);
      }
    });

    document.body.appendChild(panel);

    // Bind events
    document.getElementById('state-devtools-clear')?.addEventListener('click', () => {
      this.#stateManager.clearHistory();
      this.#updatePanel();
    });

    document.getElementById('state-devtools-close')?.addEventListener('click', () => {
      this.close();
    });
  }

  #updatePanel() {
    if (!this.#panel) return;

    const list = document.getElementById('state-devtools-list');
    if (!list) return;

    const history = this.#stateManager.getHistory();

    if (history.length === 0) {
      list.innerHTML = '<div class="state-devtools-empty">No history yet</div>';
      return;
    }

    list.innerHTML = history
      .map((/** @type {any} */ entry, /** @type {number} */ index) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        return `
          <div class="state-devtools-entry" data-index="${index}">
            <div class="state-devtools-entry-header">
              <span class="state-devtools-entry-action">${escapeHtml(entry.action)}</span>
              <span class="state-devtools-entry-time">${time}</span>
            </div>
            <div class="state-devtools-entry-actions">
              <button class="state-devtools-restore" data-index="${index}" title="Restore to this snapshot (replaces current state)">Restore</button>
              <button class="state-devtools-inspect" data-index="${index}">Inspect</button>
            </div>
          </div>
        `;
      })
      .reverse()
      .join('');
  }

  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!this.#panel) return;
    this.#panel.style.display = 'block';
    this.#isOpen = true;
    this.#updatePanel();
  }

  close() {
    if (!this.#panel) return;
    this.#panel.style.display = 'none';
    this.#isOpen = false;
  }
}
