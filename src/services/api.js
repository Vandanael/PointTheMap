// Point The Map - API Service

/**
 * @typedef {Object} StartSessionResponse
 * @property {string} token
 * @property {import('../game/Game.js').Capital[]} [capitals]
 * @property {import('../game/Game.js').Country[]} [countries]
 * @property {import('../game/Game.js').Stadium[]} [stadiums]
 * @property {import('../game/Game.js').Civilization[]} [civilizations]
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

import { GAME } from "../config.js";
import { generateId } from "../utils.js";
import { logger } from "../utils/logger.js";
import { loadCapitals, loadSelectBalancedCapitals } from "../data/capitals-loader.js";
import { loadStadiums, loadSelectBalancedStadiums } from "../data/stadiums-loader.js";
import { APIError, GameError } from "../core/ErrorHandler.js";
import {
  getRetryQueue,
  removeFromRetryQueue,
  addToRetryQueue,
  saveRetryQueue,
} from "./storage.js";
import { playerAuth } from "./PlayerAuth.js";

const API_BASE = "/.netlify/functions";
const USE_MOCK = import.meta.env.DEV && !import.meta.env.VITE_USE_API;

// Store current CSRF token
let currentCsrfToken = null;

/**
 * Mock implementation of start API
 * @param {string} [gameType='classic']
 * @returns {Promise<StartSessionResponse>}
 */
const mockStart = async (gameType = 'classic') => {
  if (gameType === 'country') {
    // Load capitals and extract unique countries with valid countryId
    const capitals = await loadCapitals();
    const { RandomSelector } = await import('@lib/capital-selection/index.js');

    // Create unique countries list from capitals, filtering out UNK
    const countryMap = new Map();
    capitals.forEach(cap => {
      if (cap.countryId && cap.countryId !== 'UNK' && !countryMap.has(cap.countryId)) {
        countryMap.set(cap.countryId, {
          name: cap.country,
          countryId: cap.countryId,
          popular: cap.popular
        });
      }
    });
    const countries = Array.from(countryMap.values());

    const selector = new RandomSelector();
    const selected = selector.select(countries, { count: 5, balancing: { popular: 2, obscure: 3 } });

    return {
      token: generateId(),
      countries: selected.map(c => ({
        name: c.name,
        countryId: c.countryId,
        popular: c.popular
      })),
      startTime: Date.now(),
      csrfToken: generateId(),
    };
  }

  if (gameType === 'stadium') {
    const [stadiums, selectBalancedStadiums] = await Promise.all([
      loadStadiums(),
      loadSelectBalancedStadiums()
    ]);

    const selected = selectBalancedStadiums(stadiums);
    return {
      token: generateId(),
      stadiums: selected.map(s => ({
        name: s.name,
        city: s.city,
        country: s.country,
        lat: s.lat,
        lng: s.lng,
        popular: s.popular,
      })),
      startTime: Date.now(),
      csrfToken: generateId(),
    };
  }

  if (gameType === 'civilization') {
    const { civilizations } = await import('../../civilizations.js');
    const { selectCivilizations } = await import('@lib/capital-selection/index.js');
    const { getGameMode } = await import('../config/game-modes.js');
    const mode = getGameMode('civilization');
    const selected = selectCivilizations(mode, civilizations, new Date());
    return {
      token: generateId(),
      civilizations: selected.map(c => ({
        id: c.id,
        name: c.name,
        popular: c.popular
      })),
      startTime: Date.now(),
      csrfToken: generateId(),
    };
  }

  // Lazy load capitals data (only loaded when needed)
  const [capitals, selectBalancedCapitals] = await Promise.all([
    loadCapitals(),
    loadSelectBalancedCapitals()
  ]);

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

  // Add player token to all requests
  try {
    const authHeader = await playerAuth.getAuthHeader();
    headers["Authorization"] = authHeader;
  } catch (error) {
    console.error("[API] Failed to get player token:", error);
    // Continue without token - server will handle missing token
  }

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
 * @param {string} [gameType='classic']
 * @returns {Array<Object>}
 */
const formatRoundsForSubmit = (rounds, gameType = 'classic') =>
  rounds.map((r) => {
    const base = {
      click: r.click,
      status: r.status,
      score: r.score || 0,
      timeElapsed: r.endTime && r.startTime ? r.endTime - r.startTime : undefined,
    };

    if (gameType === 'country' || r.gameType === 'country') {
      return {
        ...base,
        country: r.country?.name,
        countryId: r.country?.countryId,
        correctCountryId: r.correctCountryId,
        clickedCountryId: r.clickedCountryId,
        distanceToTargetKm: r.distanceToTargetKm,
      };
    }

    if (gameType === 'stadium' || r.gameType === 'stadium') {
      return {
        ...base,
        stadium: r.stadium?.name,
        city: r.stadium?.city,
      };
    }

    if (gameType === 'civilization' || r.gameType === 'civilization') {
      return {
        ...base,
        civilization: r.civilization?.name,
        civilizationId: r.civilization?.id,
        correctCivilizationId: r.correctCivilizationId,
        clickedCivilizationId: r.clickedCivilizationId,
        distanceToTargetKm: r.distanceToTargetKm,
      };
    }

    return {
      ...base,
      capital: r.capital?.name,
    };
  });

export const api = {
  start: async (gameType = "classic") => {
    if (USE_MOCK) {
      logger.log("[API] Mode mock activé");
      const session = await mockStart(gameType);
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
        rounds: formatRoundsForSubmit(rounds, gameType),
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
