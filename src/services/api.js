// @ts-check
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

import { MODE_IDS, getGameMode } from '@lib/config/game-modes.js';
import { generateId } from '../utils/id.js';
import { logger } from '../utils/logger.js';
import { loadCapitals, loadSelectBalancedCapitals } from '../data/capitals-loader.js';
import { loadStadiums, loadSelectBalancedStadiums } from '../data/stadiums-loader.js';
import { APIError, GameError } from '../core/ErrorHandler.js';
import { createApiClient } from './apiClient.js';
import { StartSessionWithModeSchema } from '@lib/schemas/session.js';
import { SubmitSchema } from '@lib/schemas/submit.js';
import { getRetryQueue, removeFromRetryQueue, addToRetryQueue, saveRetryQueue } from './storage.js';
import { playerAuth } from './PlayerAuth.js';

const API_BASE = '/.netlify/functions';

// Client-side leaderboard cache (30s TTL, matching server Cache-Control)
const LEADERBOARD_CACHE_TTL_MS = 30_000;
/** @type {Map<string, { data: Array<{ rank: number, pseudo: string, score: number, time: number }>, timestamp: number }>} */
const leaderboardCache = new Map();
const IS_PROD_BUILD = import.meta.env.PROD;
const USE_MOCK =
  !IS_PROD_BUILD &&
  (import.meta.env.VITE_USE_MOCK === 'true' ||
    (import.meta.env.DEV && !import.meta.env.VITE_USE_API));

if (IS_PROD_BUILD && import.meta.env.VITE_USE_MOCK === 'true') {
  logger.warn('[API] VITE_USE_MOCK is ignored in production builds');
}

// Store current CSRF token
let currentCsrfToken = null;

const fetchApi = createApiClient({
  apiBase: API_BASE,
  getAuthHeader: () => playerAuth.getAuthHeader(),
  getCsrfToken: () => currentCsrfToken,
  logger,
  APIError,
});

/**
 * @typedef {import('../types/session.js').StartSessionPayload} StartSessionPayload
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * @param {any} entry
 * @returns {entry is { rank?: number, pseudo: string, score: number, time: number }}
 */
const isValidLeaderboardEntry = (entry) =>
  isObject(entry) &&
  typeof entry.pseudo === 'string' &&
  Number.isFinite(entry.score) &&
  Number.isFinite(entry.time);

/**
 * @param {any} data
 * @returns {Array<{ rank: number, pseudo: string, score: number, time: number }>}
 */
const normalizeLeaderboard = (data) => {
  if (!Array.isArray(data)) {
    logger.warn('[API] Leaderboard payload is not an array');
    return [];
  }

  let invalidCount = 0;
  const normalized = data
    .map((entry, index) => {
      if (!isValidLeaderboardEntry(entry)) {
        invalidCount += 1;
        return null;
      }
      const rank = Number.isFinite(entry.rank) ? entry.rank : index + 1;
      return {
        rank,
        pseudo: entry.pseudo,
        score: entry.score,
        time: entry.time,
      };
    })
    .filter(Boolean);

  if (invalidCount > 0) {
    logger.warn(`[API] Dropped ${invalidCount} invalid leaderboard entries`);
  }

  return /** @type {Array<{ rank: number, pseudo: string, score: number, time: number }>} */ (
    normalized
  );
};

/**
 * Validate the session payload from server or mock.
 * @param {StartSessionPayload} payload
 * @param {string} gameType
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateStartSessionPayload = (payload, gameType) => {
  const parsed = StartSessionWithModeSchema.safeParse({ ...payload, gameType });
  if (!parsed.success) {
    const firstMessage = parsed.error.issues[0]?.message;
    return { valid: false, error: firstMessage || 'Invalid payload schema' };
  }
  return { valid: true };
};

/**
 * Mock implementation of start API
 * @param {string} [gameType='classic']
 * @returns {Promise<StartSessionResponse>}
 */
