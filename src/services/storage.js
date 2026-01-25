// Point The Map - Storage Service

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

export const getLastPseudo = () => storage.get("lastPseudo");
export const setLastPseudo = (pseudo) => storage.set("lastPseudo", pseudo);
export const getTheme = () => storage.get("theme") || "dark";
export const setTheme = (theme) => storage.set("theme", theme);

const RETRY_QUEUE_KEY = "retry_queue";

export const getRetryQueue = () => {
  try {
    const queue = localStorage.getItem(RETRY_QUEUE_KEY);
    if (!queue) return [];
    return JSON.parse(queue);
  } catch (error) {
    logger.error("Erreur parsing retry queue:", error);
    try {
      localStorage.removeItem(RETRY_QUEUE_KEY); // Nettoyer la valeur corrompue
    } catch {
      // iOS Private Mode: localStorage.removeItem peut aussi échouer
    }
    return [];
  }
};

export const saveRetryQueue = (queue) => {
  try {
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (error) {
    // iOS Private Mode: localStorage.setItem échoue complètement
    logger.warn("Impossible de sauvegarder la retry queue (iOS Private Mode?)", error);
    return false;
  }
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
  const saved = saveRetryQueue(queue);
  if (!saved) {
    logger.warn("⚠️ Retry queue non sauvegardée (mode privé iOS?)");
  }
  return saved;
};

export const removeFromRetryQueue = (index) => {
  const queue = getRetryQueue();
  queue.splice(index, 1);
  return saveRetryQueue(queue);
};
