// Game screen UI module

import { render, remove, domCache as _domCache, bindClick } from '../dom.js';
import { UI_TIMING } from '../../config/visual-constants.js';
import {
  TimerBar,
  GameHeader,
  QuestionModal,
  QuestionModalWithButton,
  RoundResult,
  Modal,
} from '../components.js';
import { activateFocusTrap, deactivateFocusTrap } from '../../utils/focusTrap.js';
import { logger } from '../../utils/logger.js';
import { formatScore } from '../../utils/format.js';
import { t } from '../../i18n.js';

/**
 * @param {{
 *   getInputSystem: () => { handleNextRound: () => void } | null;
 * }} deps
 */
export const createGameScreen = (deps) => {
  const { getInputSystem } = deps;

  /** @type {null | ((e: Event) => void)} */
  let _questionModalClickHandler = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let _questionAutoCloseTimeout = null;
  let _lastRoundText = '';

  /**
   * @param {number} roundNum
   * @param {number} totalRounds
   * @param {number} totalScore
   */
  const showGameUI = (roundNum, totalRounds, totalScore) => {
    if (!_domCache.get('timer-bar')) {
      render(TimerBar());
    }
    if (!_domCache.get('game-header')) {
      render(GameHeader(roundNum, totalRounds, totalScore));
    } else {
      updateGameUI(roundNum, totalRounds, totalScore);
    }
  };

  /**
   * @param {number} roundNum
   * @param {number} totalRounds
   * @param {number} totalScore
   */
  const updateGameUI = (roundNum, totalRounds, totalScore) => {
    const header = _domCache.get('game-header');
    if (!header) {
      render(GameHeader(roundNum, totalRounds, totalScore));
      return;
    }

    const roundEl = header.querySelector('#game-round');
    const nextRoundText = `${roundNum}/${totalRounds}`;
    if (roundEl && _lastRoundText !== nextRoundText) {
      roundEl.textContent = nextRoundText;
      roundEl.classList.remove('round-pulse');
      void (/** @type {HTMLElement} */ (roundEl).offsetWidth);
      roundEl.classList.add('round-pulse');
      _lastRoundText = nextRoundText;
    }
    const scoreEl = header.querySelector('#game-score');
    if (scoreEl) {
      scoreEl.textContent = formatScore(totalScore);
    }
  };

  const hideGameUI = () => {
    remove('game-header');
    remove('timer-bar');
    remove('round-transition');
    _domCache.invalidate();
  };

  /**
   * Show an intermediate transition indicator between rounds.
   * @param {number} roundNum
   * @param {number} totalRounds
   */
  const showRoundTransition = (roundNum, totalRounds) => {
    remove('round-transition');
    render(`
      <div id="round-transition" class="round-transition" aria-hidden="true">
        <div class="round-transition-card">
          <div class="round-transition-label">${t('round')} ${roundNum}/${totalRounds}</div>
          <div class="round-transition-title">${t('nextRoundPreparing')}</div>
          <div class="round-transition-dots" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `);
  };

  const hideRoundTransition = () => {
    remove('round-transition');
  };

  const hideQuestion = () => {
    deactivateFocusTrap();
    const modal = _domCache.get('question-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    if (_questionAutoCloseTimeout) {
      clearTimeout(_questionAutoCloseTimeout);
      _questionAutoCloseTimeout = null;
    }
    if (_questionModalClickHandler) {
      modal?.removeEventListener('click', _questionModalClickHandler);
      _questionModalClickHandler = null;
    }
  };

  /**
   * @param {string} capitalName
   * @param {string} country
   * @param {() => void} onClose
   * @param {{ requireButton?: boolean }} [options]
   */
  const showQuestion = (capitalName, country, onClose, { requireButton = false } = {}) => {
    let modal = _domCache.get('question-modal');
    if (!modal) {
      if (requireButton) {
        render(QuestionModalWithButton(capitalName, country));
      } else {
        render(QuestionModal(capitalName, country));
      }
      modal = _domCache.get('question-modal');
    } else {
      const capitalEl = modal.querySelector('#capitalName');
      const countryEl = modal.querySelector('#countryName');
      if (capitalEl) capitalEl.textContent = capitalName;
      if (countryEl) countryEl.textContent = country;
      modal.classList.remove('hidden');
    }
    const close = () => {
      hideQuestion();
      const mapContainer = document.getElementById('map');
      if (mapContainer) {
        mapContainer.focus({ preventScroll: true });
      } else {
        document.body.focus({ preventScroll: true });
      }
      onClose?.();
    };

    const modalEl = _domCache.get('question-modal');
    if (modalEl) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (modalEl), { onEscape: close })
      );
    }

    if (requireButton) {
      bindClick('btn-ready', (event) => {
        event.stopPropagation();
        close();
      });
    } else {
      const modal = _domCache.get('question-modal');
      if (modal && _questionModalClickHandler) {
        modal.removeEventListener('click', _questionModalClickHandler);
      }
      _questionModalClickHandler = (event) => {
        event.stopPropagation();
        close();
      };
      if (modal) modal.addEventListener('click', _questionModalClickHandler);
      if (_questionAutoCloseTimeout) {
        clearTimeout(_questionAutoCloseTimeout);
      }
      _questionAutoCloseTimeout = setTimeout(close, UI_TIMING.QUESTION_AUTO_CLOSE);
    }
  };

  const resetTimer = () => {
    const p = _domCache.get('timer-progress');
    if (!p) return;
    p.style.transition = 'none';
    p.style.width = '100%';
    p.classList.remove('timer-danger');
    const bar = _domCache.get('timer-bar');
    bar?.classList.remove('timer-danger');
    bar?.classList.remove('timer-danger-start');
    p.offsetHeight;
  };

  /**
   * @param {number | null} distance
   * @param {number} score
   * @param {boolean} isTimeout
   * @param {boolean} isLast
   * @param {number} [baseScore]
   * @param {number} [timeBonus]
   */
  const showRoundResult = (distance, score, isTimeout, isLast, baseScore, timeBonus) => {
    const content =
      /** @type {(distance: number | null, score: number, isTimeout: boolean, isLast: boolean, baseScore?: number, timeBonus?: number) => string} */ (
        RoundResult
      )(distance, score, isTimeout, isLast, baseScore, timeBonus);
    render(Modal('round-result', content, true));
    bindClick('btn-next', () => {
      const btn = /** @type {HTMLButtonElement | null} */ (_domCache.get('btn-next'));
      if (btn?.disabled) return;
      if (btn) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.classList.add('btn-loading');
      }
      const inputSystem = getInputSystem();
      if (!inputSystem) {
        logger.error('UI: inputSystem not configured');
        return;
      }
      inputSystem.handleNextRound();
    });
  };

  const hideRoundResult = () => {
    remove('round-result');
    _domCache.invalidate('round-result');
  };

  const destroy = () => {
    const modal = document.getElementById('question-modal');
    if (modal && _questionModalClickHandler) {
      modal.removeEventListener('click', _questionModalClickHandler);
    }
    _questionModalClickHandler = null;
    if (_questionAutoCloseTimeout) {
      clearTimeout(_questionAutoCloseTimeout);
      _questionAutoCloseTimeout = null;
    }
  };

  return {
    showGameUI,
    updateGameUI,
    hideGameUI,
    showRoundTransition,
    hideRoundTransition,
    showQuestion,
    hideQuestion,
    resetTimer,
    showRoundResult,
    hideRoundResult,
    destroy,
  };
};