const mockStart = async (gameType = MODE_IDS.CLASSIC) => {
  if (gameType === MODE_IDS.COUNTRY) {
    // Load capitals and extract unique countries with valid countryId
    const capitals = await loadCapitals();
    const { RandomSelector } = await import('@lib/capital-selection/index.js');

    // Create unique countries list from capitals, filtering out UNK
    const countryMap = new Map();
    capitals.forEach((cap) => {
      if (cap.countryId && cap.countryId !== 'UNK' && !countryMap.has(cap.countryId)) {
        countryMap.set(cap.countryId, {
          name: cap.country,
          countryId: cap.countryId,
          popular: cap.popular,
        });
      }
    });
    const countries = Array.from(countryMap.values());

    const selector = new RandomSelector();
    const selected = selector.select(countries, {
      count: 5,
      balancing: { popular: 2, obscure: 3 },
    });

    return {
      token: generateId(),
      countries: selected.map((c) => ({
        name: c.name,
        countryId: c.countryId,
        popular: c.popular,
      })),
      startTime: Date.now(),
      csrfToken: generateId(),
    };
  }

  if (gameType === MODE_IDS.STADIUM) {
    const [stadiums, selectBalancedStadiums] = await Promise.all([
      loadStadiums(),
      loadSelectBalancedStadiums(),
    ]);

    const selected = selectBalancedStadiums(stadiums);
    return {
      token: generateId(),
      stadiums: selected.map((s) => ({
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

  if (gameType === MODE_IDS.CIVILIZATION) {
    const { civilizations } = await import('../data/civilizations.js');
    const { selectCivilizations } = await import('@lib/capital-selection/index.js');
    const mode = getGameMode(MODE_IDS.CIVILIZATION);
    const selected = selectCivilizations(
      /** @type {{ civilizationSelection: any }} */ (mode),
      civilizations,
      new Date()
    );
    return {
      token: generateId(),
      civilizations: selected.map((c) => ({
        id: c.id,
        name: c.name,
        popular: c.popular,
      })),
      startTime: Date.now(),
      csrfToken: generateId(),
    };
  }

  // Lazy load capitals data (only loaded when needed)
  const [capitals, selectBalancedCapitals] = await Promise.all([
    loadCapitals(),
    loadSelectBalancedCapitals(),
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
 * @param {string} _pseudo
 * @returns {import('../game/Game.js').SubmitResult}
 */
const mockSubmit = (token, rounds, _pseudo) => {
  const totalScore = rounds.reduce((sum, r) => sum + (r.score || 0), 0);
  return {
    score: Math.round(totalScore),
    rank: Math.floor(Math.random() * 50) + 1,
    isTopFifty: totalScore > 15000,
  };
};

/**
 * Format rounds for API submission
 * @param {import('../game/Game.js').Round[]} rounds
 * @param {string} [gameType='classic']
 * @returns {Array<Object>}
 */
const formatRoundsForSubmit = (rounds, gameType = MODE_IDS.CLASSIC) =>
  rounds.map((r) => {
    const clickLat = r?.click?.lat;
    const clickLng = r?.click?.lng;
    const safeClick =
      Number.isFinite(clickLat) && Number.isFinite(clickLng)
        ? { lat: clickLat, lng: clickLng }
        : null;
    const safeDistance =
      typeof r?.distanceToTargetKm === 'number' && Number.isFinite(r.distanceToTargetKm)
        ? Math.max(0, r.distanceToTargetKm)
        : undefined;
    const timeElapsed =
      typeof r?.endTime === 'number' && typeof r?.startTime === 'number'
        ? Math.max(0, Math.round(r.endTime - r.startTime))
        : undefined;
    const base = {
      click: safeClick,
      status: typeof r?.status === 'string' ? r.status : 'unknown',
      score: Math.max(0, Math.round(Number(r?.score) || 0)),
      timeElapsed,
    };

    if (gameType === MODE_IDS.COUNTRY || r.gameType === MODE_IDS.COUNTRY) {
      return {
        ...base,
        country: r?.country?.name,
        countryId: r?.country?.countryId,
        correctCountryId: r?.correctCountryId,
        clickedCountryId: r?.clickedCountryId,
        distanceToTargetKm: safeDistance,
      };
    }

    if (gameType === MODE_IDS.STADIUM || r.gameType === MODE_IDS.STADIUM) {
      return {
        ...base,
        stadium: r?.stadium?.name,
        city: r?.stadium?.city,
      };
    }

    if (gameType === MODE_IDS.CIVILIZATION || r.gameType === MODE_IDS.CIVILIZATION) {
      return {
        ...base,
        civilization: r?.civilization?.name,
        civilizationId: r?.civilization?.id,
        correctCivilizationId: r?.correctCivilizationId,
        clickedCivilizationId: r?.clickedCivilizationId,
        distanceToTargetKm: safeDistance,
      };
    }

    return {
      ...base,
      capital: r?.capital?.name,
    };
  });

// Expose for tests only (no runtime usage).
export const __testOnlyFormatRoundsForSubmit = formatRoundsForSubmit;

export const api = {
  start: async (gameType = MODE_IDS.CLASSIC) => {
    if (USE_MOCK) {
      logger.log('[API] Mode mock activé');
      const session = await mockStart(gameType);
      const validation = validateStartSessionPayload(session, gameType);
      if (!validation.valid) {
        throw new GameError(`Session payload invalid: ${validation.error}`, 'VALIDATION_ERROR', {
          gameType,
          source: 'mock-start',
        });
      }
      currentCsrfToken = session.csrfToken; // Store CSRF token
      return session;
    }
    const session = await fetchApi('start', {
      method: 'POST',
      body: JSON.stringify({ gameType }),
    });
    const validation = validateStartSessionPayload(session, gameType);
    if (!validation.valid) {
      throw new GameError(`Session payload invalid: ${validation.error}`, 'VALIDATION_ERROR', {
        gameType,
        source: 'start',
      });
    }
    currentCsrfToken = session.csrfToken; // Store CSRF token
    return session;
  },

  submit: async (token, rounds, pseudo, gameType = MODE_IDS.CLASSIC) => {
    if (USE_MOCK) {
      return mockSubmit(token, rounds, pseudo);
    }
    const payload = {
      token,
      rounds: formatRoundsForSubmit(rounds, gameType),
      pseudo,
      gameType,
      payloadVersion: 1,
    };
    SubmitSchema.safeParse(payload);
    return fetchApi('submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getLeaderboard: async (type = MODE_IDS.CLASSIC) => {
    if (USE_MOCK) {
      return [];
    }
    const cached = leaderboardCache.get(type);
    if (cached && Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
      return cached.data;
    }
    const data = await fetchApi(`leaderboard?type=${type}`);
    const normalized = normalizeLeaderboard(data);
    leaderboardCache.set(type, { data: normalized, timestamp: Date.now() });
    return normalized;
  },
};

/**
 * Submit score with retry queue fallback on network error
 * @param {string} token - Session token
 * @param {import('../game/Game.js').Round[]} rounds - Completed rounds
 * @param {string} pseudo - Player pseudo
 * @param {'classic' | 'daily' | 'country' | 'stadium' | 'civilization' | 'country_daily' | 'stadium_daily' | 'civilization_daily'} [gameType='classic'] - Game type
 * @returns {Promise<import('../game/Game.js').SubmitResult>}
 */
export const submitWithRetry = async (
  token,
  rounds,
  pseudo,
  gameType = /** @type {'classic' | 'daily' | 'country' | 'stadium' | 'civilization' | 'country_daily' | 'stadium_daily' | 'civilization_daily'} */ (
    MODE_IDS.CLASSIC
  )
) => {
  try {
    const result = await api.submit(token, rounds, pseudo, gameType);
    const queue = getRetryQueue();
    const index = queue.findIndex((e) => e.token === token && e.pseudo === pseudo);
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
      (error instanceof APIError &&
        (error.status === 0 || // Network error
          error.status === 502 || // Bad Gateway
          error.status === 503 || // Service Unavailable
          error.status === 500 || // Internal Server Error
          error.status >= 504)) || // Gateway Timeout, etc.
      error.message === 'TIMEOUT' ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Network error') ||
      error.message.includes('502') ||
      error.message.includes('503') ||
      error.message.includes('500');

    if (isNetworkError) {
      addToRetryQueue(token, rounds, pseudo, gameType);
      throw new GameError(
        'Score en attente de synchronisation (connexion perdue). Réessai automatique...',
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
      await api.submit(entry.token, entry.rounds, entry.pseudo, entry.gameType || MODE_IDS.CLASSIC);
      removeFromRetryQueue(i);
      successful++;
    } catch {
      entry.attempts++;
      const updatedQueue = getRetryQueue();
      updatedQueue[i] = entry;
      saveRetryQueue(updatedQueue);
      failed++;
    }
  }

  return { successful, failed };
};
