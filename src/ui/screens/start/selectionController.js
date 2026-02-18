import { MODE_IDS } from '@lib/config/game-modes.js';
import { UI_TIMING } from '@lib/config/visual-constants.js';
import { isLowEndDevice } from '../../../utils/device.js';
import {
  preloadCountriesGeoJSON,
  preloadCivilizationsGeoJSON,
} from '../../../data/geoDataLoader.js';
import { t } from '../../../i18n.js';

/**
 * @param {{
 *   geoPreloadStarted: { countries: boolean, civilizations: boolean },
 *   registerListener: (entry: { element: HTMLElement, type: keyof HTMLElementEventMap, listener: EventListener }) => void
 * }} deps
 */
export const createSelectionController = (deps) => {
  const { geoPreloadStarted, registerListener } = deps;

  /** @type {"capitals"|"countries"|"stadiums"|"civilizations"} */
  let selectedCategory = 'capitals';
  /** @type {"classic"|"daily"} */
  let selectedMode = 'classic';

  /** @param {"capitals"|"countries"|"stadiums"|"civilizations"} category */
  const getCategoryInfo = (category) => {
    const infoMap = {
      capitals: {
        title: t('challenge'),
        info: t('capitalsInfo'),
        desc: t('clickToWin'),
      },
      countries: {
        title: t('challenge'),
        info: t('countriesInfo'),
        desc: t('clickToWin'),
      },
      civilizations: {
        title: t('challenge'),
        info: t('civilizationsInfo'),
        desc: t('clickToWin'),
      },
      stadiums: {
        title: t('challenge'),
        info: t('stadiumsInfo'),
        desc: t('clickToWin'),
      },
    };
    return infoMap[/** @type {keyof typeof infoMap} */ (category)] || infoMap.capitals;
  };

  /** @param {"capitals"|"countries"|"stadiums"|"civilizations"} category */
  const updateChallengeCard = (category) => {
    const card = document.getElementById('challenge-card');
    if (!card) return;

    const info = getCategoryInfo(category);
    card.classList.add('fade-out');
    card.classList.remove('fade-in');

    setTimeout(() => {
      const title = card.querySelector('.challenge-title');
      const infoText = card.querySelector('.challenge-info');
      const desc = card.querySelector('.challenge-desc');

      if (title) title.textContent = info.title;
      if (infoText) infoText.textContent = info.info;
      if (desc) desc.textContent = info.desc;

      card.classList.remove('fade-out');
      card.classList.add('fade-in');
    }, UI_TIMING.CHALLENGE_CARD_FADE);
  };

  /** @type {Array<"capitals"|"countries"|"civilizations"|"stadiums">} */
  const categoryButtons = ['capitals', 'countries', 'civilizations', 'stadiums'];
  /** @type {Array<"classic"|"daily">} */
  const modeButtons = ['classic', 'daily'];

  const slider = document.getElementById('pill-slider');
  const mobileModeSelect = /** @type {HTMLSelectElement | null} */ (
    document.getElementById('mobile-game-mode-select')
  );

  const syncMobileModeSelect = () => {
    if (!mobileModeSelect) return;
    if (mobileModeSelect.value !== selectedCategory) {
      mobileModeSelect.value = selectedCategory;
    }
  };

  /** @param {"classic"|"daily"} mode */
  const setSelectedMode = (mode) => {
    selectedMode = mode;

    if (slider) {
      if (mode === MODE_IDS.DAILY) {
        slider.classList.add('slide-right');
      } else {
        slider.classList.remove('slide-right');
      }
    }

    modeButtons.forEach((m) => {
      const modeBtn = document.getElementById(`mode-${m}`);
      if (!modeBtn) return;
      if (m === mode) {
        modeBtn.classList.add('pill-option-active');
        modeBtn.setAttribute('aria-checked', 'true');
      } else {
        modeBtn.classList.remove('pill-option-active');
        modeBtn.setAttribute('aria-checked', 'false');
      }
    });
    syncMobileModeSelect();
  };

  /** @param {"capitals"|"countries"|"civilizations"|"stadiums"} category */
  const setSelectedCategory = (category) => {
    selectedCategory = category;
    updateChallengeCard(category);

    if (!isLowEndDevice()) {
      if (category === 'countries' && !geoPreloadStarted.countries) {
        geoPreloadStarted.countries = true;
        preloadCountriesGeoJSON();
      }
      if (category === 'civilizations' && !geoPreloadStarted.civilizations) {
        geoPreloadStarted.civilizations = true;
        preloadCivilizationsGeoJSON();
      }
    }

    categoryButtons.forEach((cat) => {
      const catBtn = document.getElementById(`category-${cat}`);
      if (!catBtn) return;
      if (cat === category) {
        catBtn.classList.add('category-active');
        catBtn.style.borderColor = 'var(--accent)';
        const textEl = catBtn.querySelector('.text-secondary, .text-primary');
        if (textEl) {
          textEl.classList.remove('text-secondary');
          textEl.classList.add('text-primary');
        }
      } else {
        catBtn.classList.remove('category-active');
        catBtn.style.borderColor = 'var(--border-color)';
        const textEl = catBtn.querySelector('.text-primary, .text-secondary');
        if (textEl) {
          textEl.classList.remove('text-primary');
          textEl.classList.add('text-secondary');
        }
      }
    });
    syncMobileModeSelect();
  };

  const bindControls = () => {
    categoryButtons.forEach((category) => {
      const btn = document.getElementById(`category-${category}`);
      if (!btn) return;
      const categoryListener = () => setSelectedCategory(category);
      btn.addEventListener('click', categoryListener);
      registerListener({ element: btn, type: 'click', listener: categoryListener });
    });

    modeButtons.forEach((mode) => {
      const btn = document.getElementById(`mode-${mode}`);
      if (!btn) return;
      const modeListener = () => setSelectedMode(mode);
      btn.addEventListener('click', modeListener);
      registerListener({ element: btn, type: 'click', listener: modeListener });
    });

    if (mobileModeSelect) {
      const mobileModeListener = () => {
        const value = mobileModeSelect.value;
        if (
          value === 'capitals' ||
          value === 'countries' ||
          value === 'stadiums' ||
          value === 'civilizations'
        ) {
          setSelectedCategory(value);
        }
      };
      mobileModeSelect.addEventListener('change', mobileModeListener);
      registerListener({
        element: mobileModeSelect,
        type: 'change',
        listener: mobileModeListener,
      });
      syncMobileModeSelect();
    }
  };

  return {
    bindControls,
    getSelectedCategory: () => selectedCategory,
    getSelectedMode: () => selectedMode,
  };
};
