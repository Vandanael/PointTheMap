// Result screen UI module

import { getLastPseudo } from '../../services/storage.js';
import { t } from '../../i18n.js';
import { logger } from '../../utils/logger.js';
import { domCache as _domCache, render, remove, bindClick, app } from '../dom.js';
import { UI_TIMING } from '../../config/visual-constants.js';
import { debounce } from '../../utils/performance.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../utils/focusTrap.js';
import { GameOverScreen, FinalResults, PseudoLockedDialog, Toast } from '../components.js';

// Rate limiting for submit button
const MIN_SUBMIT_INTERVAL = 2000; // 2 seconds between submissions

/**
 * @param {{
 *   getInputSystem: () => { handleSubmit: (pseudo: string) => void; handleReplay: () => void } | null;
 *   getValidationSystem: () => { validatePseudo: (pseudo: string) => { valid: boolean } } | null;
 * }} deps
 */
export const createResultScreen = (deps) => {
  const { getInputSystem, getValidationSystem } = deps;

  let lastSubmitTime = 0;
  /** @type {null | ((e: Event) => void)} */
  let _pseudoInputHandler = null;
  /** @type {null | ((e: Event) => void)} */
  let _pseudoKeypressHandler = null;

  // Track toast timers for cleanup
  const _toastTimers = new Map();

  const showGameOver = (totalScore) => {
    const lastPseudo = getLastPseudo() || '';
    render(GameOverScreen(totalScore, lastPseudo));

    const oldInput = document.getElementById('pseudo-input');
    if (oldInput) {
      if (_pseudoInputHandler) oldInput.removeEventListener('input', _pseudoInputHandler);
      if (_pseudoKeypressHandler) oldInput.removeEventListener('keypress', _pseudoKeypressHandler);
    }

    const input = /** @type {HTMLInputElement | null} */ (_domCache.get('pseudo-input'));
    if (input) {
      _pseudoInputHandler = (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        target.value = target.value
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 5);
      };
      _pseudoKeypressHandler = (e) => {
        if (/** @type {KeyboardEvent} */ (e).key === 'Enter') {
          const btn = _domCache.get('btn-submit');
          if (btn) btn.click();
        }
      };
      input.addEventListener('input', _pseudoInputHandler);
      input.addEventListener('keypress', _pseudoKeypressHandler);
      input.focus();
    }

    bindClick(
      'btn-submit',
      /** @type {(e: Event) => void} */ (
        debounce(() => {
          const submitBtn = /** @type {HTMLButtonElement | null} */ (
            document.getElementById('btn-submit')
          );

          const now = Date.now();
          const elapsed = now - lastSubmitTime;
          const remaining = MIN_SUBMIT_INTERVAL - elapsed;

          if (remaining > 0) {
            if (submitBtn) {
              submitBtn.disabled = true;
              const originalText = submitBtn.textContent;
              submitBtn.textContent = `${t('waitSeconds', { seconds: Math.ceil(remaining / 1000) })}`;

              setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
              }, remaining);
            }
            return;
          }

          const pseudo = input?.value.trim() ?? '';
          const error = _domCache.get('pseudo-error');
          const validationSystem = getValidationSystem();
          if (!validationSystem) {
            logger.error('UI: validationSystem not configured');
            return;
          }
          const validation = validationSystem.validatePseudo(pseudo);
          if (!validation.valid) {
            input?.setAttribute('aria-invalid', 'true');
            input?.classList.add('input-error-shake');
            error?.classList.remove('hidden');
            input?.style.setProperty('border-color', '#ef4444');

            setTimeout(() => {
              input?.classList.remove('input-error-shake');
            }, UI_TIMING.INPUT_ERROR_SHAKE);
            return;
          }
          input?.setAttribute('aria-invalid', 'false');
          error?.classList.add('hidden');
          input?.style.setProperty('border-color', 'var(--accent)');

          lastSubmitTime = now;
          const inputSystem = getInputSystem();
          if (!inputSystem) {
            logger.error('UI: inputSystem not configured');
            return;
          }
          inputSystem.handleSubmit(pseudo);
        }, UI_TIMING.DEBOUNCE_SUBMIT)
      )
    );

    bindClick('btn-replay', () => {
      const inputSystem = getInputSystem();
      if (!inputSystem) {
        logger.error('UI: inputSystem not configured');
        return;
      }
      inputSystem.handleReplay();
    });
    const gameOverModal = document.getElementById('result-modal');
    if (gameOverModal) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (gameOverModal), {
          onEscape: () => hideGameOver(),
        })
      );
    }
  };

  const showFinalResults = (totalScore, pseudo, result, isNewSessionBest = false) => {
    let modal = document.getElementById('result-modal');
    if (!modal) {
      modal = /** @type {HTMLElement | null} */ (
        render(`
        <div id="result-modal" class="fixed inset-0 modal-bg flex items-center justify-center p-4" style="z-index: var(--z-modal);" role="dialog" aria-modal="true"></div>
      `)
      );
    }
    if (modal) {
      modal.innerHTML = `
        <div class="flex items-center justify-center p-4 h-full">
          ${FinalResults(totalScore, pseudo, result.rank, result.isTopFifty, isNewSessionBest)}
        </div>
      `;
    }
    bindClick('btn-replay', () => {
      const inputSystem = getInputSystem();
      if (!inputSystem) {
        logger.error('UI: inputSystem not configured');
        return;
      }
      inputSystem.handleReplay();
    });
    const resultModal = document.getElementById('result-modal');
    if (resultModal) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (resultModal), {
          onEscape: () => hideGameOver(),
        })
      );
    }
  };

  const hideGameOver = () => {
    deactivateFocusTrap();
    remove('result-modal');
    _domCache.invalidate('result-modal');
  };

  const showError = (message) => {
    const container = app();
    if (!container) return;
    const errorEl = document.createElement('div');
    errorEl.className =
      'fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-red-600 text-white p-4 rounded-lg shadow-lg';
    errorEl.style.zIndex = 'var(--z-overlay)';
    errorEl.textContent = message;
    container.appendChild(errorEl);
    setTimeout(() => errorEl.remove(), UI_TIMING.ERROR_DISPLAY);
  };

  const showPseudoLockedDialog = (pseudo, onConfirm) => {
    render(PseudoLockedDialog(pseudo));
    const closePseudoLocked = () => {
      deactivateFocusTrap();
      remove('pseudo-locked-modal');
      _domCache.invalidate('pseudo-locked-modal');
      if (onConfirm) onConfirm();
    };
    const closePseudoLockedWithoutConfirm = () => {
      deactivateFocusTrap();
      remove('pseudo-locked-modal');
      _domCache.invalidate('pseudo-locked-modal');
    };
    bindClick('btn-pseudo-locked-ok', closePseudoLocked);
    const pseudoLockedModal = document.getElementById('pseudo-locked-modal');
    if (pseudoLockedModal) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (pseudoLockedModal), {
          onEscape: closePseudoLockedWithoutConfirm,
        })
      );
    }
  };

  const showToast = (message, type = 'info', duration = 5000, options = {}) => {
    const toastId = `toast-${Date.now()}`;
    render(Toast(toastId, message, type, options));

    bindClick(`${toastId}-close`, () => {
      closeToast(toastId);
    });

    if (duration > 0) {
      const timerId = setTimeout(() => {
        closeToast(toastId);
      }, duration);
      _toastTimers.set(toastId, timerId);
    }

    return toastId;
  };

  const closeToast = (toastId) => {
    const timerId = _toastTimers.get(toastId);
    if (timerId) {
      clearTimeout(timerId);
      _toastTimers.delete(toastId);
    }

    const toast = document.getElementById(toastId);
    if (!toast) return;

    toast.classList.remove('toast-slide-up');
    toast.classList.add('toast-slide-down');

    setTimeout(() => {
      remove(toastId);
    }, UI_TIMING.TOAST_SLIDE_OUT);
  };

  const destroy = () => {
    const pseudoInput = document.getElementById('pseudo-input');
    if (pseudoInput) {
      if (_pseudoInputHandler) pseudoInput.removeEventListener('input', _pseudoInputHandler);
      if (_pseudoKeypressHandler)
        pseudoInput.removeEventListener('keypress', _pseudoKeypressHandler);
    }
    _pseudoInputHandler = null;
    _pseudoKeypressHandler = null;

    _toastTimers.forEach((timerId) => clearTimeout(timerId));
    _toastTimers.clear();
  };

  return {
    showGameOver,
    showFinalResults,
    hideGameOver,
    showError,
    showPseudoLockedDialog,
    showToast,
    closeToast,
    destroy,
  };
};
