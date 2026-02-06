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

/**
 * @param {{
 *   getInputSystem: () => { handleNextRound: () => void } | null;
 * }} deps
 */
export const createGameScreen = (deps) => {
  const { getInputSystem } = deps;

  /** @type {null | ((e: Event) => void)} */
  let _questionModalClickHandler = null;

  const showGameUI = (roundNum, totalRounds, totalScore) => {
    render(TimerBar());
    render(GameHeader(roundNum, totalRounds, totalScore));
  };

  const updateGameUI = (roundNum, totalRounds, totalScore) => {
    remove('game-header');
    _domCache.invalidate('game-header');
    render(GameHeader(roundNum, totalRounds, totalScore));
  };

  const hideGameUI = () => {
    remove('game-header');
    remove('timer-bar');
    _domCache.invalidate();
  };

  const hideQuestion = () => {
    deactivateFocusTrap();
    const modal = _domCache.get('question-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    if (_questionModalClickHandler) {
      modal?.removeEventListener('click', _questionModalClickHandler);
      _questionModalClickHandler = null;
    }
  };

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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onClose?.();
        });
      });
    };

    const modalEl = _domCache.get('question-modal');
    if (modalEl) {
      requestAnimationFrame(() =>
        activateFocusTrap(/** @type {HTMLElement} */ (modalEl), { onEscape: close })
      );
    }

    if (requireButton) {
      bindClick('btn-ready', close);
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
      setTimeout(close, UI_TIMING.QUESTION_AUTO_CLOSE);
    }
  };

  const resetTimer = () => {
    const p = _domCache.get('timer-progress');
    if (!p) return;
    p.style.transition = 'none';
    p.style.width = '100%';
    p.classList.remove('timer-danger');
    p.offsetHeight;
  };

  const showRoundResult = (distance, score, isTimeout, isLast, baseScore, timeBonus) => {
    const content =
      /** @type {(distance: number | null, score: number, isTimeout: boolean, isLast: boolean, baseScore?: number, timeBonus?: number) => string} */ (
        RoundResult
      )(distance, score, isTimeout, isLast, baseScore, timeBonus);
    render(Modal('round-result', content, true));
    bindClick('btn-next', () => {
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
  };

  return {
    showGameUI,
    updateGameUI,
    hideGameUI,
    showQuestion,
    hideQuestion,
    resetTimer,
    showRoundResult,
    hideRoundResult,
    destroy,
  };
};
