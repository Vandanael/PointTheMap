// Language management - sync with main app (localStorage key: ptm_lang)
const LANG_KEY = 'ptm_lang';
const THEME_KEY = 'ptm_theme';

const translations = {
  en: {
    backToGame: 'Back to Game',
    subtitle: 'About this geography game',
    about: 'About',
    madeBy: 'Made by',
    share: 'Share',
  },
  fr: {
    backToGame: 'Retour au jeu',
    subtitle: 'À propos de ce jeu de géographie',
    about: 'À propos',
    madeBy: 'Par',
    share: 'Partager',
  },
};

function getLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    return stored ? JSON.parse(stored) : 'en';
  } catch {
    return 'en';
  }
}

function setLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, JSON.stringify(lang));
  } catch {}
}

function getTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored ? JSON.parse(stored) : 'dark';
  } catch {
    return 'dark';
  }
}

function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  } catch {}
}

function updateTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'light' ? '☀️' : '🌙';
  }
}

function updateContent(lang) {
  // Update content sections
  document.getElementById('content-en').classList.toggle('hidden', lang !== 'en');
  document.getElementById('content-fr').classList.toggle('hidden', lang !== 'fr');

  // Update lang icon
  const langIcon = document.getElementById('lang-icon');
  if (langIcon) {
    langIcon.textContent = lang.toUpperCase();
  }

  // Update HTML lang attribute
  document.documentElement.lang = lang;

  // Update i18n strings
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

// Initialize on page load
let currentLang = getLang();
updateContent(currentLang);

const currentTheme = getTheme();
updateTheme(currentTheme);

// Language toggle listener
document.getElementById('btn-lang')?.addEventListener('click', () => {
  const newLang = getLang() === 'en' ? 'fr' : 'en';
  setLang(newLang);
  updateContent(newLang);
  currentLang = newLang;
});

// Theme toggle listener
document.getElementById('btn-theme')?.addEventListener('click', () => {
  const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  updateTheme(newTheme);
});

// Share button
document.getElementById('btn-share')?.addEventListener('click', async () => {
  const url = window.location.origin;
  const text =
    currentLang === 'fr'
      ? `Point The Map — Devine les capitales ! ${url}`
      : `Point The Map — Try to guess the capitals! ${url}`;

  try {
    if (navigator.share) {
      await navigator.share({ text, url });
    } else {
      await navigator.clipboard.writeText(url);
      // eslint-disable-next-line no-undef
      alert(currentLang === 'fr' ? 'Lien copié !' : 'Link copied!');
    }
  } catch (err) {
    console.error('Share failed:', err);
  }
});
