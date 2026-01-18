// Point The Map - Storage Service
// Wrapper localStorage avec JSON parse/stringify

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

  remove: (key) => {
    localStorage.removeItem(PREFIX + key);
  },

  clear: () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  },
};

// Raccourcis pour données fréquentes
export const getLastPseudo = () => storage.get("lastPseudo");
export const setLastPseudo = (pseudo) => storage.set("lastPseudo", pseudo);
export const getTheme = () => storage.get("theme") || "dark";
export const setTheme = (theme) => storage.set("theme", theme);

// ============================================
// SUBMISSION TIMING (Anti-spam logique)
// ============================================
const SUBMISSION_WINDOW_KEY = "submission_window";
const MIN_SUBMISSION_INTERVAL = 20000; // 20s (une partie dure ~25s)

export const canSubmitScore = () => {
  const lastSubmission = localStorage.getItem(SUBMISSION_WINDOW_KEY);
  if (!lastSubmission) return true;

  const elapsed = Date.now() - parseInt(lastSubmission, 10);
  return elapsed >= MIN_SUBMISSION_INTERVAL;
};

export const getRemainingWaitTime = () => {
  const lastSubmission = localStorage.getItem(SUBMISSION_WINDOW_KEY);
  if (!lastSubmission) return 0;

  const elapsed = Date.now() - parseInt(lastSubmission, 10);
  const remaining = MIN_SUBMISSION_INTERVAL - elapsed;
  return Math.max(0, remaining);
};

export const recordSubmissionTime = () => {
  localStorage.setItem(SUBMISSION_WINDOW_KEY, String(Date.now()));
};

// ============================================
// RETRY QUEUE (Offline resilience)
// ============================================
const RETRY_QUEUE_KEY = "retry_queue";
const MAX_RETRIES = 3;

export const getRetryQueue = () => {
  try {
    const queue = localStorage.getItem(RETRY_QUEUE_KEY);
    if (!queue) return [];
    return JSON.parse(queue);
  } catch (error) {
    console.error("Erreur parsing retry queue:", error);
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

export const getRetryQueueStats = () => {
  const queue = getRetryQueue();
  return { count: queue.length, maxRetries: MAX_RETRIES };
};
