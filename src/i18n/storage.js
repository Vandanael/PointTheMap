const LANG_STORAGE_KEY = 'ptm_lang';

/**
 * Minimal localStorage access to avoid core/services dependency from i18n.
 * Uses the same key prefix + JSON encoding as StorageManager.
 */
export const readStoredLang = () => {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** @param {string} lang */
export const writeStoredLang = (lang) => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, JSON.stringify(lang));
    return true;
  } catch {
    return false;
  }
};
