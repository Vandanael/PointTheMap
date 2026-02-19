import { readStoredLang, writeStoredLang } from './storage.js';
import { translations } from './translations.js';

let currentLang = null;

const initLang = () => {
  if (currentLang === null) {
    currentLang = readStoredLang() || 'en';
    // Set HTML lang attribute on init
    document.documentElement.lang = currentLang;
  }
};

export const t = (key, vars = {}) => {
  initLang();

  // Handle nested keys (e.g., "stats.gamesPlayed")
  let value;
  if (key.includes('.')) {
    const parts = key.split('.');
    value = translations[currentLang];
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return key;
    }
  } else {
    value = translations[currentLang][key] || key;
  }

  // Replace {{variable}} with vars
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return vars[varName] !== undefined ? vars[varName] : match;
    });
  }

  return value;
};

export const getLang = () => {
  initLang();
  return currentLang;
};

const setLang = (lang) => {
  if (translations[lang]) {
    currentLang = lang;
    writeStoredLang(lang);
    // Update HTML lang attribute for accessibility/SEO
    document.documentElement.lang = lang;
  }
};

export const toggleLang = () => {
  initLang(); // Initialize currentLang before using it
  const newLang = currentLang === 'fr' ? 'en' : 'fr';
  setLang(newLang);
  return newLang;
};

/**
 * Get localized civilization name (EN/FR). Falls back to fallback if key missing.
 * @param {string} id - Civilization id (e.g. 'roman_empire')
 * @param {string} [fallback=''] - Fallback when no translation
 * @returns {string}
 */
export const getCivilizationName = (id, fallback = '') => {
  const key = 'civilization.' + id;
  const out = t(key);
  return out === key ? fallback : out;
};

/**
 * Get localized capital name (EN/FR). Falls back to fallback if key missing.
 * @param {string} countryId - Country ISO code (e.g. 'GBR', 'FRA')
 * @param {string} [fallback=''] - Fallback when no translation
 * @returns {string}
 */
export const getCapitalName = (countryId, fallback = '') => {
  const key = 'capital.' + countryId;
  const out = t(key);
  return out === key ? fallback : out;
};

/**
 * Get localized country display name (EN/FR). Falls back to fallback if key missing.
 * @param {string} countryId - Country ISO code (e.g. 'GBR', 'FRA')
 * @param {string} [fallback=''] - Fallback when no translation
 * @returns {string}
 */
export const getCountryDisplayName = (countryId, fallback = '') => {
  const key = 'country.' + countryId;
  const out = t(key);
  return out === key ? fallback : out;
};

/**
 * Get localized stadium name (EN/FR). Falls back to fallback if key missing.
 * @param {string} stadiumId - Stadium id (e.g. 'santiago_bernabeu')
 * @param {string} [fallback=''] - Fallback when no translation
 * @returns {string}
 */
export const getStadiumName = (stadiumId, fallback = '') => {
  const key = 'stadium.' + stadiumId;
  const out = t(key);
  return out === key ? fallback : out;
};

/**
 * Get target name in English (for analytics/Plausible).
 * @param {{ name?: string, countryId?: string, id?: string } | null} target
 * @param {'capital' | 'country' | 'stadium' | 'civilization'} targetType
 * @returns {string | null}
 */
export const getTargetNameEn = (target, targetType) => {
  if (!target) return null;
  const en = translations.en;
  switch (targetType) {
    case 'capital':
      return en.capital?.[target.countryId] ?? target.name ?? null;
    case 'country':
      return en.country?.[target.countryId] ?? target.name ?? null;
    case 'stadium':
      return en.stadium?.[target.id] ?? target.name ?? null;
    case 'civilization':
      return en.civilization?.[target.id] ?? target.name ?? null;
    default:
      return target.name ?? null;
  }
};
