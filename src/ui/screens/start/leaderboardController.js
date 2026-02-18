import { MODE_IDS } from '@lib/config/game-modes.js';
import {
  Leaderboard,
  LeaderboardModal,
  leaderboardTypeFromSelection,
  selectionFromLeaderboardType,
} from '../../components.js';
import { domCache as _domCache, render, remove, bindClick } from '../../dom.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../../utils/focusTrap.js';
import { handleError } from '../../../core/ErrorHandler.js';
import { t } from '../../../i18n.js';
import { logger } from '../../../utils/logger.js';

/**
 * @param {{
 *   loadLeaderboard: (type: string) => Promise<any[]>,
 *   onRetryLeaderboard?: (type: string) => void
 * }} deps
 */
export const createLeaderboardController = (deps) => {
  const { loadLeaderboard, onRetryLeaderboard } = deps;

  /** @type {"classic"|"daily"} */
  let leaderboardVariant = 'classic';
  /** @type {"capitals"|"countries"|"stadiums"|"civilizations"} */
  let leaderboardCategory = 'capitals';
  let leaderboardRequestId = 0;

  /**
   * @param {"classic"|"daily"} variant
   * @param {"capitals"|"countries"|"stadiums"|"civilizations"} category
   */
  const updateLeaderboardTabs = (variant, category) => {
    const variantBtns = /** @type {const} */ (['classic', 'daily']);
    variantBtns.forEach((v) => {
      const btn = /** @type {HTMLButtonElement | null} */ (
        document.getElementById(`btn-leaderboard-${v}`)
      );
      if (!btn) return;
      if (v === variant) {
        btn.className = btn.className.replace('btn-secondary', '').replace(/\s+/g, ' ').trim();
        if (!btn.classList.contains('bg-yellow-400')) {
          btn.classList.add('bg-yellow-400', 'text-black');
        }
      } else {
        btn.classList.remove('bg-yellow-400', 'text-black');
        if (!btn.classList.contains('btn-secondary')) {
          btn.classList.add('btn-secondary');
        }
      }
    });

    const categoryBtns = /** @type {const} */ ([
      'capitals',
      'countries',
      'stadiums',
      'civilizations',
    ]);
    categoryBtns.forEach((c) => {
      const btn = /** @type {HTMLButtonElement | null} */ (
        document.getElementById(`btn-leaderboard-cat-${c}`)
      );
      if (!btn) return;
      if (c === category) {
        btn.className = btn.className.replace('btn-secondary', '').replace(/\s+/g, ' ').trim();
        if (!btn.classList.contains('bg-yellow-400')) {
          btn.classList.add('bg-yellow-400', 'text-black');
        }
      } else {
        btn.classList.remove('bg-yellow-400', 'text-black');
        if (!btn.classList.contains('btn-secondary')) {
          btn.classList.add('btn-secondary');
        }
      }
    });
  };

  /**
   * @param {string} type
   */
  const updateLeaderboardContent = async (type) => {
    const contentEl = _domCache.get('leaderboard-content');
    if (!contentEl) return;

    const requestId = ++leaderboardRequestId;
    contentEl.style.opacity = '0';

    try {
      const scores = await loadLeaderboard(type);
      if (requestId !== leaderboardRequestId) return;
      if (!document.getElementById('leaderboard-modal')) return;

      if (scores.length === 0) {
        contentEl.innerHTML = `
          <div class="leaderboard-center-state text-center py-8">
            <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
            <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
              ${t('error.retry')}
            </button>
          </div>
        `;
        bindClick('btn-retry-leaderboard', () => {
          if (onRetryLeaderboard) {
            onRetryLeaderboard(type);
          } else {
            updateLeaderboardContent(type);
          }
        });
      } else {
        const nextMarkup = Leaderboard(scores, null, false);
        const template = document.createElement('template');
        template.innerHTML = nextMarkup.trim();
        const nextNode = template.content.firstElementChild;
        if (nextNode instanceof HTMLElement) {
          contentEl.className = nextNode.className;
          const nextRole = nextNode.getAttribute('role');
          const nextAriaLabel = nextNode.getAttribute('aria-label');
          if (nextRole) contentEl.setAttribute('role', nextRole);
          if (nextAriaLabel) contentEl.setAttribute('aria-label', nextAriaLabel);
          contentEl.innerHTML = nextNode.innerHTML;
        }
      }
    } catch (/** @type {unknown} */ error) {
      if (requestId !== leaderboardRequestId) return;
      handleError(error, 'leaderboard:load', { showToUser: false });
      logger.error(`Failed to load ${type} leaderboard:`, error);
      contentEl.innerHTML = `
        <div class="leaderboard-center-state text-center py-8">
          <p class="text-tertiary mb-4">${t('error.leaderboardRetry')}</p>
          <button id="btn-retry-leaderboard" class="text-yellow-400 hover:text-yellow-300 font-bold">
            ${t('error.retry')}
          </button>
        </div>
      `;
      bindClick('btn-retry-leaderboard', () => {
        if (onRetryLeaderboard) {
          onRetryLeaderboard(type);
        } else {
          updateLeaderboardContent(type);
        }
      });
    }

    contentEl.style.opacity = '1';

    const btns = [
      'btn-leaderboard-classic',
      'btn-leaderboard-daily',
      'btn-leaderboard-cat-capitals',
      'btn-leaderboard-cat-countries',
      'btn-leaderboard-cat-stadiums',
      'btn-leaderboard-cat-civilizations',
    ];
    btns.forEach((id) => {
      const btn = /** @type {HTMLButtonElement | null} */ (_domCache.get(id));
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('leaderboard-tab-loading');
      }
    });
  };

  const setupLeaderboardTabs = () => {
    /**
     * @param {"classic"|"daily"} variant
     * @param {"capitals"|"countries"|"stadiums"|"civilizations"} category
     */
    const switchTo = (variant, category) => {
      leaderboardVariant = variant;
      leaderboardCategory = category;
      const type = leaderboardTypeFromSelection(variant, category);
      updateLeaderboardTabs(variant, category);
      updateLeaderboardContent(type);
    };

    bindClick('btn-leaderboard-classic', () => switchTo('classic', leaderboardCategory));
    bindClick('btn-leaderboard-daily', () => switchTo('daily', leaderboardCategory));
    bindClick('btn-leaderboard-cat-capitals', () => switchTo(leaderboardVariant, 'capitals'));
    bindClick('btn-leaderboard-cat-countries', () => switchTo(leaderboardVariant, 'countries'));
    bindClick('btn-leaderboard-cat-stadiums', () => switchTo(leaderboardVariant, 'stadiums'));
    bindClick('btn-leaderboard-cat-civilizations', () =>
      switchTo(leaderboardVariant, 'civilizations')
    );
  };

  /**
   * @param {Array<any>} [initialScores=[]]
   * @param {string} [type='classic']
   * @param {boolean} [lazyLoad=false]
   */
  const showLeaderboardModal = async (
    initialScores = [],
    type = MODE_IDS.CLASSIC,
    lazyLoad = false
  ) => {
    const selection = selectionFromLeaderboardType(type);
    leaderboardVariant = selection.variant;
    leaderboardCategory = selection.category;

    remove('leaderboard-modal');
    const closeLeaderboard = () => {
      deactivateFocusTrap();
      remove('leaderboard-modal');
    };

    render(
      LeaderboardModal(
        lazyLoad ? [] : initialScores,
        /** @type {"classic"|"daily"} */ (type),
        lazyLoad
      )
    );
    bindClick('btn-close-leaderboard', closeLeaderboard);
    setupLeaderboardTabs();

    const leaderboardModal = document.getElementById('leaderboard-modal');
    if (leaderboardModal) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (leaderboardModal), {
          onEscape: closeLeaderboard,
        })
      );
    }

    if (lazyLoad) {
      await updateLeaderboardContent(type);
    }
  };

  return { showLeaderboardModal };
};
