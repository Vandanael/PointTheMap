// Point The Map - Storage Service
// Wrapper localStorage avec JSON parse/stringify

import { logger } from "../utils/logger.js";

const PREFIX = "ptm_";

export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(PREFIX + key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

};

// Raccourcis pour données fréquentes
export const getLastPseudo = () => storage.get("lastPseudo");
export const setLastPseudo = (pseudo) => storage.set("lastPseudo", pseudo);
export const getTheme = () => storage.get("theme") || "dark";
export const setTheme = (theme) => storage.set("theme", theme);

// Retry queue (offline resilience)
const RETRY_QUEUE_KEY = "retry_queue";

export const getRetryQueue = () => {
  try {
    const queue = localStorage.getItem(RETRY_QUEUE_KEY);
    if (!queue) return [];
    return JSON.parse(queue);
  } catch (error) {
    logger.error("Erreur parsing retry queue:", error);
    localStorage.removeItem(RETRY_QUEUE_KEY); // Nettoyer la valeur corrompue
    return [];
  }
};

export const saveRetryQueue = (queue) => {
  localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
};

export const addToRetryQueue = (token, rounds, pseudo, gameType = "classic") => {
  const queue = getRetryQueue();
  queue.push({
    token,
    rounds,
    pseudo,
    gameType,
    attempts: 0,
    addedAt: Date.now(),
  });
  saveRetryQueue(queue);
};

export const removeFromRetryQueue = (index) => {
  const queue = getRetryQueue();
  queue.splice(index, 1);
  saveRetryQueue(queue);
};
