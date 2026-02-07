// In-progress game persistence (best-effort)
import { storageManager } from './storage.js';
import { API } from '@lib/config';
import { logger } from '../utils/logger.js';

const IN_PROGRESS_KEY = 'in_progress_game';

/**
 * @param {any} state
 */
export const saveInProgressGame = (state) => {
  try {
    return storageManager.set(IN_PROGRESS_KEY, { state, savedAt: Date.now() });
  } catch (error) {
    logger.warn('[GameState] Failed to save in-progress state', error);
    return false;
  }
};

export const clearInProgressGame = () => {
  try {
    return storageManager.remove(IN_PROGRESS_KEY);
  } catch (error) {
    logger.warn('[GameState] Failed to clear in-progress state', error);
    return false;
  }
};

export const loadInProgressGame = () => {
  try {
    const payload = storageManager.get(IN_PROGRESS_KEY);
    if (!payload || typeof payload !== 'object') return null;
    const { state, savedAt } = payload;
    if (!state || typeof savedAt !== 'number') return null;
    if (Date.now() - savedAt > API.SESSION_EXPIRY_MS) {
      clearInProgressGame();
      return null;
    }
    return { state, savedAt };
  } catch (error) {
    logger.warn('[GameState] Failed to load in-progress state', error);
    return null;
  }
};
