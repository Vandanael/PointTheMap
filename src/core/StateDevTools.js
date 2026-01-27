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
import { escapeHtml } from '../utils.js';

export class StateDevTools {
  #stateManager;
  #panel = null;
  #isOpen = false;

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
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        this.toggle();
      }
    });
  }

  #createPanel() {
    this.#panel = document.createElement('div');
    this.#panel.id = 'state-devtools';
    this.#panel.className = 'state-devtools';
    this.#panel.style.display = 'none';

    this.#panel.innerHTML = `
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

    document.body.appendChild(this.#panel);

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
      .map((entry, index) => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        return `
          <div class="state-devtools-entry" data-index="${index}">
            <div class="state-devtools-entry-header">
              <span class="state-devtools-entry-action">${escapeHtml(entry.action)}</span>
              <span class="state-devtools-entry-time">${time}</span>
            </div>
            <div class="state-devtools-entry-actions">
              <button class="state-devtools-restore" data-index="${index}">Restore</button>
              <button class="state-devtools-inspect" data-index="${index}">Inspect</button>
            </div>
          </div>
        `;
      })
      .reverse()
      .join('');

    // Bind restore buttons
    list.querySelectorAll('.state-devtools-restore').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.#stateManager.restoreFromHistory(index);
      });
    });

    // Bind inspect buttons
    list.querySelectorAll('.state-devtools-inspect').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const entry = history[index];
        logger.debug(`State at ${new Date(entry.timestamp).toLocaleTimeString()} (${entry.action})`);
        logger.debug('State:', entry.state);
        logger.debug('Previous State:', entry.prevState);
      });
    });
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
