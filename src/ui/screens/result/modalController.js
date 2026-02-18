import { UI_TIMING } from '@lib/config/visual-constants.js';
import { t } from '../../../i18n.js';
import { PseudoLockedDialog, ResumePrompt } from '../../components.js';
import { domCache as _domCache, render, remove, bindClick, app } from '../../dom.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../../utils/focusTrap.js';

/**
 * @returns {{
 *   showError: (message: string) => void,
 *   showPseudoLockedDialog: (pseudo: string, onConfirm?: () => void) => void,
 *   showResumePrompt: () => Promise<boolean>
 * }}
 */
export const createModalController = () => {
  /** @param {string} message */
  const showError = (message) => {
    const container = app();
    if (!container) return;
    remove('app-error-modal');
    const errorEl = document.createElement('div');
    errorEl.id = 'app-error-modal';
    errorEl.className = 'fixed inset-0 modal-bg flex items-center justify-center p-4';
    errorEl.style.zIndex = 'var(--z-overlay)';
    errorEl.setAttribute('role', 'alertdialog');
    errorEl.setAttribute('aria-modal', 'true');
    errorEl.innerHTML = `
      <div class="modal-card rounded-2xl max-w-md w-full p-8 modal-content text-center">
        <div class="text-3xl font-black text-primary mb-4">${t('error.title')}</div>
        <div class="text-secondary text-base">${message}</div>
      </div>
    `;
    container.appendChild(errorEl);
    setTimeout(() => remove('app-error-modal'), UI_TIMING.ERROR_DISPLAY);
  };

  /**
   * @param {string} pseudo
   * @param {() => void} [onConfirm]
   */
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

  /**
   * @returns {Promise<boolean>}
   */
  const showResumePrompt = () =>
    new Promise((resolve) => {
      remove('resume-modal');
      render(ResumePrompt());

      const close = (value) => {
        deactivateFocusTrap();
        remove('resume-modal');
        _domCache.invalidate('resume-modal');
        resolve(value);
      };

      bindClick('btn-resume-continue', () => close(true));
      bindClick('btn-resume-discard', () => close(false));

      const resumeModal = document.getElementById('resume-modal');
      if (resumeModal) {
        requestAnimationFrame(() =>
          activateFocusTrap(/** @type {HTMLElement} */ (resumeModal), {
            onEscape: () => close(false),
          })
        );
      }
    });

  return {
    showError,
    showPseudoLockedDialog,
    showResumePrompt,
  };
};
