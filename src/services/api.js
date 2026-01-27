// Point The Map - API Service

/**
 * @typedef {Object} StartSessionResponse
 * @property {string} token
 * @property {import('../game/Game.js').Capital[]} capitals
 * @property {number} startTime
 * @property {string} csrfToken
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} pseudo
 * @property {number} score
 * @property {string} createdAt
 * @property {number} rank
 */

/**
 * @typedef {Object} RetryQueueEntry
 * @property {string} token
 * @property {import('../game/Game.js').Round[]} rounds
 * @property {string} pseudo
 * @property {string} gameType
 * @property {number} addedAt
 * @property {number} attempts
 */

import { capitals, GAME } from "../config.js";
import { generateId } from "../utils.js";
import { logger } from "../utils/logger.js";
import { selectBalancedCapitals } from "../../capitals.js";
import { APIError, GameError } from "../core/ErrorHandler.js";
import {
  getRetryQueue,
  removeFromRetryQueue,
  addToRetryQueue,
  saveRetryQueue,
} from "./storage.js";

const API_BASE = "/.netlify/functions";
const USE_MOCK = import.meta.env.DEV && !import.meta.env.VITE_USE_API;

// Store current CSRF token
let currentCsrfToken = null;

/**
 * Mock implementation of start API
 * @returns {StartSessionResponse}
 */
const mockStart = () => {
  const selected = selectBalancedCapitals(capitals);
  return {
    token: generateId(),
    capitals: selected.map((c) => ({
      name: c.name,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
    })),
    startTime: Date.now(),
    csrfToken: generateId(), // Mock CSRF token
  };
};

/**
 * Mock implementation of submit API
 * @param {string} token
 * @param {import('../game/Game.js').Round[]} rounds
 * @param {string} pseudo
 * @returns {import('../game/Game.js').SubmitResult}
 */
const mockSubmit = (token, rounds, pseudo) => {
  const totalScore = rounds.reduce((sum, r) => sum + (r.score || 0), 0);
  return {
    score: Math.round(totalScore),
    rank: Math.floor(Math.random() * 50) + 1,
    isTopFifty: totalScore > 15000,
  };
};

/**
 * Fetch API endpoint
 * @param {string} endpoint - API endpoint name
 * @param {RequestInit} [options] - Fetch options
 * @returns {Promise<any>}
 */
const fetchApi = async (endpoint, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  // Add CSRF token to protected endpoints
  if (currentCsrfToken && endpoint === "submit") {
    headers["X-CSRF-Token"] = currentCsrfToken;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    // Network errors (connection refused, timeout, etc.)
    const error = /** @type {Error} */ (networkError);
    throw new APIError(
      `Network error: ${error.message}`,
      0, // 0 indicates network error
      { error: error.message, networkError: true }
    );
  }

  // Handle 502/503 errors before trying to parse JSON
  if (res.status === 502 || res.status === 503) {
    const data = await res.json().catch(() => ({ 
      error: res.status === 502 ? "Bad Gateway - Server error" : "Service Unavailable" 
    }));
    const error = new APIError(
      data.error || `HTTP ${res.status}`,
      res.status,
      data
    );
    throw error;
  }

  const data = await res.json().catch(() => ({ error: "Invalid response" }));

  if (!res.ok) {
    const error = new APIError(
      data.error || `HTTP ${res.status}`,
      res.status,
      data
    );
    throw error;
  }

  return data;
};

/**
 * Format rounds for API submission
 * @param {import('../game/Game.js').Round[]} rounds
 * @returns {Array<{capital: string, click: {lat: number, lng: number} | null, status: string}>}
 */
const formatRoundsForSubmit = (rounds) =>
  rounds.map((r) => ({
    capital: r.capital.name,
    click: r.click,
    status: r.status,
  }));

export const api = {
  start: async (gameType = "classic") => {
    if (USE_MOCK) {
      logger.log("[API] Mode mock activé");
      const session = mockStart();
      currentCsrfToken = session.csrfToken; // Store CSRF token
      return session;
    }
    const session = await fetchApi("start", {
      method: "POST",
      body: JSON.stringify({ gameType }),
    });
    currentCsrfToken = session.csrfToken; // Store CSRF token
    return session;
  },

  submit: async (token, rounds, pseudo, gameType = "classic") => {
    if (USE_MOCK) {
      return mockSubmit(token, rounds, pseudo);
    }
    return fetchApi("submit", {
      method: "POST",
      body: JSON.stringify({
        token,
        rounds: formatRoundsForSubmit(rounds),
        pseudo,
        gameType,
      }),
    });
  },

  getLeaderboard: async (type = "classic") => {
    if (USE_MOCK) {
      return [];
    }
    return fetchApi(`leaderboard?type=${type}`);
  },
};

/**
 * Submit score with retry queue fallback on network error
 * @param {string} token - Session token
 * @param {import('../game/Game.js').Round[]} rounds - Completed rounds
 * @param {string} pseudo - Player pseudo
 * @param {'classic' | 'daily'} [gameType='classic'] - Game type
 * @returns {Promise<import('../game/Game.js').SubmitResult>}
 */
export const submitWithRetry = async (token, rounds, pseudo, gameType = "classic") => {
  try {
    const result = await api.submit(token, rounds, pseudo, gameType);
    const queue = getRetryQueue();
    const index = queue.findIndex(
      (e) => e.token === token && e.pseudo === pseudo
    );
    if (index !== -1) {
      removeFromRetryQueue(index);
    }
    return result;
  } catch (error) {
    if (error instanceof APIError && (error.status === 409 || error.status === 400)) {
      throw error;
    }
    
    // Check for network errors or server errors that should trigger retry
    const isNetworkError = 
      error instanceof APIError && (
        error.status === 0 || // Network error
        error.status === 502 || // Bad Gateway
        error.status === 503 || // Service Unavailable
        error.status === 500 || // Internal Server Error
        error.status >= 504 // Gateway Timeout, etc.
      ) ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("Network error") ||
      error.message.includes("502") ||
      error.message.includes("503") ||
      error.message.includes("500");
    
    if (isNetworkError) {
      addToRetryQueue(token, rounds, pseudo, gameType);
      throw new GameError(
        "Score en attente de synchronisation (connexion perdue). Réessai automatique...",
        'NETWORK_ERROR'
      );
    }
    throw error;
  }
};

/**
 * Process pending scores in retry queue
 * @returns {Promise<{successful: number, failed: number}>}
 */
export const processRetryQueue = async () => {
  const queue = getRetryQueue();
  if (queue.length === 0) return { successful: 0, failed: 0 };

  let successful = 0;
  let failed = 0;
  const MAX_RETRIES = 3;
  const MAX_AGE_MS = 86400000;
  for (let i = queue.length - 1; i >= 0; i--) {
    const entry = queue[i];

    if (Date.now() - entry.addedAt > MAX_AGE_MS) {
      removeFromRetryQueue(i);
      continue;
    }

    if (entry.attempts >= MAX_RETRIES) {
      removeFromRetryQueue(i);
      failed++;
      continue;
    }

    try {
      await api.submit(entry.token, entry.rounds, entry.pseudo, entry.gameType || "classic");
      removeFromRetryQueue(i);
      successful++;
    } catch (error) {
      entry.attempts++;
      const updatedQueue = getRetryQueue();
      updatedQueue[i] = entry;
      saveRetryQueue(updatedQueue);
      failed++;
    }
  }

  return { successful, failed };
};
