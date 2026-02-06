/**
 * Achievement Unlock Modal Presenter
 *
 * Manages the achievement unlock modal queue, DOM creation, focus trap,
 * and handler cleanup. Ensures modals are shown sequentially without stacking.
 */

import { AchievementUnlockModal } from '../../ui/components.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../utils/focusTrap.js';

/**
 * @typedef {Object} AchievementPresenterDeps
 * @property {typeof import('../../ui/UI.js').UI} ui
 * @property {{ t: (key: string) => string }} i18n
 * @property {{ shareGameResults: (text: string) => Promise<boolean> }} share
 */

/**
 * Create an achievement presenter for managing unlock modals
 * @param {AchievementPresenterDeps} deps - Dependencies
 * @returns {{ enqueue: (achievement: {id: string, achievement: any}) => void, showNext: () => void, cleanup: () => void }}
 */
export function createAchievementPresenter(deps) {
  const { ui, i18n, share } = deps;

  /** @type {Array<{id: string, achievement: {id: string, icon: string, labelKey: string, descKey: string}}>} */
  let achievementQueue = [];
  let isShowingAchievement = false;

  // Store handlers for cleanup
  /** @type {(() => void) | null} */
  let currentAchievementCloseHandler = null;
  /** @type {(() => void) | null} */
  let currentAchievementShareHandler = null;
  /** @type {string | null} */
  let currentAchievementId = null;

  /**
   * Show the next achievement in the queue
   */
  const showNext = () => {
    if (isShowingAchievement || achievementQueue.length === 0) return;

    isShowingAchievement = true;
    const nextAchievement = achievementQueue.shift();
    if (!nextAchievement) {
      isShowingAchievement = false;
      return;
    }
    const { id, achievement } = nextAchievement;

    // Clean up previous modal handlers if any (before creating new modal)
    if (currentAchievementCloseHandler) {
      const prevCloseBtn = document.getElementById('btn-close-achievement');
      if (prevCloseBtn) {
        prevCloseBtn.removeEventListener('click', currentAchievementCloseHandler);
      }
    }
    if (currentAchievementShareHandler && currentAchievementId) {
      const prevShareBtn = document.getElementById(`btn-share-achievement-${currentAchievementId}`);
      if (prevShareBtn) {
        prevShareBtn.removeEventListener('click', currentAchievementShareHandler);
      }
    }

    const achievementModal = document.createElement('div');
    achievementModal.innerHTML = AchievementUnlockModal(id, achievement);
    const modalElement = achievementModal.firstElementChild;
    if (modalElement) {
      document.body.appendChild(modalElement);
    }

    const closeAchievement = () => {
      deactivateFocusTrap();
      const modal = document.getElementById('achievement-modal');
      if (modal) modal.remove();
      isShowingAchievement = false;
      currentAchievementCloseHandler = null;
      currentAchievementShareHandler = null;
      currentAchievementId = null;
      showNext();
    };

    const modalEl = document.getElementById('achievement-modal');
    if (modalEl) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (modalEl), { onEscape: closeAchievement })
      );
    }

    const closeBtn = document.getElementById('btn-close-achievement');
    if (closeBtn) {
      currentAchievementCloseHandler = closeAchievement;
      closeBtn.addEventListener('click', currentAchievementCloseHandler);
    }

    const shareBtn = document.getElementById(`btn-share-achievement-${id}`);
    if (shareBtn) {
      currentAchievementShareHandler = async () => {
        const shareText = `${i18n.t('achievement.unlocked')}\n${i18n.t(achievement.labelKey)}: ${i18n.t(achievement.descKey)}\n\nhttps://pointthemap.app`;
        const success = await share.shareGameResults(shareText);
        if (success) {
          ui.showToast(i18n.t('shareCopied'), 'success', 3000, { compact: true });
        }
      };
      shareBtn.addEventListener('click', currentAchievementShareHandler);
      currentAchievementId = id; // Store ID for proper cleanup
    }
  };

  /**
   * Add an achievement to the queue
   * @param {{ id: string, achievement: any }} achievement
   */
  const enqueue = (achievement) => {
    achievementQueue.push(achievement);
    // Delay slightly to avoid showing modal during game transitions
    setTimeout(() => showNext(), 1000);
  };

  /**
   * Cleanup any active modal and handlers
   */
  const cleanup = () => {
    // Clean up current modal if any
    if (currentAchievementCloseHandler) {
      const closeBtn = document.getElementById('btn-close-achievement');
      if (closeBtn) {
        closeBtn.removeEventListener('click', currentAchievementCloseHandler);
      }
    }
    if (currentAchievementShareHandler && currentAchievementId) {
      const shareBtn = document.getElementById(`btn-share-achievement-${currentAchievementId}`);
      if (shareBtn) {
        shareBtn.removeEventListener('click', currentAchievementShareHandler);
      }
    }
    const modal = document.getElementById('achievement-modal');
    if (modal) modal.remove();

    achievementQueue = [];
    isShowingAchievement = false;
    currentAchievementCloseHandler = null;
    currentAchievementShareHandler = null;
    currentAchievementId = null;
  };

  return {
    enqueue,
    showNext,
    cleanup,
  };
}
