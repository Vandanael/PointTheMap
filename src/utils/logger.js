// Point The Map - Logger minimaliste
// Désactivé en production, actif en développement

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDev) console.log(...args);
  },

  warn: (...args) => {
    if (isDev) console.warn(...args);
  },

  error: (...args) => {
    // Les erreurs sont toujours loggées, même en production
    console.error(...args);
  },

  info: (...args) => {
    if (isDev) console.info(...args);
  },
};
